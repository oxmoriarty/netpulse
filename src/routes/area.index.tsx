import { createFileRoute, Link } from "@tanstack/react-router";
import { getMapData } from "@/server/netpulse.functions";
import { qualityColor, qualityLabel } from "@/lib/netpulse";

export const Route = createFileRoute("/area/")({
  head: () => ({
    meta: [
      { title: "Area stats · NetPulse" },
      { name: "description", content: "All measured areas with NetPulse Scores." },
    ],
  }),
  loader: () => getMapData(),
  component: AreaIndex,
});

function AreaIndex() {
  const { areas } = Route.useLoaderData();
  const sorted = [...areas].sort((a, b) => b.netpulse_score - a.netpulse_score);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:py-10">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Area stats</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        All measured zones, ranked by NetPulse Score.
      </p>

      {sorted.length === 0 ? (
        <div className="mt-10 rounded-xl border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            No data yet. <Link to="/submit" className="text-primary underline-offset-2 hover:underline">Be the first to submit.</Link>
          </p>
        </div>
      ) : (
        <ul className="mt-6 divide-y rounded-xl border bg-card">
          {sorted.map((a) => (
            <li key={a.area_id}>
              <Link
                to="/area/$id"
                params={{ id: a.area_id }}
                className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{a.name}</div>
                  <div className="text-xs text-muted-foreground">{a.sample_count} sample{a.sample_count === 1 ? "" : "s"}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className="rounded-full px-2.5 py-1 text-xs font-semibold"
                    style={{
                      background: `color-mix(in oklab, ${qualityColor(a.netpulse_score)} 15%, transparent)`,
                      color: qualityColor(a.netpulse_score),
                    }}
                  >
                    {qualityLabel(a.netpulse_score)}
                  </span>
                  <div className="text-2xl font-bold tabular-nums">{a.netpulse_score}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}