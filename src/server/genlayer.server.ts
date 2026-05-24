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
import { abi, createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { ExecutionResult, TransactionStatus } from "genlayer-js/types";
import type { DebugTraceResult, GenLayerTransaction, Hash } from "genlayer-js/types";
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

type ContractResult = {
  approved?: unknown;
  reason?: unknown;
  score?: unknown;
  area_score?: unknown;
  sample_count?: unknown;
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
      input.timestamp - new Date(h.created_at).getTime() / 1000 < SPAM_WINDOW_SECONDS,
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

function getTargetAddress(receipt: GenLayerTransaction): string | undefined {
  const decoded = receipt.txDataDecoded;
  const deployedTo = decoded && "contractAddress" in decoded ? decoded.contractAddress : undefined;
  return receipt.recipient ?? receipt.to_address ?? deployedTo;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * Look up a user-signed transaction on Bradbury, confirm it called the
 * NetPulse contract, and parse the contract's JSON return value.
 */
export async function verifyTxOnChain(
  txHash: string,
  contractAddress: string,
): Promise<ValidationResult> {
  const client = createClient({ chain: testnetBradbury });
  const hash = txHash as Hash;

  const receipt: GenLayerTransaction = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.FINALIZED,
    retries: 140,
  });

  if (
    receipt?.txExecutionResultName === ExecutionResult.FINISHED_WITH_ERROR ||
    receipt?.txExecutionResult === 2
  ) {
    return { approved: false, reason: "Transaction reverted." };
  }
  if (
    receipt?.txExecutionResultName === ExecutionResult.NOT_VOTED ||
    receipt?.txExecutionResult === 0
  ) {
    throw new Error("Transaction has not produced an execution result yet");
  }

  // Make sure this tx actually targets our contract.
  const to = getTargetAddress(receipt);
  if (to && to.toLowerCase() !== contractAddress.toLowerCase()) {
    throw new Error(`Tx ${txHash} targets ${to}, not the NetPulse contract ${contractAddress}`);
  }

  let parsed = extractContractResult(receipt);
  let trace: DebugTraceResult | null = null;
  if (!parsed && typeof client.debugTraceTransaction === "function") {
    try {
      trace = await client.debugTraceTransaction({ hash });
      parsed = extractContractResult(trace);
      if (!parsed && Number(trace?.result_code) > 0) {
        return { approved: false, reason: "Transaction reverted." };
      }
    } catch (traceErr) {
      console.error("Could not read GenLayer debug trace:", safeStringify(traceErr));
    }
  }
  if (!parsed) {
    console.error(
      "Could not decode contract result from receipt:",
      safeStringify({ receipt, trace }).slice(0, 2000),
    );
    throw new Error("Could not decode contract result");
  }

  return {
    approved: parsed.approved === true,
    reason: readString(parsed.reason) ?? (parsed.approved === true ? undefined : "Rejected by GenLayer validators."),
    score: readNumber(parsed.score),
    area_score: readNumber(parsed.area_score),
    sample_count: readNumber(parsed.sample_count),
  };
}

/**
 * The GenLayer receipt shape evolves across SDK versions and the contract
 * returns a JSON string. The encoded result may appear as:
 *   - a JSON string at leader_receipt[0].result
 *   - { status, value } where value is the JSON string
 *   - { Ok: <value> } / { result: { Ok: <value> } }
 *   - base64-encoded JSON
 *   - hex-encoded UTF-8 JSON
 * Walk the receipt and pull out the first parseable {"approved": ...} blob.
 */
function extractContractResult(receipt: any): any | null {
  const seen = new Set<any>();
  const candidates: any[] = [];

  const walk = (node: any) => {
    if (node == null || seen.has(node)) return;
    if (typeof node === "object") {
      seen.add(node);
      candidates.push(node);
      for (const v of Object.values(node)) walk(v);
    } else {
      candidates.push(node);
    }
  };
  walk(receipt);

  for (const c of candidates) {
    const obj = tryParse(c);
    if (obj && typeof obj === "object" && "approved" in obj) {
      return obj;
    }
  }
  return null;
}

function tryParse(v: any): any | null {
  if (v == null) return null;
  if (typeof v === "object") {
    if ("approved" in v) return v;
    return null;
  }
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;

  // direct JSON, including JSON strings that contain the contract JSON
  if (s.startsWith("{") || s.startsWith('"')) {
    const parsed = parseJsonCandidate(s);
    if (parsed) return parsed;
  }
  // hex-encoded GenLayer return envelope or UTF-8 JSON
  if (/^0x[0-9a-fA-F]+$/.test(s) && s.length > 4) {
    try {
      const bytes = Buffer.from(s.slice(2), "hex");
      const envelope = parseGenLayerReturnBytes(bytes);
      if (envelope) return envelope;
      const txt = bytes.toString("utf8");
      if (txt.includes("approved")) return parseJsonCandidate(txt);
    } catch { /* fall through */ }
  }
  // base64-encoded GenLayer return envelope or JSON
  if (/^[A-Za-z0-9+/=]+$/.test(s) && s.length % 4 === 0 && s.length > 8) {
    try {
      const bytes = Buffer.from(s, "base64");
      const envelope = parseGenLayerReturnBytes(bytes);
      if (envelope) return envelope;
      const txt = bytes.toString("utf8");
      if (txt.includes("approved")) return parseJsonCandidate(txt);
    } catch { /* fall through */ }
  }
  return null;
}

function parseJsonCandidate(value: string): any | null {
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && "approved" in parsed) return parsed;
    if (typeof parsed === "string" && parsed.trim().startsWith("{")) {
      const nested = JSON.parse(parsed);
      if (nested && typeof nested === "object" && "approved" in nested) return nested;
    }
  } catch { /* ignore */ }
  return null;
}

function parseGenLayerReturnBytes(bytes: Buffer): any | null {
  if (bytes.length < 2 || bytes[0] !== 0) return null;
  try {
    const decoded = abi.calldata.decode(bytes.subarray(1));
    if (typeof decoded === "string") return parseJsonCandidate(decoded);
    if (decoded && typeof decoded === "object" && "approved" in decoded) return decoded;
  } catch { /* ignore */ }
  return null;
}

function safeStringify(value: unknown): string {
  return JSON.stringify(value, (_key, item) =>
    typeof item === "bigint" ? item.toString() : item,
  );
}
