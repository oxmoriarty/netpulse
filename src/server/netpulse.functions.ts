import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { areaIdFor, areaName, computeScore, ISPS } from "@/lib/netpulse";
import {
  chainValidate,
  getContractAddress,
  localValidate,
  type SubmissionInput,
} from "./genlayer.server";

const SubmitSchema = z.object({
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  download_mbps: z.number().positive().max(10000),
  upload_mbps: z.number().positive().max(10000),
  latency_ms: z.number().positive().max(5000),
  isp: z.enum(ISPS),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const submitTest = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => SubmitSchema.parse(data))
  .handler(async ({ data }) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const area_id = areaIdFor(data.lat, data.lng);

    // Pull recent history for spam check + area average for outlier check
    const [{ data: recent }, { data: existingArea }] = await Promise.all([
      supabaseAdmin
        .from("submissions")
        .select("wallet_address, download_mbps, created_at")
        .eq("area_id", area_id)
        .gte("created_at", new Date(Date.now() - 5 * 60_000).toISOString())
        .limit(50),
      supabaseAdmin.from("area_scores").select("*").eq("area_id", area_id).maybeSingle(),
    ]);

    const history = (recent ?? []).map((r) => ({
      wallet: r.wallet_address,
      download: r.download_mbps,
      created_at: r.created_at,
    }));
    const areaAvg = existingArea?.avg_download ?? 0;
    const areaCount = existingArea?.sample_count ?? 0;

    const input: SubmissionInput = {
      wallet: data.wallet,
      area_id,
      download: data.download_mbps,
      upload: data.upload_mbps,
      latency: data.latency_ms,
      isp: data.isp,
      timestamp,
    };

    const contractAddress = getContractAddress();
    let result;
    let usedChain = false;
    let chainError: string | null = null;
    try {
      if (contractAddress) {
        result = await chainValidate(input, contractAddress);
        usedChain = true;
      } else {
        result = await localValidate(input, history, areaAvg, areaCount);
      }
    } catch (err) {
      chainError = err instanceof Error ? err.message : String(err);
      console.error("GenLayer call failed, falling back to local validation:", chainError);
      result = await localValidate(input, history, areaAvg, areaCount);
    }

    if (!result.approved) {
      return {
        approved: false,
        reason: result.reason ?? "rejected",
        used_chain: usedChain,
        contract_address: contractAddress,
        chain_error: chainError,
      };
    }

    const score = result.score ?? computeScore(data.download_mbps, data.upload_mbps, data.latency_ms);

    // Ensure the area row exists BEFORE inserting the submission (FK constraint)
    if (!existingArea) {
      const { error: areaInitErr } = await supabaseAdmin.from("area_scores").insert({
        area_id,
        name: areaName(area_id),
        lat: data.lat,
        lng: data.lng,
        netpulse_score: score,
        prev_score: score,
        sample_count: 0,
        avg_download: 0,
        avg_upload: 0,
        avg_latency: 0,
        isp_breakdown: {},
      });
      if (areaInitErr) throw new Error(areaInitErr.message);
    }

    // Persist + recompute area aggregates
    const { error: insertErr } = await supabaseAdmin.from("submissions").insert({
      area_id,
      wallet_address: data.wallet,
      download_mbps: data.download_mbps,
      upload_mbps: data.upload_mbps,
      latency_ms: data.latency_ms,
      isp: data.isp,
      lat: data.lat,
      lng: data.lng,
      score,
      genlayer_tx_hash: result.tx_hash ?? null,
    });
    if (insertErr) throw new Error(insertErr.message);

    // Recompute aggregates from all submissions in this area
    const { data: all } = await supabaseAdmin
      .from("submissions")
      .select("download_mbps, upload_mbps, latency_ms, isp, score")
      .eq("area_id", area_id);
    const rows = all ?? [];
    const sample_count = rows.length;
    const avg = (k: keyof typeof rows[number]) =>
      rows.reduce((s, r) => s + (r[k] as number), 0) / Math.max(sample_count, 1);
    const avg_download = avg("download_mbps");
    const avg_upload = avg("upload_mbps");
    const avg_latency = avg("latency_ms");
    const netpulse_score = computeScore(avg_download, avg_upload, avg_latency);

    const isp_breakdown: Record<string, { count: number; avg_download: number }> = {};
    for (const r of rows) {
      const k = r.isp as string;
      if (!isp_breakdown[k]) isp_breakdown[k] = { count: 0, avg_download: 0 };
      isp_breakdown[k].count += 1;
      isp_breakdown[k].avg_download += r.download_mbps as number;
    }
    for (const k of Object.keys(isp_breakdown)) {
      isp_breakdown[k].avg_download =
        Math.round((isp_breakdown[k].avg_download / isp_breakdown[k].count) * 10) / 10;
    }

    await supabaseAdmin.from("area_scores").upsert({
      area_id,
      name: areaName(area_id),
      lat: data.lat,
      lng: data.lng,
      netpulse_score,
      prev_score: existingArea?.netpulse_score ?? netpulse_score,
      sample_count,
      avg_download,
      avg_upload,
      avg_latency,
      isp_breakdown,
      updated_at: new Date().toISOString(),
    });

    return {
      approved: true,
      score,
      area_id,
      area_score: netpulse_score,
      tx_hash: result.tx_hash ?? null,
      used_chain: usedChain,
      contract_address: contractAddress,
      chain_error: chainError,
    };
  });

export const getMapData = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("area_scores")
    .select("area_id, name, lat, lng, netpulse_score, sample_count")
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return { areas: data ?? [] };
});

const AreaIdSchema = z.object({ id: z.string().min(3).max(64) });

export const getAreaScore = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => AreaIdSchema.parse(data))
  .handler(async ({ data }) => {
    const { data: area } = await supabaseAdmin
      .from("area_scores")
      .select("*")
      .eq("area_id", data.id)
      .maybeSingle();
    if (!area) return { area: null, history: [] };
    const { data: history } = await supabaseAdmin
      .from("submissions")
      .select("score, created_at, isp, download_mbps, upload_mbps, latency_ms")
      .eq("area_id", data.id)
      .order("created_at", { ascending: false })
      .limit(20);
    return { area, history: history ?? [] };
  });