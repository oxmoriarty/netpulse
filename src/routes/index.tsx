import { createFileRoute, Link } from "@tanstack/react-router";
import { Map as MapIcon, Gauge, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/netpulse-logo.png";

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
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-gradient-hero" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />

      <header className="relative flex items-center justify-between px-6 py-5">
        <img src={logo} alt="NetPulse" className="h-8 w-auto" />
        <Link to="/map">
          <Button variant="ghost" size="sm" className="gap-1">
            Open app <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </header>

      <section className="relative mx-auto flex max-w-3xl flex-col items-center px-6 pt-12 pb-24 text-center md:pt-20">
        <span className="animate-fade-in-up rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary backdrop-blur">
          <span className="relative mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary">
            <span className="absolute inset-0 rounded-full bg-primary animate-pulse-ring" />
          </span>
          Live on GenLayer Bradbury Testnet
        </span>
        <h1 className="animate-fade-in-up mt-6 text-4xl font-bold tracking-tight md:text-6xl" style={{ animationDelay: "0.1s" }}>
          Real network truth,<br />
          <span className="text-gradient">validated by AI consensus.</span>
        </h1>
        <p className="animate-fade-in-up mt-5 max-w-xl text-base text-muted-foreground md:text-lg" style={{ animationDelay: "0.2s" }}>
          NetPulse is a DePIN map of internet quality. Anyone can submit a speed test;
          GenLayer Intelligent Contracts reject outliers and spam, then publish a
          trustworthy NetPulse Score per area.
        </p>
        <div className="animate-fade-in-up mt-8 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: "0.3s" }}>
          <Link to="/map">
            <Button size="lg" className="gap-2 bg-gradient-primary shadow-glow transition-transform hover:scale-105">
              <MapIcon className="h-4 w-4" /> Explore the map
            </Button>
          </Link>
          <Link to="/submit">
            <Button size="lg" variant="outline" className="gap-2 transition-transform hover:scale-105">
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
            <div
              key={i}
              className="animate-fade-in-up group rounded-2xl border border-border/60 bg-card/60 p-5 text-left backdrop-blur transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-elegant"
              style={{ animationDelay: `${0.4 + i * 0.1}s` }}
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow transition-transform group-hover:scale-110">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
