import { validate, calc, output1, outputs23 } from "./model.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });

async function readBody(req) {
  if (req.method !== "POST") return { error: json({ error: "Nur POST erlaubt." }, 405) };
  const text = await req.text();
  if (text.length > 10_000) return { error: json({ error: "Anfrage zu groß." }, 413) };
  try { return { body: JSON.parse(text) }; } catch { return { error: json({ error: "Ungültige Anfrage." }, 400) }; }
}

// Step 1: output 1 only, no email.
export async function handleCalc(req, deps = {}) {
  const { body, error } = await readBody(req);
  if (error) return error;
  const { values, errors } = validate(body?.inputs);
  if (errors) return json({ errors }, 422);
  const r = calc(values);
  deps.count?.("step1_completed");
  return json({ output1: output1(values, r) });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function brevoAttributes(raw, values, o1, o23, consent) {
  const pct = (x) => Math.round(x * 10000) / 100;
  const m = values.path === "M";
  // Attributes of the other path are sent empty, so an old value on an updated contact is cleared.
  return {
    RECHNER_HAS_MEMBERSHIP: values.has_membership,
    RECHNER_PATH: values.path,
    RECHNER_TARGET: values.target,
    RECHNER_OTHER_REV: values.other_rev,
    RECHNER_LIST: values.list,
    RECHNER_EVENTS: values.events,
    RECHNER_REG_PCT: pct(values.reg),
    RECHNER_SHOW_PCT: pct(values.show),
    RECHNER_E2M_PCT: pct(values.e2m),
    RECHNER_OTHER_NEW: values.other_new,
    RECHNER_PRICE: m ? values.price : "",
    RECHNER_CHURN_PCT: m ? pct(values.churn) : "",
    RECHNER_MEMBERS: m ? values.members : "",
    RECHNER_CEILING: m ? o1.ceiling : "",
    RECHNER_REVENUE_EQ: m ? o23.revenue_eq : "",
    RECHNER_PRICE_ONCE: m ? "" : values.price_once,
    RECHNER_CUSTOMERS_YEAR: m ? "" : o1.customers_year,
    RECHNER_REVENUE_NOW: m ? "" : o23.revenue_now,
    RECHNER_GAP: o23.gap,
    RECHNER_NEEDED_ATT: o23.needed_att ?? "",
    RECHNER_FACTOR: o23.factor ?? "",
    CONSENT_RESULT: true,
    CONSENT_RESULT_AT: consent.at,
    CONSENT_TEXT_VERSION: consent.version,
    NEWSLETTER_REQUESTED: consent.newsletter,
    NEWSLETTER_REQUESTED_AT: consent.newsletter ? consent.at : "",
    LEAD_SOURCE: "web-rechner-nische-a",
  };
}

async function brevo(fetchFn, apiKey, path, payload) {
  const res = await fetchFn(`https://api.brevo.com/v3${path}`, {
    method: "POST",
    headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Brevo ${path} ${res.status} ${detail.slice(0, 300)}`);
  }
}

// Step 2: outputs 2 and 3, Brevo contact, result email, optional newsletter DOI.
export async function handleCalcFull(req, deps) {
  const { env, fetchFn = fetch, now = () => new Date(), count, log = console.error } = deps;
  const { body, error } = await readBody(req);
  if (error) return error;

  const { values, errors } = validate(body?.inputs);
  if (errors) return json({ errors }, 422);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length > 254) return json({ errors: { email: "Bitte eine gültige E-Mail-Adresse eingeben." } }, 422);
  if (body.consent_result !== true) return json({ errors: { consent_result: "Bitte bestätigen Sie den Versand des Ergebnisses per E-Mail." } }, 422);

  const r = calc(values);
  const o1 = output1(values, r);
  const o23 = outputs23(values, r);
  const result = { output1: o1, ...o23 };

  // Honeypot: answer like a success, but create no contact and send nothing.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return json({ ...result, emailSent: true });
  }

  count?.("email_submitted");
  const newsletter = body.newsletter === true;
  const consent = { at: now().toISOString(), version: env.CONSENT_TEXT_VERSION || "unbekannt", newsletter };
  const apiKey = env.BREVO_API_KEY;
  let emailSent = false;
  try {
    if (!apiKey) throw new Error("BREVO_API_KEY fehlt");
    await brevo(fetchFn, apiKey, "/contacts", {
      email,
      attributes: brevoAttributes(body.inputs, values, o1, o23, consent),
      listIds: [Number(env.BREVO_LIST_LEADS)],
      updateEnabled: true,
    });
    await brevo(fetchFn, apiKey, "/smtp/email", {
      to: [{ email }],
      templateId: Number(env.BREVO_TEMPLATE_RESULT),
      params: {
        OUTPUT1: o1.text,
        OUTPUT2: o23.output2,
        OUTPUT3: o23.output3,
        NOTE: o1.bridge || "",
        CALENDLY_URL: env.CALENDLY_URL || "",
      },
    });
    emailSent = true;
    if (newsletter) {
      await brevo(fetchFn, apiKey, "/contacts/doubleOptinConfirmation", {
        email,
        includeListIds: [Number(env.BREVO_LIST_NEWSLETTER)],
        templateId: Number(env.BREVO_TEMPLATE_DOI),
        redirectionUrl: env.BREVO_DOI_REDIRECT_URL,
      });
    }
  } catch (e) {
    log(String(e));
  }
  // Outputs are shown immediately, whatever happened with the email.
  return json({ ...result, emailSent });
}

const ALLOWED_EVENTS = new Set(["calc_started", "calendly_click"]);

export async function handleTrack(req, deps) {
  const { body, error } = await readBody(req);
  if (error) return error;
  if (!ALLOWED_EVENTS.has(body?.event)) return json({ error: "Unbekanntes Ereignis." }, 400);
  deps.count?.(body.event);
  return new Response(null, { status: 204 });
}
