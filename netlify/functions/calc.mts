import type { Config, Context } from "@netlify/functions"
import { handleCalc } from "../lib/handlers.mjs"
import { makeCounter } from "../lib/metrics.mjs"

export default async (req: Request, context: Context) =>
  handleCalc(req, { count: makeCounter(context) })

export const config: Config = { path: "/api/calc", method: "POST" }
