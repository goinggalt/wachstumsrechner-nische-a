import { getStore } from "@netlify/blobs";

// Privacy-friendly weekly counts: no cookies, no IPs, no personal data stored.
// Blobs has no atomic increment, so simultaneous requests can lose a count.
// Fine as a weekly trend at low volume; not an audit log.
function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return `${y}-W${String(w).padStart(2, "0")}`;
}

export function makeCounter(context) {
  return (event) => {
    const work = (async () => {
      const store = getStore("rechner-metrics");
      const key = isoWeek();
      const current = (await store.get(key, { type: "json" })) || {};
      current[event] = (current[event] || 0) + 1;
      await store.setJSON(key, current);
    })().catch((e) => console.error("metrics", String(e)));
    context?.waitUntil?.(work);
  };
}
export { isoWeek };
