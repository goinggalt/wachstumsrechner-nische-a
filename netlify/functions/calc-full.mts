import type { Config, Context } from "@netlify/functions"
import { handleCalcFull } from "../lib/handlers.mjs"
import { makeCounter } from "../lib/metrics.mjs"

const ENV_KEYS = [
  "BREVO_API_KEY", "BREVO_LIST_LEADS", "BREVO_LIST_NEWSLETTER", "BREVO_TEMPLATE_RESULT",
  "BREVO_TEMPLATE_DOI", "BREVO_DOI_REDIRECT_URL", "CALENDLY_URL", "CONSENT_TEXT_VERSION",
]

export default async (req: Request, context: Context) => {
  const env: Record<string, string | undefined> = {}
  for (const k of ENV_KEYS) env[k] = Netlify.env.get(k)
  return handleCalcFull(req, { env, count: makeCounter(context) })
}

export const config: Config = { path: "/api/calc-full", method: "POST" }
