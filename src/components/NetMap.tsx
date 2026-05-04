import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import { Link } from "@tanstack/react-router";
import { qualityColor, qualityLabel } from "@/lib/netpulse";

type Area = {
  area_id: string;
  name: string;
  lat: number;
  lng: number;
  netpulse_score: number;
  sample_count: number;
};

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function NetMap({ areas }: { areas: Area[] }) {
  const [center, setCenter] = useState<[number, number]>([6.5244, 3.3792]); // Lagos default
  const [located, setLocated] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCenter([p.coords.latitude, p.coords.longitude]);
        setLocated(true);
      },
      () => {
        // fallback to IP-based geolocation
        fetch("https://ipapi.co/json/")
          .then((r) => r.json())
          .then((d) => {
            if (d?.latitude && d?.longitude) {
              setCenter([d.latitude, d.longitude]);
              setLocated(true);
            }
          })
          .catch(() => {});
      },
      { timeout: 4000 },
    );
  }, []);

  const empty = useMemo(() => areas.length === 0, [areas]);

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {located && <Recenter center={center} />}
        {areas.map((a) => (
          <CircleMarker
            key={a.area_id}
            center={[a.lat, a.lng]}
            radius={Math.min(8 + Math.sqrt(a.sample_count) * 3, 28)}
            pathOptions={{
              color: qualityColor(a.netpulse_score),
              fillColor: qualityColor(a.netpulse_score),
              fillOpacity: 0.55,
              weight: 2,
            }}
          >
            <Popup>
              <div className="space-y-2 min-w-[180px]">
                <div className="font-semibold">{a.name}</div>
                <div className="flex items-center justify-between text-sm">
                  <span>NetPulse</span>
                  <span
                    className="font-bold"
                    style={{ color: qualityColor(a.netpulse_score) }}
                  >
                    {a.netpulse_score} · {qualityLabel(a.netpulse_score)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {a.sample_count} sample{a.sample_count === 1 ? "" : "s"}
                </div>
                <Link
                  to="/area/$id"
                  params={{ id: a.area_id }}
                  className="block w-full rounded-md bg-primary px-3 py-1.5 text-center text-sm font-medium text-primary-foreground"
                >
                  View details
                </Link>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {empty && (
        <div className="pointer-events-none absolute inset-x-4 top-4 z-[1000] rounded-lg border bg-card/95 p-4 text-sm shadow-lg backdrop-blur md:max-w-sm">
          <div className="font-semibold">No data yet.</div>
          <p className="text-muted-foreground">
            Be the first to submit a speed test in your area.
          </p>
        </div>
      )}
    </div>
  );
}