/**
 * Server-side GenLayer helpers (Bradbury testnet).
 *
 * The server never signs transactions — users sign with their own wallet.
 * The server only:
 *   1. Verifies a user-supplied tx hash on Bradbury and reads the
 *      contract's return value to decide approval.
 *   2. Falls back to a local validator (mirrors the contract) when no
 *      GENLAYER_CONTRACT_ADDRESS is configured.
 */
import { createClient } from "genlayer-js";
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

/**
 * Look up a user-signed transaction on Bradbury, confirm it called the
 * NetPulse contract, and parse the contract's JSON return value.
 */
export async function verifyTxOnChain(
  txHash: string,
  contractAddress: string,
): Promise<ValidationResult> {
  const client: any = createClient({ chain: testnetBradbury });

  const receipt: any = await client.waitForTransactionReceipt({
    hash: txHash as `0x${string}`,
    retries: 100,
  });

  // Make sure this tx actually targets our contract.
  const to: string | undefined =
    receipt?.to ??
    receipt?.tx_data?.to ??
    receipt?.transaction?.to ??
    undefined;
  if (to && to.toLowerCase() !== contractAddress.toLowerCase()) {
    throw new Error(
      `Tx ${txHash} targets ${to}, not the NetPulse contract ${contractAddress}`,
    );
  }

  let parsed: any = {};
  try {
    const raw =
      receipt?.consensus_data?.leader_receipt?.[0]?.result ??
      receipt?.data?.result ??
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
  };
}
