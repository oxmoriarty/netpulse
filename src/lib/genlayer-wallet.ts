/**
 * Client-side GenLayer submission — the user's wallet signs the
 * submit_test transaction and pays gas in GEN on Bradbury testnet.
 */
import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

export type ChainSubmitInput = {
  wallet: `0x${string}`;
  area_id: string;
  download: number;
  upload: number;
  latency: number;
  isp: string;
  timestamp: number;
};

export type ChainSubmitResult = {
  tx_hash: string;
  approved: boolean;
  reason?: string;
  score?: number;
  area_score?: number;
  sample_count?: number;
};

export async function submitOnChain(
  contractAddress: `0x${string}`,
  input: ChainSubmitInput,
): Promise<ChainSubmitResult> {
  const eth = (window as any).ethereum;
  if (!eth) throw new Error("No EVM wallet found. Install MetaMask.");

  const client: any = createClient({
    chain: testnetBradbury,
    account: input.wallet,
    provider: eth,
  } as any);

  // Make sure the wallet is on Bradbury — adds the chain if missing.
  try {
    await client.connect?.("testnetBradbury");
  } catch {
    /* the SDK throws if wallet was already on the right chain — ignore */
  }

  const txHash: string = await client.writeContract({
    address: contractAddress,
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

  const receipt: any = await client.waitForTransactionReceipt({
    hash: txHash,
    retries: 100,
  });

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
    tx_hash: String(txHash),
    approved: !!parsed.approved,
    reason: parsed.reason,
    score: parsed.score,
    area_score: parsed.area_score,
    sample_count: parsed.sample_count,
  };
}
