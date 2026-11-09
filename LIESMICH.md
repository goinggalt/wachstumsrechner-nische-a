# Wachstumsrechner Nische A (Netlify)

Seite: `public/wachstumsrechner/index.html` (URL `/wachstumsrechner/`)
Funktionen: `netlify/functions/` (`/api/calc`, `/api/calc-full`, `/api/track`, `/api/metrics`)
Rechenlogik: `netlify/lib/model.mjs` (Brief v3: Schritt 0 Mitgliedschaft ja/nein, Pfad M und Pfad O; Ein-Stufen-Vereinfachung des Google Sheets; Regressionsfälle im Tab "Web-Testfälle")
Tests: `npm install` und `npm test` (20 Tests: Pfad M Fälle A, B, C, F; Pfad O Fälle D, E; Schritt 0, Validierung je Pfad, Honeypot, Newsletter, Einwilligung, Brevo-Fehler, Brevo-Attribute Pfad O, Tracking)

## Vor dem Livegang ausfüllen
In der Seite (`CONFIG` oben im Script): `CALENDLY_URL`, `PRIVACY_URL`, Einwilligungstexte nach Prüfung.

Umgebungsvariablen in Netlify (Scope: Functions). Nie in den Code oder ins Chat-Fenster:
- `BREVO_API_KEY`
- `BREVO_LIST_LEADS` (ID der Liste für Rechner-Leads)
- `BREVO_LIST_NEWSLETTER` (ID der Newsletter-Liste)
- `BREVO_TEMPLATE_RESULT` (ID der Transaktions-Vorlage; Platzhalter `{{params.OUTPUT1}}`, `{{params.OUTPUT2}}`, `{{params.OUTPUT3}}`, `{{params.NOTE}}` (nur Pfad O, sonst leer), `{{params.CALENDLY_URL}}`)
- `BREVO_TEMPLATE_DOI` (ID der Double-Opt-in-Vorlage)
- `BREVO_DOI_REDIRECT_URL` (Danke-Seite nach Newsletter-Bestätigung)
- `CALENDLY_URL`
- `CONSENT_TEXT_VERSION` (z. B. `2026-11-v1`; bei jeder Textänderung erhöhen)
- `METRICS_KEY` (frei gewähltes Passwort zum Abrufen der Wochenzahlen)

Brevo-Kontaktattribute vorher anlegen (Name, Typ):
RECHNER_TARGET, RECHNER_OTHER_REV, RECHNER_LIST, RECHNER_EVENTS, RECHNER_REG_PCT, RECHNER_SHOW_PCT, RECHNER_E2M_PCT,
RECHNER_OTHER_NEW, RECHNER_PRICE, RECHNER_CHURN_PCT, RECHNER_MEMBERS, RECHNER_CEILING, RECHNER_REVENUE_EQ, RECHNER_GAP,
RECHNER_NEEDED_ATT, RECHNER_FACTOR, RECHNER_PRICE_ONCE, RECHNER_CUSTOMERS_YEAR, RECHNER_REVENUE_NOW (alle Zahl);
RECHNER_HAS_MEMBERSHIP, CONSENT_RESULT, NEWSLETTER_REQUESTED (Boolean);
RECHNER_PATH (Text, M oder O), CONSENT_RESULT_AT, NEWSLETTER_REQUESTED_AT, CONSENT_TEXT_VERSION, LEAD_SOURCE (Text).
Die Felder des jeweils anderen Pfads werden leer gesendet.

## Messung
Wöchentliche Zählung ohne Cookies und ohne personenbezogene Daten (Netlify Blobs): calc_started, step1_completed, email_submitted, calendly_click.
Abruf: GET `/api/metrics` mit Header `x-metrics-key: <METRICS_KEY>`.
Newsletter-Bestätigungen: in Brevo. Calendly-Buchungen: in Calendly.

## Deploy
Drag-and-drop-Deploys unterstützen keine Functions. Deploy über Git-Verbindung oder Netlify CLI (`netlify deploy --prod`).
