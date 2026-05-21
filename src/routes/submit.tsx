import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Gauge, Loader2, MapPin, Wifi, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWallet } from "@/store/wallet";
import { ISPS } from "@/lib/netpulse";
import { submitTest, getContractAddressFn } from "@/server/netpulse.functions";
import { areaIdFor } from "@/lib/netpulse";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/submit")({
  head: () => ({
    meta: [
      { title: "Run a speed test · NetPulse" },
      { name: "description", content: "Submit a network speed test, validated on-chain via GenLayer." },
    ],
  }),
  component: SubmitPage,
});

type Phase =
  | "idle"
  | "running"
  | "ready"
  | "signing"
  | "validating"
  | "saving"
  | "done"
  | "error";

function SubmitPage() {
  const navigate = useNavigate();
  const { address, connect } = useWallet();
  const submit = useServerFn(submitTest);
  const fetchContractAddress = useServerFn(getContractAddressFn);

  const [phase, setPhase] = useState<Phase>("idle");
  const [download, setDownload] = useState("");
  const [upload, setUpload] = useState("");
  const [latency, setLatency] = useState("");
  const [isp, setIsp] = useState<(typeof ISPS)[number]>("MTN");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {
        fetch("https://ipapi.co/json/")
          .then((r) => r.json())
          .then((d) => d?.latitude && setCoords({ lat: d.latitude, lng: d.longitude }))
          .catch(() => {});
      },
    );
  }, []);

  /**
   * Browser-based bandwidth probe — downloads a small payload and measures
   * throughput. This is a lightweight LibreSpeed-style estimate (no API key).
   */
  async function runSpeedTest() {
    setPhase("running");
    setProgress(5);
    setError(null);

    // Latency: time a few small image fetches
    const pings: number[] = [];
    for (let i = 0; i < 4; i++) {
      const t0 = performance.now();
      try {
        await fetch(`https://www.cloudflare.com/cdn-cgi/trace?_=${Date.now()}-${i}`, {
          cache: "no-store",
        });
        pings.push(performance.now() - t0);
      } catch {
        /* ignore */
      }
      setProgress(5 + i * 5);
    }
    const ping = pings.length ? Math.round(pings.reduce((a, b) => a + b, 0) / pings.length) : 80;

    // Download: fetch ~5MB from a public mirror
    setProgress(30);
    const dlUrl = `https://speed.cloudflare.com/__down?bytes=5000000&_=${Date.now()}`;
    let dlMbps = 0;
    try {
      const t0 = performance.now();
      const res = await fetch(dlUrl, { cache: "no-store" });
      const blob = await res.blob();
      const seconds = (performance.now() - t0) / 1000;
      dlMbps = (blob.size * 8) / 1_000_000 / seconds;
    } catch {
      dlMbps = 0;
    }
    setProgress(70);

    // Upload: POST 1MB
    let ulMbps = 0;
    try {
      const payload = new Uint8Array(1_000_000);
      const t0 = performance.now();
      await fetch("https://speed.cloudflare.com/__up", {
        method: "POST",
        body: payload,
      });
      const seconds = (performance.now() - t0) / 1000;
      ulMbps = (payload.byteLength * 8) / 1_000_000 / seconds;
    } catch {
      ulMbps = 0;
    }
    setProgress(100);

    setDownload(dlMbps.toFixed(2));
    setUpload(ulMbps.toFixed(2));
    setLatency(String(ping));
    setPhase("ready");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!address) {
      await connect();
      return;
    }
    if (!coords) {
      setError("Location not available — allow location access.");
      return;
    }
    const dl = parseFloat(download);
    const ul = parseFloat(upload);
    const lat = parseFloat(latency);
    if (!isFinite(dl) || !isFinite(ul) || !isFinite(lat) || dl <= 0 || ul <= 0 || lat <= 0) {
      setError("Enter valid speed and latency values.");
      return;
    }

    try {
      // 1) Ask the server which contract address to call.
      const { address: contractAddress } = await fetchContractAddress();

      let txHash: string | undefined;

      if (contractAddress) {
        // 2) User signs + pays gas in their wallet (MetaMask popup).
        setPhase("signing");
        const { submitOnChain } = await import("@/lib/genlayer-wallet");
        const chainRes = await submitOnChain(contractAddress as `0x${string}`, {
          wallet: address as `0x${string}`,
          area_id: areaIdFor(coords.lat, coords.lng),
          download: dl,
          upload: ul,
          latency: lat,
          isp,
          timestamp: Math.floor(Date.now() / 1000),
        });
        txHash = chainRes.tx_hash;
        setPhase("validating");
      }

      // 3) Server verifies the tx on-chain (or runs local fallback) + persists.
      setPhase((p) => (p === "validating" ? p : "saving"));
      const res = await submit({
        data: {
          wallet: address,
          download_mbps: dl,
          upload_mbps: ul,
          latency_ms: lat,
          isp,
          lat: coords.lat,
          lng: coords.lng,
          ...(txHash ? { tx_hash: txHash } : {}),
        },
      });
      setResult(res);
      setPhase("done");
    } catch (err: any) {
      setError(err?.shortMessage ?? err?.message ?? "Submission failed");
      setPhase("error");
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6 md:py-10 animate-fade-in-up">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Run a <span className="text-gradient">speed test</span></h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Test your connection or enter values manually. Each submission is validated by a
          GenLayer Intelligent Contract before it joins the map.
        </p>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-elegant">
        <Button
          type="button"
          onClick={runSpeedTest}
          disabled={phase === "running" || phase === "signing" || phase === "validating" || phase === "saving"}
          className="w-full gap-2 bg-gradient-primary shadow-glow transition-transform hover:scale-[1.02]"
          size="lg"
        >
          {phase === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gauge className="h-4 w-4" />}
          {phase === "running" ? `Testing… ${progress}%` : "Start Speed Test"}
        </Button>
        {phase === "running" && (
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-gradient-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Or enter values manually below.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4 rounded-2xl border border-border/60 bg-card p-5 shadow-elegant">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="dl">Download (Mbps)</Label>
            <Input id="dl" inputMode="decimal" value={download} onChange={(e) => setDownload(e.target.value)} placeholder="50.0" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ul">Upload (Mbps)</Label>
            <Input id="ul" inputMode="decimal" value={upload} onChange={(e) => setUpload(e.target.value)} placeholder="10.0" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lat">Ping (ms)</Label>
            <Input id="lat" inputMode="numeric" value={latency} onChange={(e) => setLatency(e.target.value)} placeholder="40" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="isp">ISP</Label>
          <select
            id="isp"
            value={isp}
            onChange={(e) => setIsp(e.target.value as any)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {ISPS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          {coords
            ? <>Location: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</>
            : "Detecting location…"}
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full gap-2 bg-gradient-primary shadow-glow transition-transform hover:scale-[1.02]"
          disabled={phase === "signing" || phase === "validating" || phase === "saving"}
        >
          {(phase === "signing" || phase === "validating" || phase === "saving") && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
          {!address
            ? "Connect wallet to submit"
            : phase === "signing"
            ? "Approve in your wallet…"
            : phase === "validating"
            ? "Validating on GenLayer…"
            : phase === "saving"
            ? "Saving…"
            : "Submit to NetPulse"}
        </Button>
      </form>

      {phase === "done" && result && (
        <div className="mt-5 rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">
              {result.approved ? "Submission received" : "Submission rejected"}
            </h2>
          </div>
          {result.approved ? (
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Your score</span>
                <span className="font-bold">{result.score}/100</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Updated area score</span>
                <span className="font-bold">{result.area_score}/100</span>
              </div>
              {result.tx_hash ? (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">GenLayer tx</span>
                  <a
                    href={`https://explorer-bradbury.genlayer.com/tx/${result.tx_hash}`}
                    target="_blank" rel="noreferrer"
                    className="font-mono text-primary underline-offset-2 hover:underline"
                  >
                    {String(result.tx_hash).slice(0, 10)}…
                  </a>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  Local validator used.
                  {result.chain_error ? (
                    <> On-chain call failed: <span className="font-mono">{result.chain_error}</span></>
                  ) : !result.contract_address ? (
                    <> Set <code>GENLAYER_CONTRACT_ADDRESS</code> to enable on-chain.</>
                  ) : null}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button onClick={() => navigate({ to: "/area/$id", params: { id: result.area_id } })} className="flex-1">
                  View area
                </Button>
                <Button variant="outline" onClick={() => navigate({ to: "/map" })} className="flex-1">
                  Back to map
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Reason: <span className="font-mono">{result.reason}</span>. Try again in a minute.
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
        <Wifi className="mt-0.5 h-3.5 w-3.5" />
        <p>
          Speed-test estimates use Cloudflare public test endpoints in your browser. For precise
          results, run a test on the same network you want to score.
        </p>
      </div>
    </div>
  );
}