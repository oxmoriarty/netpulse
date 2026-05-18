import { Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AppLayout } from "@/components/Layout";

import appCss from "../styles.css?url";
import leafletCss from "leaflet/dist/leaflet.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "NetPulse — Crowdsourced Network Quality Map" },
      {
        name: "description",
        content:
          "NetPulse is a DePIN network-quality map. Submit a speed test, get GenLayer-validated consensus scores per area.",
      },
      { name: "author", content: "NetPulse" },
      { property: "og:title", content: "NetPulse — Crowdsourced Network Quality Map" },
      { property: "og:description", content: "Builds Web3 DApps on Genlayer blockchain, including smart contracts, frontend, and backend." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@NetPulse" },
      { name: "twitter:title", content: "NetPulse — Crowdsourced Network Quality Map" },
      { name: "description", content: "Builds Web3 DApps on Genlayer blockchain, including smart contracts, frontend, and backend." },
      { name: "twitter:description", content: "Builds Web3 DApps on Genlayer blockchain, including smart contracts, frontend, and backend." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/KKA94xKe7sQY8smuHO649wQcx0m2/social-images/social-1779121066173-1002404273.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/KKA94xKe7sQY8smuHO649wQcx0m2/social-images/social-1779121066173-1002404273.webp" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: leafletCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return <AppLayout />;
}
