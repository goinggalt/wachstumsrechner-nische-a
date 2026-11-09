import type { Config, Context } from "@netlify/functions"
import { handleTrack } from "../lib/handlers.mjs"
import { makeCounter } from "../lib/metrics.mjs"

export default async (req: Request, context: Context) =>
  handleTrack(req, { count: makeCounter(context) })

export const config: Config = { path: "/api/track", method: "POST" }
