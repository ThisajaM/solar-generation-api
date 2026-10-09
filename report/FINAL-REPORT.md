# Final implementation report

> This AI-assisted engineering log is not the student-authored assessed report. The official-document review in OFFICIAL-ASSESSMENT-AUDIT.md supersedes earlier blanket compliance statements. The brief requires a 2250-2750-word student justification and prohibits AI-generated report prose.

**Later engineering update (2026-10-09):** The five-issues remediation added verified freshness, energy-quality, cursor, and authentication fixes. Its recorded isolated run passed 120 tests, and protected Preview and public Production each passed 17 smoke groups. See [FIVE-ISSUES-REMEDIATION.md](FIVE-ISSUES-REMEDIATION.md) and [TEST-RESULTS.md](TEST-RESULTS.md). The 82-test and 14-group figures below are dated earlier evidence. Full CRUD and personal submission requirements remain unresolved.

Initial report: 2026-09-29; deployment follow-up: 2026-10-03 (Asia/Colombo). Production deployment and Atlas connectivity verified on 2026-10-03. Live API: https://project-n8zne.vercel.app. Evidence: archive/LIVE-DEPLOYMENT-VERIFICATION.json. A new protected Preview passed all 14 smoke groups through authenticated CLI requests on 2026-10-04 (Asia/Colombo). Only then was a new Production deployment created; all 14 public production smoke groups passed. See archive/RELEASE-VERIFICATION.json, archive/NEW-PREVIEW-SMOKE.json and archive/NEW-PRODUCTION-SMOKE.json. Environment values were not recorded.

## 1. Overall status

**VERIFIED:** Express/Mongoose API, all six required entities, append-only readings, scoped JWT access, hierarchical and top-level reads, pagination/filtering/sorting, HTTP validators, summary calculations, full-size seed, BSON-preserving export/import, Swagger document/assets, and production-mode local HTTP startup.

**LIVE VERIFIED (2026-10-03):** Production build, Atlas health, Swagger HTML/JS, JWT login for all four demo roles, scoped reads, 134,400 readings and conditional HTTP behavior. **NOT VERIFIED:** official MongoDB Database Tools command execution. The subsequent protected Preview and public Production each passed all 14 smoke groups; see archive/RELEASE-VERIFICATION.json.

## 2. Files created

- `package-lock.json`: reproducible dependency resolution.
- `COURSEWORK-AUDIT.md`: rubric and all 47 prompt-section mappings.
- `archive/INITIAL-AUDIT.md`: issues identified before implementation.
- `FINAL-REPORT.md`: this report.
- `archive/ROUTE-AUDIT.md`: per-endpoint HTTP/security review.
- `TEST-RESULTS.md`: actual validation outcomes and limitations.
- `src/services/collectionService.js`: scoped top-level queries and consistent collection envelopes.
- `scripts/create-indexes.js`: non-destructive index creation after import.
- `scripts/validate-openapi.js`: formal specification validation.
- `tests/seed.test.js`: full database seed/reproducibility/export/import/startup validation.
- `tests/schema.test.js`: schema and OpenAPI regressions.
- `public/.gitkeep`: empty Vercel static output; no frontend.

## 3. Files modified

- `package.json`, `.env.example`, `.gitignore`, `eslint.config.js`, `vercel.json`, `README.md`.
- `scripts/seed.js`, `scripts/export-seed.js`.
- `src/app.js`, `src/server.js`, `src/config/env.js`, `src/config/database.js`.
- `src/models/SolarInstallation.js`, `src/models/GenerationReading.js`, `src/models/User.js`.
- `src/middleware/auth.js`, `src/middleware/error.js`, `src/utils/validate.js`, `src/utils/etag.js`.
- `src/routes/geography.js`, `src/routes/readings.js`.
- `src/controllers/authController.js`, `src/controllers/geographyController.js`, `src/controllers/readingController.js`, `src/controllers/summaryController.js`.
- `src/services/authService.js`, `src/services/readingService.js`, `src/services/summaryService.js`.
- `src/docs/openapi.js`, `src/docs/README.md`, `tests/api.test.js`, `AI-DISCLOSURE-TEMPLATE.md`.

Correct existing models, hierarchy services, utilities, route/controller separation and Vercel export entry were retained. There was no Git repository in this directory; no commits/history were created or fabricated.

## 4. Features implemented or repaired

1. Removed destructive reading PUT/DELETE paths, controllers and services.
2. Fixed device own-history/last-reading access by loading its authorized installation.
3. Added `/districts`, `/substations`, `/installations`, `/readings` collection endpoints with jurisdiction intersections.
4. Standardized collection envelopes and login under `data`.
5. Rejected malformed/calendar-invalid dates, unsafe page values, unknown/repeated queries and unexpected telemetry fields.
6. Corrected conditional header precedence, weak ETag handling, second-resolution HTTP dates and strong GET If-Match/412.
7. Added private authenticated caching, no-store token responses and CORS-exposed validators/Location.
8. Corrected JSON media/Accept handling and oversized/rate-limit errors.
9. Fixed optional sparse-unique meter/inverter null collisions and removed redundant reading timestamp index.
10. Enforced user role/scope consistency and explicit JWT algorithm/subject checks; reassigned devices invalidate previous installation tokens.
11. Added guarded full seeding, fixed-window reproducibility and fictional example.test users.
12. Replaced lossy export fallback with streamed canonical Extended JSON from MongoDB.
13. Improved daily energy baseline and stable summary ETags; documented stale data/reset limitations.
14. Replaced incomplete OpenAPI response definitions with concrete schemas, documented real endpoints only and validated the specification.
15. Hardened the Vercel function configuration and connection-promise reuse.

## 5. Database model

`Province → District → Substation → SolarInstallation → GenerationReading`, plus `User`.

Meter/inverter identifiers belong to SolarInstallation; there is no Device entity. Readings have installation, timestamp, powerKw, cumulativeEnergyKwh, voltage, frequencyHz and timestamps. Existing camelCase names are retained and explicitly documented as the equivalents of power_kw/cumulative_energy_kwh/meter_id in the brief. Readings use a unique `(installation, timestamp)` index and a timestamp index. All reference fields are checked by actual seeded-data joins; API ingestion verifies the installation before creating a reading. MongoDB itself does not enforce foreign keys for out-of-band administrator writes.

## 6. Seed statistics

Actual isolated MongoDB counts, not estimates:

| Collection | Count |
| --- | ---: |
| Provinces | 9 |
| Districts | 25 |
| Substations | 27 |
| Installations | 200 |
| Generation readings | 134,400 |
| Users | 227 |

Each installation has 672 samples spaced 15 minutes apart. The end-to-end test fixes the last sample to `2026-09-26T18:15:00Z`; seven days of reporting slots begin at `2026-09-19T18:30:00Z`. The first-to-last sample distance is seven days minus one interval, as expected for 672 slots. The solar curve follows Colombo daylight; nighttime values are zero. Every generation reading, installation, substation and district references an existing parent. A second seed produces identical measurement values for the same window; ObjectIds, timestamps and password salts are not intended to be byte-identical.

## 7. API endpoints

Public: `GET /health`, `GET /api/v1`, `POST /api/v1/auth/login`, Swagger `/docs`, raw `/openapi.json`.

Authenticated GET under `/api/v1`:

- `/provinces`, `/provinces/:provinceId`, `/provinces/:provinceId/districts`.
- `/districts`, `/districts/:districtId`, `/districts/:districtId/substations`, `/districts/:districtId/generation-summary`.
- `/substations`, `/substations/:substationId`, `/substations/:substationId/installations`.
- `/installations`, `/installations/:installationId`, `/installations/:installationId/composite`.
- `/installations/:installationId/last-reading`, `/installations/:installationId/readings`, `/installations/:installationId/readings/:readingId`.
- `/readings`.

Device POST: `/api/v1/installations/:installationId/readings`. Returns 201, Location and `{data: reading}`. Readings cannot be overwritten or deleted through HTTP. See archive/ROUTE-AUDIT.md for each endpoint's semantics.

## 8. Authentication

Bcrypt hashes; JWT HS256; Bearer header; necessary subject/role/scope/jurisdiction claims. Login returns the token at `data.token`. Current user activity and authorization are loaded server-side; sensitive hashes never appear in the token/login response. Demo credentials are local coursework credentials under example.test domains.

## 9. Authorization

National analysts see all jurisdictions; province analysts see their province; district analysts see their district and necessary ancestor metadata. Devices read their own installation/composite/history and append only there. Devices cannot list arbitrary jurisdictions, submit foreign readings, or administer users/geography. Top-level conflicting filters give empty results; nested history mismatches return 403. Tests cover totals and collections as well as atomic endpoints.

## 10. Swagger URL

Local: `http://localhost:3000/docs`; spec: `http://localhost:3000/openapi.json`. Live Swagger: https://project-n8zne.vercel.app/docs/; health: https://project-n8zne.vercel.app/health. Authorize with the bare token; Swagger supplies the Bearer prefix. `npm run docs:validate` verifies OpenAPI schemas and references.

## 11–13. MongoDB setup, export and import

Set `MONGODB_URI` to your named local/Atlas demo database in `.env`, and configure Atlas database user/network access. Use `SEED_CONFIRM=yes npm run seed` only on a disposable demo database. API, seed and exporter use that same URI.

`npm run export:seed` creates six files in `seed-output/` by reading actual MongoDB documents. Canonical Extended JSON preserves ObjectIds, dates and numeric types. Files contain password hashes and must not be published.

Install MongoDB Database Tools for official import. Set the shell URI to a separate destination and run the six `mongoimport --jsonArray --drop` commands in README. `--drop` replaces destination collections. Then run `npm run indexes` for the destination. The driver-based import round trip was tested; the official command binaries were not installed here.

## 14. Local run

Use Node 22.x. Run `npm install`, copy `.env.example` to `.env`, set MONGODB_URI/JWT_SECRET, seed the demo database, then `npm run dev` or `npm start`. This plain JavaScript backend needs no frontend build. `npm test`, `npm run lint`, and `npm run docs:validate` are the checks.

## 15. Vercel deployment

Authenticate/link with `npx vercel login` and `npx vercel link`, or import a real Git repository in Vercel. Use Node 22.x and Other preset; retain supplied vercel.json. Add MONGODB_URI, JWT_SECRET, JWT_EXPIRES_IN and CORS_ORIGIN for Preview/Production. Deploy a preview, verify `/health`, docs assets, login and scoped reads/ingestion, then deploy production. Seed Atlas separately from a trusted local process. The exported function requires no listener and caches the MongoDB connection.

Production deployment succeeded on 2026-10-03 from commit 62f733a; see archive/LIVE-DEPLOYMENT-VERIFICATION.json.

## 16. Environment variables

Required outside test mode: `MONGODB_URI`, `JWT_SECRET`. Optional: `JWT_EXPIRES_IN` (1h), `CORS_ORIGIN` (* or comma-separated origins), `PORT` (3000), `RATE_LIMIT_WINDOW_MS` (900000), `RATE_LIMIT_MAX` (300), `SEED_END`. Seeding requires explicit `SEED_CONFIRM=yes`. Application test mode requires a distinct `MONGODB_TEST_URI`; the automated suites create their own disposable database. Set NODE_ENV=production for local production-mode validation; Vercel sets its runtime environment.

## 17–18. Tests and results

See TEST-RESULTS.md for actual final counts and commands. Verification includes full seed twice, refusal of unconfirmed seeding, BSON export/import into another database, rebuilding indexes, all required read/write paths, authorization regressions, validator semantics, formal Swagger checks and production HTTP startup. Existing 25 tests were retained and expanded. Initial environment/validator failures were diagnosed and resolved; tests are not forced to exit.

## 19. Unresolved issues and practical limits

- New Preview and Production deployments each passed 14 smoke groups, with authenticated CLI access used for protected Preview. See archive/RELEASE-VERIFICATION.json.
- Official mongoexport/mongoimport executable behavior was not tested; equivalent Node exporter/driver round trip was.
- Summary daily energy cannot reconstruct meter resets or missing intervals; stale last-known power is explicitly documented.
- Process-local rate limiting is suitable for coursework, not a global distributed quota.
- Seed/export assumes a quiescent demo database. Seeding is not transactional; rerun after correcting a failed seed.
- MongoDB pagination count and items use separate queries and can change during concurrent ingestion.
- Existing deployments with historical data should back up and review index changes rather than assume a migration was run; this session changed no external database.

## 20. Rubric audit

COURSEWORK-AUDIT.md contains the requested table and every numbered prompt section. Functional local requirements pass; deployment-specific sections have been updated with the 2026-10-03 production evidence. Richardson Level 2 is deliberate. The official brief requires both append-only readings and CRUD semantics, and the rubric explicitly asks for full CRUD. No update/delete resource exists; this is an unresolved assessment issue, not confirmed full compliance. See OFFICIAL-ASSESSMENT-AUDIT.md.

## 21. Before submission

Atlas has been seeded and production deployed. Personally verify live behavior and retain the recorded URLs/results. Review the course rubric with the append-only design rationale. Complete the AI disclosure and personally rerun commands. Keep genuine process evidence; do not manufacture earlier commits or claim the AI's testing as work you personally performed.

## 22. Viva demonstration

Explain the six models and their indexes. Log in as national, province, district and device users. Show scoped collections and forbidden foreign access. POST a unique reading, follow Location, demonstrate duplicate 409 and absence of mutation routes. Show time windows, ascending/descending pagination, 304 with no body, GET If-Match/412, and district summary arithmetic. Export/reimport data, prove references remain ObjectIds and timestamps dates, and explain the serverless connection cache. Be candid about synthetic data, boundary estimates, deployment evidence and AI assistance.
