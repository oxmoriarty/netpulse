import { create } from "zustand";

type WalletState = {
  address: string | null;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  hydrate: () => void;
};

const STORAGE_KEY = "netpulse:wallet";

const BRADBURY = {
  chainId: "0x107d", // 4221
  chainName: "GenLayer Bradbury",
  rpcUrls: ["https://rpc-bradbury.genlayer.com"],
  nativeCurrency: { name: "GEN Token", symbol: "GEN", decimals: 18 },
  blockExplorerUrls: ["https://explorer-bradbury.genlayer.com"],
};

export const useWallet = create<WalletState>((set) => ({
  address: null,
  connecting: false,
  error: null,
  hydrate: () => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) set({ address: saved });
  },
  connect: async () => {
    set({ connecting: true, error: null });
    try {
      const eth = (window as any).ethereum;
      if (!eth) throw new Error("No EVM wallet found. Install MetaMask.");
      const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
      const addr = accounts[0];
      // Try to switch / add Bradbury — non-fatal if user rejects
      try {
        await eth.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: BRADBURY.chainId }],
        });
      } catch (e: any) {
        if (e?.code === 4902) {
          try {
            await eth.request({
              method: "wallet_addEthereumChain",
              params: [BRADBURY],
            });
          } catch {
            /* ignore */
          }
        }
      }
      localStorage.setItem(STORAGE_KEY, addr);
      set({ address: addr, connecting: false });
    } catch (e: any) {
      set({ error: e?.message ?? "Failed to connect", connecting: false });
    }
  },
  disconnect: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ address: null });
  },
}));