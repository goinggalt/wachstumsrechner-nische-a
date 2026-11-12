import { test } from "node:test";
import assert from "node:assert/strict";
import { validate, calc, output1, outputs23 } from "../netlify/lib/model.mjs";
import { handleCalc, handleCalcFull, handleTrack } from "../netlify/lib/handlers.mjs";

// Same cases as tab "Web-Testfälle" in the Google Sheet. Percent inputs as entered on the page.
// Path M (membership). F was called D until November 5, 2026 (brief v3 gives D and E to path O).
const M = { has_membership: true };
const CASES = {
  A: { in: { ...M, target: 300000, other_rev: 75000, list: 4000, events: 2, reg: 3, show: 35, e2m: 4, other_new: 3, price: 60, churn: 5.4, members: 155 },
       exp: { ceiling: 117.8, revenue_eq: 159800, gap: -140200, needed_att: 346.9, factor: 4.13 } },
  B: { in: { ...M, target: 150000, other_rev: 20000, list: 6000, events: 3, reg: 4, show: 40, e2m: 5, other_new: 2, price: 45, churn: 4, members: 80 },
       exp: { ceiling: 410.0, revenue_eq: 241400, gap: 91400, needed_att: 152.6, factor: 0.53 } },
  C: { in: { ...M, target: 100000, other_rev: 10000, list: 8000, events: 2, reg: 5, show: 45, e2m: 6, other_new: 5, price: 50, churn: 3, members: 300 },
       exp: { ceiling: 886.7, revenue_eq: 542000, gap: 442000, needed_att: -8.3, factor: null } },
  F: { in: { ...M, target: 300000, other_rev: 74376, list: 4000, events: 2, reg: 3, show: 35, e2m: 4, other_new: 3, price: 64.5, churn: 5.35, members: 155 },
       exp: { ceiling: 118.9, revenue_eq: 166388, gap: -133612, needed_att: 314.9, factor: 3.75 } },
};
// Path O (no membership, one-time main offer). Expected values from the brief, confirmed in the Sheet.
const O = { has_membership: false };
const CASES_O = {
  D: { in: { ...O, target: 600000, other_rev: 50000, list: 6000, events: 2, reg: 2, show: 50, e2m: 8, other_new: 1, price_once: 6000 },
       exp: { customers_year: 127.2, revenue_now: 813200, gap: 213200, needed_att: 83.0, factor: 0.69 } },
  E: { in: { ...O, target: 300000, other_rev: 0, list: 3000, events: 1, reg: 3, show: 40, e2m: 5, other_new: 0.5, price_once: 2500 },
       exp: { customers_year: 27.6, revenue_now: 69000, gap: -231000, needed_att: 190.0, factor: 5.28 } },
};

for (const [name, c] of Object.entries(CASES)) {
  test(`Fall ${name} trifft das Sheet (Pfad M)`, () => {
    const { values, errors } = validate(c.in);
    assert.equal(errors, undefined);
    const r = calc(values);
    assert.equal(r.path, "M");
    assert.ok(Math.abs(r.ceiling - c.exp.ceiling) < 0.1, `ceiling ${r.ceiling}`);
    assert.ok(Math.abs(r.revenue_eq - c.exp.revenue_eq) < 1, `revenue ${r.revenue_eq}`);
    assert.ok(Math.abs(r.gap - c.exp.gap) < 1, `gap ${r.gap}`);
    assert.ok(Math.abs(r.needed_att - c.exp.needed_att) < 0.1, `needed ${r.needed_att}`);
    if (c.exp.factor !== null) assert.ok(Math.abs(r.factor - c.exp.factor) < 0.01, `factor ${r.factor}`);
  });
}

for (const [name, c] of Object.entries(CASES_O)) {
  test(`Fall ${name} trifft das Sheet (Pfad O)`, () => {
    const { values, errors } = validate(c.in);
    assert.equal(errors, undefined);
    const r = calc(values);
    assert.equal(r.path, "O");
    assert.ok(Math.abs(r.customers_year - c.exp.customers_year) < 0.1, `customers ${r.customers_year}`);
    assert.ok(Math.abs(r.revenue_now - c.exp.revenue_now) < 1, `revenue ${r.revenue_now}`);
    assert.ok(Math.abs(r.gap - c.exp.gap) < 1, `gap ${r.gap}`);
    assert.ok(Math.abs(r.needed_att - c.exp.needed_att) < 0.1, `needed ${r.needed_att}`);
    assert.ok(Math.abs(r.factor - c.exp.factor) < 0.01, `factor ${r.factor}`);
  });
}

test("Pfad O: Texte und Brücke zur Diagnose", () => {
  const { values } = validate(CASES_O.D.in);
  const r = calc(values);
  const o1 = output1(values, r);
  assert.equal(o1.text, "Heute gewinnen Sie etwa 127 zahlende Kunden pro Jahr.");
  assert.match(o1.bridge, /^Ohne wiederkehrende Einnahmen müssen Sie Ihren Umsatz jedes Jahr neu erzielen\./);
  const o = outputs23(values, r);
  assert.match(o.output2, /^Wenn alles so bleibt wie heute, liegt Ihr Jahresumsatz bei etwa 813\.200 €\./);
  assert.match(o.output3, /etwa 83 Teilnehmer an Ihren kostenlosen Angeboten pro Monat, heute sind es 120 \(Faktor 0,7x\)/);
  const e = validate(CASES_O.E.in).values;
  assert.match(outputs23(e, calc(e)).output2, /Lücke: 231\.000 €/);
});

test("Schritt 0 fehlt oder ungültig: abgelehnt", () => {
  const { has_membership, ...rest } = CASES.A.in;
  assert.ok(validate(rest).errors.has_membership);
  assert.ok(validate({ ...rest, has_membership: "vielleicht" }).errors.has_membership);
});

test("Pfad O braucht keine Mitgliedsfelder, Pfad M schon", () => {
  assert.equal(validate(CASES_O.D.in).errors, undefined);
  const { churn, ...noChurn } = CASES.A.in;
  assert.ok(validate(noChurn).errors.churn);
  assert.ok(validate({ ...CASES_O.D.in, price_once: -1 }).errors.price_once);
});

test("Fall C zeigt die Randfall-Meldung", () => {
  const { values } = validate(CASES.C.in);
  assert.equal(outputs23(values, calc(values)).output3, "Ihr Ziel erreichen Sie bereits über andere Wege.");
});

test("Deutsches Zahlenformat in den Texten", () => {
  const { values } = validate(CASES.A.in);
  const o = outputs23(values, calc(values));
  assert.match(o.output2, /159\.800 €/);
  assert.match(o.output3, /Faktor 4,1x/);
  assert.match(o.output2, /Lücke: 140\.200 €/);
  const b = validate(CASES.B.in).values;
  assert.match(outputs23(b, calc(b)).output2, /91\.400 € über Ihrem Ziel/);
});

const post = (body) => new Request("https://x.test/api", { method: "POST", body: JSON.stringify(body) });

test("Ungültige Eingaben werden abgelehnt", async () => {
  for (const bad of [{ churn: 0 }, { reg: 120 }, { list: -5 }, { price: "abc" }]) {
    const res = await handleCalc(post({ inputs: { ...CASES.A.in, ...bad } }));
    assert.equal(res.status, 422, JSON.stringify(bad));
  }
  assert.equal((await handleCalc(new Request("https://x.test", { method: "GET" }))).status, 405);
});

test("Schritt 1 liefert nur Ausgabe 1", async () => {
  const body = await (await handleCalc(post({ inputs: CASES.A.in }))).json();
  assert.ok(body.output1.text.startsWith("Ihr Bestand schrumpft"));
  assert.equal(body.output2, undefined);
});

function mockFetch() {
  const calls = [];
  const fn = async (url, opts) => { calls.push({ url, body: JSON.parse(opts.body) }); return new Response("{}", { status: 201 }); };
  return { fn, calls };
}
const ENV = { BREVO_API_KEY: "k", BREVO_LIST_LEADS: "3", BREVO_LIST_NEWSLETTER: "4", BREVO_TEMPLATE_RESULT: "7",
  BREVO_TEMPLATE_DOI: "8", BREVO_DOI_REDIRECT_URL: "https://de.example/danke", CALENDLY_URL: "https://calendly.com/x", CONSENT_TEXT_VERSION: "v1" };
const full = { inputs: CASES.A.in, email: "Test@Example.com", consent_result: true };

test("Honeypot ausgefüllt: kein Brevo-Kontakt", async () => {
  const m = mockFetch();
  const res = await handleCalcFull(post({ ...full, website: "spam" }), { env: ENV, fetchFn: m.fn });
  assert.equal(res.status, 200);
  assert.equal(m.calls.length, 0);
});

test("Newsletter nicht angehakt: keine Double-Opt-in-Mail", async () => {
  const m = mockFetch();
  const body = await (await handleCalcFull(post(full), { env: ENV, fetchFn: m.fn })).json();
  assert.equal(body.emailSent, true);
  assert.deepEqual(m.calls.map((c) => new URL(c.url).pathname), ["/v3/contacts", "/v3/smtp/email"]);
  assert.equal(m.calls[0].body.email, "test@example.com");
  assert.equal(m.calls[0].body.attributes.LEAD_SOURCE, "web-rechner-nische-a");
  assert.equal(m.calls[0].body.attributes.NEWSLETTER_REQUESTED, false);
});

test("Newsletter angehakt: Double-Opt-in wird ausgelöst", async () => {
  const m = mockFetch();
  await handleCalcFull(post({ ...full, newsletter: true }), { env: ENV, fetchFn: m.fn });
  assert.equal(new URL(m.calls[2].url).pathname, "/v3/contacts/doubleOptinConfirmation");
  assert.deepEqual(m.calls[2].body.includeListIds, [4]);
});

test("Ohne Einwilligung kein Versand", async () => {
  const m = mockFetch();
  const res = await handleCalcFull(post({ ...full, consent_result: false }), { env: ENV, fetchFn: m.fn });
  assert.equal(res.status, 422);
  assert.equal(m.calls.length, 0);
});

test("Brevo-Fehler: Ergebnis wird trotzdem angezeigt", async () => {
  const fn = async () => new Response("boom", { status: 500 });
  const body = await (await handleCalcFull(post(full), { env: ENV, fetchFn: fn, log: () => {} })).json();
  assert.equal(body.emailSent, false);
  assert.ok(body.output2.includes("Lücke"));
});

test("Pfad O: Brevo-Attribute und Hinweis in der Ergebnis-Mail", async () => {
  const m = mockFetch();
  await handleCalcFull(post({ ...full, inputs: CASES_O.D.in }), { env: ENV, fetchFn: m.fn });
  const a = m.calls[0].body.attributes;
  assert.equal(a.RECHNER_PATH, "O");
  assert.equal(a.RECHNER_HAS_MEMBERSHIP, false);
  assert.equal(a.RECHNER_PRICE_ONCE, 6000);
  assert.equal(a.RECHNER_CUSTOMERS_YEAR, 127);
  assert.equal(a.RECHNER_REVENUE_NOW, 813200);
  assert.equal(a.RECHNER_CEILING, "");
  assert.equal(a.RECHNER_CHURN_PCT, "");
  assert.ok(m.calls[1].body.params.NOTE.startsWith("Ohne wiederkehrende Einnahmen"));
});

test("Tracking nimmt nur bekannte Ereignisse an", async () => {
  assert.equal((await handleTrack(post({ event: "calendly_click" }), {})).status, 204);
  assert.equal((await handleTrack(post({ event: "x" }), {})).status, 400);
});
