import type { Config } from "@netlify/functions"
import { getStore } from "@netlify/blobs"

// Read the weekly counts: GET /api/metrics with header "x-metrics-key: <METRICS_KEY>".
export default async (req: Request) => {
  const key = Netlify.env.get("METRICS_KEY")
  if (!key || req.headers.get("x-metrics-key") !== key) return new Response("Forbidden", { status: 403 })
  const store = getStore("rechner-metrics")
  const { blobs } = await store.list()
  const out: Record<string, unknown> = {}
  for (const b of blobs) out[b.key] = await store.get(b.key, { type: "json" })
  return Response.json(out)
}

export const config: Config = { path: "/api/metrics", method: "GET" }
