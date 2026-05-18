import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, Map as MapIcon, Gauge, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NetPulse — Crowdsourced Network Quality, Validated On-Chain" },
      {
        name: "description",
        content:
          "Submit a speed test. Get a consensus-based NetPulse Score per area, validated by GenLayer Intelligent Contracts on the Bradbury testnet.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-background via-background to-muted">
      <header className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <span className="font-semibold tracking-tight">NetPulse</span>
        </div>
        <Link to="/map">
          <Button variant="ghost" size="sm">Open app</Button>
        </Link>
      </header>

      <section className="mx-auto flex max-w-3xl flex-col items-center px-6 pt-16 pb-24 text-center">
        <span className="rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
          Live on GenLayer Bradbury Testnet
        </span>
        <h1 className="mt-6 text-4xl font-bold tracking-tight md:text-6xl">
          Real network truth,<br />
          <span className="text-primary">validated by AI consensus.</span>
        </h1>
        <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
          NetPulse is a DePIN map of internet quality. Anyone can submit a speed test;
          GenLayer Intelligent Contracts reject outliers and spam, then publish a
          trustworthy NetPulse Score per area.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/map">
            <Button size="lg" className="gap-2">
              <MapIcon className="h-4 w-4" /> Explore the map
            </Button>
          </Link>
          <Link to="/submit">
            <Button size="lg" variant="outline" className="gap-2">
              <Gauge className="h-4 w-4" /> Run a speed test
            </Button>
          </Link>
        </div>

        <div className="mt-20 grid w-full grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              icon: Gauge,
              title: "Test your line",
              body: "Run a browser-based speed test or enter values manually.",
            },
            {
              icon: ShieldCheck,
              title: "Validated by GenLayer",
              body: "An Intelligent Contract checks every submission for spam & outliers.",
            },
            {
              icon: MapIcon,
              title: "Trust the map",
              body: "Color-coded zones reflect consensus scores — not single users.",
            },
          ].map((f, i) => (
            <div key={i} className="rounded-xl border bg-card p-5 text-left">
              <f.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
