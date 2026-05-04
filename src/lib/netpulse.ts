/**
 * Shared NetPulse helpers (client + server safe — no node-only imports).
 */

export type Quality = "good" | "average" | "poor";

export function qualityOf(score: number): Quality {
  if (score >= 80) return "good";
  if (score >= 50) return "average";
  return "poor";
}

export function qualityColor(score: number): string {
  const q = qualityOf(score);
  if (q === "good") return "var(--np-good)";
  if (q === "average") return "var(--np-avg)";
  return "var(--np-poor)";
}

export function qualityLabel(score: number): string {
  const q = qualityOf(score);
  if (q === "good") return "Good";
  if (q === "average") return "Average";
  return "Poor";
}

/**
 * Deterministic NetPulse Score 0-100 — must match the on-chain contract logic.
 */
export function computeScore(
  download: number,
  upload: number,
  latency: number,
): number {
  const dl = (Math.min(download, 200) / 200) * 70;
  const ul = (Math.min(upload, 50) / 50) * 15;
  const lat = (Math.max(0, 300 - Math.min(latency, 300)) / 300) * 15;
  return Math.max(0, Math.min(100, Math.round(dl + ul + lat)));
}

/**
 * Snap a coordinate to a ~1.1km grid cell. Each cell becomes an "area".
 * 0.01 deg ≈ 1.1 km — coarse enough to aggregate, fine enough to be local.
 */
export function areaIdFor(lat: number, lng: number): string {
  const la = Math.round(lat * 100) / 100;
  const ln = Math.round(lng * 100) / 100;
  return `${la.toFixed(2)}_${ln.toFixed(2)}`;
}

export function areaCenter(areaId: string): { lat: number; lng: number } {
  const [la, ln] = areaId.split("_").map(Number);
  return { lat: la, lng: ln };
}

export function areaName(areaId: string): string {
  const { lat, lng } = areaCenter(areaId);
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `Zone ${Math.abs(lat).toFixed(2)}°${ns} ${Math.abs(lng).toFixed(2)}°${ew}`;
}

export const ISPS = ["MTN", "Airtel", "Glo", "9mobile", "Other"] as const;
export type ISP = (typeof ISPS)[number];