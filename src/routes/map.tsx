import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { getMapData } from "@/server/netpulse.functions";

const NetMap = lazy(() => import("@/components/NetMap"));

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Map · NetPulse" },
      {
        name: "description",
        content: "Live map of NetPulse Scores by area, validated on GenLayer.",
      },
    ],
  }),
  loader: () => getMapData(),
  component: MapPage,
});

function MapPage() {
  const { areas } = Route.useLoaderData();
  return (
    <div className="h-[calc(100dvh-57px-64px)] md:h-[calc(100dvh-57px)]">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading map…
          </div>
        }
      >
        <NetMap areas={areas} />
      </Suspense>
    </div>
  );
}