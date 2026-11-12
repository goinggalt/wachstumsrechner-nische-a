// Single-tier simplification of the Google Sheet "Wachstumsmodell Nische A v1".
// The Sheet is the single source of truth. Regression cases live in its tab "Web-Testfälle".
// Brief v3 (November 5, 2026): step 0 question decides path M (membership) or path O (one-time offer).

export const SHARED = {
  target:    { label: "Ziel-Jahresumsatz", kind: "money" },
  other_rev: { label: "Sonstiger Jahresumsatz", kind: "money" },
  list:      { label: "E-Mail-Liste", kind: "count" },
  events:    { label: "Kostenlose Einstiegsangebote pro Monat", kind: "count" },
  reg:       { label: "Anmeldequote", kind: "percent" },
  show:      { label: "Teilnahmequote", kind: "percent" },
  e2m:       { label: "Conversion Einstieg zu zahlendem Kunden", kind: "percent" },
  other_new: { label: "Neue zahlende Kunden aus anderen Wegen", kind: "count" },
};
export const PATH_M = {
  price:   { label: "Durchschnittlicher Mitgliedspreis", kind: "money" },
  churn:   { label: "Kündigungsquote", kind: "percent", positive: true },
  members: { label: "Mitglieder heute", kind: "count" },
};
export const PATH_O = {
  price_once: { label: "Durchschnittlicher Preis des Hauptangebots", kind: "money" },
};
export const fieldsFor = (path) => ({ ...SHARED, ...(path === "M" ? PATH_M : PATH_O) });

export const BRIDGE_O =
  "Ohne wiederkehrende Einnahmen müssen Sie Ihren Umsatz jedes Jahr neu erzielen. Ob eine Mitgliedschaft oder ein Abo für Sie sinnvoll ist, klären wir in der Wachstumsdiagnose.";

// Upper bounds only to reject nonsense and abuse, not business rules.
const MAX = { money: 1e9, count: 1e7, percent: 100 };

function readMembership(x) {
  if (x === true || x === "ja" || x === "Ja") return true;
  if (x === false || x === "nein" || x === "Nein") return false;
  return undefined;
}

export function validate(raw) {
  if (!raw || typeof raw !== "object") return { errors: { _form: "Ungültige Anfrage." } };
  const has = readMembership(raw.has_membership);
  if (has === undefined) return { errors: { has_membership: "Bitte wählen Sie Ja oder Nein." } };
  const path = has ? "M" : "O";
  const errors = {};
  const values = { has_membership: has, path };
  for (const [key, f] of Object.entries(fieldsFor(path))) {
    const v = typeof raw[key] === "string" ? Number(raw[key].replace(",", ".")) : raw[key];
    if (typeof v !== "number" || !Number.isFinite(v)) { errors[key] = "Bitte eine Zahl eingeben."; continue; }
    if (v < 0) { errors[key] = "Der Wert darf nicht negativ sein."; continue; }
    if (f.kind === "percent" && v > 100) { errors[key] = "Bitte einen Prozentwert zwischen 0 und 100 eingeben."; continue; }
    if (v > MAX[f.kind]) { errors[key] = "Der Wert ist unrealistisch hoch."; continue; }
    if (f.positive && v <= 0) { errors[key] = "Die Kündigungsquote muss größer als 0 sein."; continue; }
    values[key] = f.kind === "percent" ? v / 100 : v;
  }
  return Object.keys(errors).length ? { errors } : { values };
}

function calcM(v) {
  const registrations = v.events * v.list * v.reg;
  const attendees = registrations * v.show;
  const new_members = attendees * v.e2m + v.other_new;
  const ceiling = new_members / v.churn;
  const recurring_eq = ceiling * v.price * 12;
  const revenue_eq = recurring_eq + v.other_rev;
  const gap = revenue_eq - v.target;
  const per_attendee = (v.e2m * v.price * 12) / v.churn;
  const other_ways = (v.other_new * v.price * 12) / v.churn;
  const needed_att = per_attendee > 0 ? (v.target - v.other_rev - other_ways) / per_attendee : null;
  const factor = needed_att !== null && attendees > 0 ? needed_att / attendees : null;
  return { path: "M", registrations, attendees, new_members, ceiling, revenue: revenue_eq, revenue_eq, gap, needed_att, factor };
}

function calcO(v) {
  const registrations = v.events * v.list * v.reg;
  const attendees = registrations * v.show;
  const new_customers = attendees * v.e2m + v.other_new; // per month
  const customers_year = new_customers * 12;
  const revenue_now = customers_year * v.price_once + v.other_rev;
  const gap = revenue_now - v.target;
  const per_attendee = v.e2m * 12 * v.price_once;
  const other_ways = v.other_new * 12 * v.price_once;
  const needed_att = per_attendee > 0 ? (v.target - v.other_rev - other_ways) / per_attendee : null;
  const factor = needed_att !== null && attendees > 0 ? needed_att / attendees : null;
  return { path: "O", registrations, attendees, new_customers, customers_year, revenue: revenue_now, revenue_now, gap, needed_att, factor };
}

export const calc = (v) => (v.path === "M" ? calcM(v) : calcO(v));

const nf0 = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const eur = (x) => `${nf0.format(Math.round(x))} €`;

export function output1(v, r) {
  if (r.path === "O") {
    const n = Math.round(r.customers_year);
    return {
      path: "O",
      text: `Heute gewinnen Sie etwa ${nf0.format(n)} zahlende Kunden pro Jahr.`,
      customers_year: n,
      shrinking: false,
      bridge: BRIDGE_O,
    };
  }
  const ceiling = nf0.format(Math.round(r.ceiling));
  const members = nf0.format(Math.round(v.members));
  const shrinking = v.members > r.ceiling;
  const text = shrinking
    ? `Ihr Bestand schrumpft: Bei diesem Zufluss trägt das Geschäft dauerhaft etwa ${ceiling} Mitglieder, heute sind es ${members}.`
    : `Ihr Bestand wächst langfristig auf etwa ${ceiling} Mitglieder.`;
  return { path: "M", text, ceiling: Math.round(r.ceiling), members: Math.round(v.members), shrinking };
}

export function outputs23(v, r) {
  const lead = r.path === "M"
    ? `Wenn alles so bleibt wie heute, pendelt sich Ihr Jahresumsatz bei etwa ${eur(r.revenue)} ein.`
    : `Wenn alles so bleibt wie heute, liegt Ihr Jahresumsatz bei etwa ${eur(r.revenue)}.`;
  const o2 = r.gap < 0
    ? `${lead} Ihr Ziel: ${eur(v.target)}. Lücke: ${eur(-r.gap)}.`
    : `${lead} Ihr Ziel: ${eur(v.target)}. Sie liegen ${eur(r.gap)} über Ihrem Ziel.`;
  let o3;
  if (r.needed_att === null) {
    o3 = "Ohne Kunden aus Ihrem kostenlosen Angebot lässt sich der Bedarf an Teilnehmern nicht berechnen.";
  } else if (r.needed_att <= 0) {
    o3 = "Ihr Ziel erreichen Sie bereits über andere Wege.";
  } else if (r.factor === null) {
    o3 = `Für Ihr Ziel bräuchten Sie etwa ${nf0.format(Math.round(r.needed_att))} Teilnehmer an Ihren kostenlosen Angeboten pro Monat, heute sind es 0.`;
  } else {
    o3 = `Für Ihr Ziel bräuchten Sie etwa ${nf0.format(Math.round(r.needed_att))} Teilnehmer an Ihren kostenlosen Angeboten pro Monat, heute sind es ${nf0.format(Math.round(r.attendees))} (Faktor ${nf1.format(r.factor)}x).`;
  }
  const out = {
    output2: o2,
    output3: o3,
    gap: Math.round(r.gap),
    needed_att: r.needed_att === null ? null : Math.round(r.needed_att * 10) / 10,
    factor: r.factor === null ? null : Math.round(r.factor * 10) / 10,
  };
  if (r.path === "M") out.revenue_eq = Math.round(r.revenue_eq);
  else out.revenue_now = Math.round(r.revenue_now);
  return out;
}
