# CutFit public page-view counter

Worker `cutfit-counter`, binding `COUNTER_DB` to a dedicated D1 database.
Run `schema.sql` once in that database's console; it does not reset counts.
Deploy `worker.mjs` using Cloudflare's Worker editor. No API keys belong in this repository.

`GET /views` reads the count; `POST /views` increments it atomically.
The website sends one POST per visible page load, not per calculation or language change.
Reloads and repeat visits count again. This is approximate page views, not unique people.
CORS/header checks block casual cross-site browser requests, not bots or spoofed HTTP clients.
No IP, identifiers, referrers, or cutting settings are stored in D1. Cloudflare processes
network metadata as the service provider; disable Worker observability if logs are not needed.
Free Workers/D1 quotas are account-wide; an exhausted quota makes the counter unavailable,
not a reason to auto-upgrade. Frontend failures must never block the calculator.

Tests: `node --test counter-worker/worker.test.mjs`
