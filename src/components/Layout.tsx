import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { Activity, Map as MapIcon, Gauge, BarChart3 } from "lucide-react";
import { useEffect } from "react";
import { useWallet } from "@/store/wallet";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/map", label: "Map", icon: MapIcon },
  { to: "/submit", label: "Test", icon: Gauge },
  { to: "/area", label: "Stats", icon: BarChart3 },
] as const;

function WalletButton() {
  const { address, connect, disconnect, connecting } = useWallet();
  if (address) {
    return (
      <Button variant="outline" size="sm" onClick={disconnect} className="font-mono text-xs">
        {address.slice(0, 6)}…{address.slice(-4)}
      </Button>
    );
  }
  return (
    <Button size="sm" onClick={connect} disabled={connecting}>
      {connecting ? "Connecting…" : "Connect Wallet"}
    </Button>
  );
}

export function AppLayout() {
  const loc = useLocation();
  const hydrate = useWallet((s) => s.hydrate);
  useEffect(() => hydrate(), [hydrate]);

  const onLanding = loc.pathname === "/";
  if (onLanding) return <Outlet />;

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/80 px-4 py-3 backdrop-blur">
        <Link to="/map" className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <span className="font-semibold tracking-tight">NetPulse</span>
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((n) => {
            const active =
              n.to === "/area"
                ? loc.pathname.startsWith("/area")
                : loc.pathname === n.to;
            return (
              <Link
                key={n.to}
                to={n.to === "/area" ? "/area" : n.to}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  active ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <WalletButton />
      </header>

      <main className="flex-1 pb-20 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-3 border-t bg-background/95 backdrop-blur md:hidden">
        {NAV.map((n) => {
          const Icon = n.icon;
          const active =
            n.to === "/area"
              ? loc.pathname.startsWith("/area")
              : loc.pathname === n.to;
          return (
            <Link
              key={n.to}
              to={n.to === "/area" ? "/area" : n.to}
              className={`flex flex-col items-center justify-center gap-1 py-2.5 text-xs transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              {n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}