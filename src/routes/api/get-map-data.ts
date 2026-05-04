import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/get-map-data")({
  server: {
    handlers: {
      GET: async () => {
        const { data, error } = await supabaseAdmin
          .from("area_scores")
          .select("area_id, name, lat, lng, netpulse_score, sample_count, avg_download, avg_upload, avg_latency, isp_breakdown")
          .order("updated_at", { ascending: false })
          .limit(500);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }
        return Response.json({ areas: data ?? [] });
      },
    },
  },
});