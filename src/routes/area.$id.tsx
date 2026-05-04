import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { ArrowLeft, ArrowDown, ArrowUp, Minus } from "lucide-react";
import { getAreaScore } from "@/server/netpulse.functions";
import { qualityColor, qualityLabel } from "@/lib/netpulse";

export const Route = createFileRoute("/area/$id")({
  loader: async ({ params }) => {
    const res = await getAreaScore({ data: { id: params.id } });
    if (!res.area) throw notFound();
    return res;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.area?.name ?? "Area"} · NetPulse` },
      {
        name: "description",
        content: loaderData?.area
          ? `NetPulse Score ${loaderData.area.netpulse_score}/100 from ${loaderData.area.sample_count} samples.`
          : "NetPulse area details.",
      },
    ],
  }),
  component: AreaDetail,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-xl font-semibold">Couldn't load area</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          Retry
        </button>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-md p-6 text-center">
      <h1 className="text-xl font-semibold">Area not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">No data for this zone yet.</p>
      <Link to="/map" className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
        Back to map
      </Link>
    </div>
  ),
});

function AreaDetail() {
  const { area, history } = Route.useLoaderData();
  if (!area) return null;

  const trend = area.netpulse_score - (area.prev_score ?? area.netpulse_score);
  const TrendIcon = trend > 1 ? ArrowUp : trend < -1 ? ArrowDown : Minus;
  const trendColor = trend > 1 ? "var(--np-good)" : trend < -1 ? "var(--np-poor)" : "var(--muted-foreground)";

  const isps = Object.entries(
    (area.isp_breakdown ?? {}) as Record<string, { count: number; avg_download: number }>,
  ).sort(([, a], [, b]) => b.avg_download - a.avg_download);

  // Sparkline data — most recent 20 scores, oldest first
  const series = [...history].reverse().map((h) => h.score);
  const max = Math.max(100, ...series);
  const min = Math.min(0, ...series);
  const w = 280, h = 60;
  const pts = series.length > 1
    ? series.map((s, i) => {
        const x = (i / (series.length - 1)) * w;
        const y = h - ((s - min) / (max - min || 1)) * h;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(" ")
    : "";

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:py-10">
      <Link to="/map" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to map
      </Link>

      <div className="mt-4 rounded-xl border bg-card p-6">
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">{area.name}</h1>
        <div className="mt-4 flex items-end justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">NetPulse Score</div>
            <div className="flex items-baseline gap-2">
              <div
                className="text-6xl font-bold tabular-nums"
                style={{ color: qualityColor(area.netpulse_score) }}
              >
                {area.netpulse_score}
              </div>
              <div className="text-sm text-muted-foreground">/ 100</div>
            </div>
            <div className="text-sm font-medium" style={{ color: qualityColor(area.netpulse_score) }}>
              {qualityLabel(area.netpulse_score)}
            </div>
          </div>
          <div className="flex items-center gap-1 text-sm" style={{ color: trendColor }}>
            <TrendIcon className="h-4 w-4" />
            {trend > 0 ? "+" : ""}{trend}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4 text-center">
          <Stat label="Download" value={`${area.avg_download.toFixed(1)} Mbps`} />
          <Stat label="Upload" value={`${area.avg_upload.toFixed(1)} Mbps`} />
          <Stat label="Latency" value={`${Math.round(area.avg_latency)} ms`} />
        </div>
      </div>

      {pts && (
        <div className="mt-4 rounded-xl border bg-card p-5">
          <div className="mb-2 text-sm font-medium">Recent scores</div>
          <svg viewBox={`0 0 ${w} ${h}`} className="h-16 w-full">
            <polyline
              fill="none"
              stroke={qualityColor(area.netpulse_score)}
              strokeWidth="2"
              points={pts}
            />
          </svg>
          <div className="text-xs text-muted-foreground">{series.length} most recent submissions</div>
        </div>
      )}

      <div className="mt-4 rounded-xl border bg-card p-5">
        <div className="mb-3 text-sm font-medium">ISP ranking</div>
        {isps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No ISP data yet.</p>
        ) : (
          <ul className="divide-y">
            {isps.map(([name, v]) => (
              <li key={name} className="flex items-center justify-between py-2">
                <div>
                  <div className="font-medium">{name}</div>
                  <div className="text-xs text-muted-foreground">{v.count} sample{v.count === 1 ? "" : "s"}</div>
                </div>
                <div className="font-semibold tabular-nums">{v.avg_download.toFixed(1)} Mbps</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3 text-center text-xs text-muted-foreground">
        {area.sample_count} total submission{area.sample_count === 1 ? "" : "s"} validated by GenLayer
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}