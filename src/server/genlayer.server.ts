/**
 * Server-side GenLayer client (Bradbury testnet).
 *
 * In production, set GENLAYER_CONTRACT_ADDRESS to the deployed NetPulse
 * contract address. If unset, the server falls back to a local validator
 * that mirrors the contract's logic so the app remains usable in dev.
 */
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { computeScore } from "@/lib/netpulse";

const SPAM_WINDOW_SECONDS = 60;
const OUTLIER_FACTOR = 0.8;

export type SubmissionInput = {
  wallet: string;
  area_id: string;
  download: number;
  upload: number;
  latency: number;
  isp: string;
  timestamp: number;
};

export type ValidationResult = {
  approved: boolean;
  reason?: string;
  score?: number;
  area_score?: number;
  sample_count?: number;
  tx_hash?: string | null;
};

function basicValid(d: number, u: number, l: number) {
  return d > 0 && d < 10000 && u > 0 && u < 10000 && l > 0 && l < 5000;
}

/** Local validator mirroring the on-chain contract for fallback. */
export async function localValidate(
  input: SubmissionInput,
  history: { wallet: string; download: number; created_at: string }[],
  areaAvgDownload: number,
  areaCount: number,
): Promise<ValidationResult> {
  if (!basicValid(input.download, input.upload, input.latency)) {
    return { approved: false, reason: "out_of_range" };
  }
  const recent = history.find(
    (h) =>
      h.wallet.toLowerCase() === input.wallet.toLowerCase() &&
      input.timestamp - new Date(h.created_at).getTime() / 1000 <
        SPAM_WINDOW_SECONDS,
  );
  if (recent) return { approved: false, reason: "spam_rate_limited" };

  if (areaCount >= 3 && areaAvgDownload > 0) {
    const drift = Math.abs(input.download - areaAvgDownload) / areaAvgDownload;
    if (drift > OUTLIER_FACTOR) {
      return { approved: false, reason: "outlier" };
    }
  }
  const score = computeScore(input.download, input.upload, input.latency);
  return { approved: true, score, tx_hash: null };
}

export function getContractAddress(): string | null {
  const addr = process.env.GENLAYER_CONTRACT_ADDRESS;
  return addr && addr.startsWith("0x") ? addr : null;
}

function getPrivateKey(): `0x${string}` | null {
  const k = process.env.GENLAYER_PRIVATE_KEY;
  if (!k) return null;
  const v = k.startsWith("0x") ? k : `0x${k}`;
  return v as `0x${string}`;
}

/**
 * Send the submission to the deployed Intelligent Contract.
 * Returns the tx hash + decoded approval. Throws on RPC errors so the
 * caller can fall back to local validation.
 */
export async function chainValidate(
  input: SubmissionInput,
  contractAddress: string,
): Promise<ValidationResult> {
  const pk = getPrivateKey();
  if (!pk) {
    throw new Error(
      "GENLAYER_PRIVATE_KEY not set — the server needs a funded Bradbury account to sign contract calls.",
    );
  }
  const account = createAccount(pk);
  const client = createClient({
    chain: testnetBradbury,
    account,
  });

  const txHash = await client.writeContract({
    address: contractAddress as `0x${string}`,
    functionName: "submit_test",
    args: [
      input.wallet,
      input.area_id,
      input.download,
      input.upload,
      input.latency,
      input.isp,
      input.timestamp,
    ],
    value: 0n,
  });

  const receipt = await client.waitForTransactionReceipt({
    hash: txHash as any,
    retries: 100,
  });

  // The contract returns a JSON string from submit_test.
  let parsed: any = {};
  try {
    const raw =
      (receipt as any)?.consensus_data?.leader_receipt?.[0]?.result ??
      (receipt as any)?.data?.result ??
      "{}";
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    parsed = {};
  }

  return {
    approved: !!parsed.approved,
    reason: parsed.reason,
    score: parsed.score,
    area_score: parsed.area_score,
    sample_count: parsed.sample_count,
    tx_hash: String(txHash),
  };
}