# Coursework audit — NB6007CEM

> Official-document review (2026-10-04): [OFFICIAL-ASSESSMENT-AUDIT.md](report/OFFICIAL-ASSESSMENT-AUDIT.md) supersedes earlier compliance conclusions. Technical PASS rows do not establish assessment eligibility or full CRUD compliance.

Initial audit: 2026-09-29; production follow-up: 2026-10-03 (Asia/Colombo). **Locally and live verified.** Production evidence is recorded in report/LIVE-DEPLOYMENT-VERIFICATION.json. The original audit is in `report/INITIAL-AUDIT.md`.

| Requirement | Status | Evidence | File/Route | Notes |
| --- | --- | --- | --- | --- |
| Architecture | PASS | Existing route → middleware → controller → service → model structure preserved | src/ | Collection query service added; no frontend |
| Data model | PASS | Six schemas; real DB integrity checks | src/models/ | Province → District → Substation → SolarInstallation → GenerationReading; User; no Device collection |
| Seed data | PASS | Full MongoDB execution; 9/25/27/200/134400/227 counts; repeatability checked | scripts/seed.js; tests/seed.test.js | 672 samples per installation; synthetic measurements; fixed SEED_END |
| API design | PASS | Nested and top-level collection reads exercised | src/routes/ | Noun resources, /api/v1, safe GET and creating POST |
| CRUD | UNRESOLVED | Create/read and immutable history tested; update/delete absent | tests/api.test.js; report/OFFICIAL-ASSESSMENT-AUDIT.md | Official brief requires both append-only readings and CRUD semantics; rubric explicitly asks full CRUD. Clarification required. |
| Pagination | PASS | Counts, bounded limits, empty/beyond pages and links tested | utils/pagination.js; collectionService.js | History database pagination; small nested geography lists sliced after authorized selection |
| Filtering | PASS | Province/district/substation intersection; time bounds; injection-shaped/unknown/repeated query rejection | collectionService.js; readingService.js | Top-level conflicting filters yield empty; nested mismatches 403 |
| Sorting | PASS | timestamp and -timestamp tested | readingService.js; collectionService.js | Newest first by default; global ties use _id |
| Conditional GET | PASS | ETag, weak/list/* matching, 304 body, date precision, precedence, 412 tests | utils/etag.js | ETag-only where no reliable Last-Modified exists |
| Error handling | PASS | JSON envelopes on 400/401/403/404/406/409/412/413/415; handler covers 429/500/503 | middleware/error.js; app.js | 429/503 handling reviewed; not all infrastructure failures fault-injected |
| Authentication | PASS | Login, bcrypt, JWT claims, invalid/expired tokens | authService.js; middleware/auth.js | HS256; no password in token; current user read per request |
| Authorization | PASS | National/province/district/device tests across collections, nested reads, composite, last, summary and POST | middleware/auth.js; services/accessService.js | Scope remains server-enforced; filters only narrow |
| Swagger | PASS (local) | Formal OpenAPI validation, concrete response schemas, assets served | src/docs/openapi.js; /docs; /openapi.json | Live Vercel HTML/JS assets verified 2026-10-03 |
| MongoDB export | PASS | All six collections exported then imported into second isolated DB; BSON dates/IDs and counts checked | scripts/export-seed.js; tests/seed.test.js | Canonical Extended JSON; actual DB export; mongoimport CLI itself unavailable |
| MongoDB import/indexes | PASS (driver) | Export round trip and npm run indexes executed | scripts/create-indexes.js; README | Official mongoimport commands documented; that binary not installed |
| Vercel readiness | PASS (Production) | Production build ready; live HTTP and Swagger assets passed | api/index.js; vercel.json | Preview browser smoke passed; extended automated suite blocked by Vercel protection |
| Atlas compatibility | PASS | Atlas seed and counts verified; deployed health connected | config/database.js; .env.example | Credentials never disclosed |
| District summary | PASS | Actual MongoDB lookups; expected power/energy assertion; future record excluded; stable ETag | summaryService.js | Baseline at/before midnight, fallback first today; reset/missing-data undercount documented |

## Complete requirement mapping

| Prompt section | Status | Evidence / interpretation |
| --- | --- | --- |
| 1 Domain | PASS | Six collections and hierarchy; no separate Device |
| 2 Initial audit | PASS | All repository implementation/config/docs/tests inspected; INITIAL-AUDIT.md created before edits |
| 3 Technology | PASS | Node 22, Express 5, Mongoose 8, bcryptjs/JWT, OpenAPI 3 |
| 4 Architecture | PASS | Existing layers retained |
| 5 Models/indexes | PASS | Optional identifier collision fixed; unique installation/timestamp; finite readings; role/scope consistency |
| 6 Seed | PASS | 134400 records, 15 minutes, 7 calendar-day reporting slots, deterministic values for fixed window |
| 7 Export | PASS | Real MongoDB cursor export, canonical Extended JSON, import instructions |
| 8 Resources | PASS | Required plural top-level resources and nested routes |
| 9 Read hierarchy/composite | PASS | HTTP tests and hierarchy population |
| 10 Last reading | PASS | Queries history by descending timestamp |
| 11 History | PASS | Separate immutable historical collection |
| 12 Pagination | PASS | Collection envelope and validation |
| 13 Filtering | PASS | Authorized hierarchy intersection and inclusive dates |
| 14 Sorting | PASS | Whitelist, default descending, ascending tested |
| 15 Device POST | PASS | Own-installation JWT binding and negative tests |
| 16 Create semantics | PASS | 201, Location, JSON representation |
| 17 CRUD semantics | UNRESOLVED | GET/POST supported; no update/delete resource. See official assessment audit for conflicting requirements. |
| 18 Status codes | PASS | Meaningful statuses, 412 conditional GET and 204 CORS |
| 19 Headers | PASS | Content-Type, Location, ETag, Last-Modified where reliable |
| 20 Conditional GET | PASS | 304 with no body; precedence and precision regressions |
| 21 Errors | PASS | Consistent schema, production stack suppression |
| 22 Authentication | PASS | Login, bcrypt, explicit HS256 and subject validation |
| 23 Authorization | PASS | Jurisdiction and role checks, tested across required paths |
| 24 Summary | PASS | MongoDB aggregation and documented delta limitations |
| 25 OpenAPI | PASS (local) | Formal validator plus asset/endpoint tests |
| 26 Versioning | PASS | /api/v1; /health and docs infrastructure exceptions |
| 27 JSON negotiation | PASS | Accept wildcards/q values; JSON body content type |
| 28 Validation | PASS | IDs, strict dates, pagination, sort, finite nonnegative telemetry; unexpected body fields rejected |
| 29 Security | PASS (coursework scope) | CORS, Helmet, process-local limiter, body limit, private caches, no production secrets |
| 30 Vercel | PASS | Production deployed and live invocation verified |
| 31 Atlas | PASS | Actual Atlas reseed, counts and production connectivity verified |
| 32 Health | PASS | Database-connected health verified by HTTP |
| 33 Runtime checks | PASS | Local tests plus read-only hosted smoke checks |
| 34 Automated suite | PASS | Jest/Supertest, isolated database; no production deletion; no forceExit |
| 35 Code quality | PASS | ESLint clean; lockfile; removed destructive/dead reading methods |
| 36 README | PASS | All requested sections and reproducible commands |
| 37 Demo users | PASS | Fictional example.test accounts and bcrypt hashes |
| 38 Response consistency | PASS | Collections data/meta/links; resources and login data; errors error |
| 39 Route audit | PASS | See report/ROUTE-AUDIT.md and generated OpenAPI |
| 40 Richardson | PASS | Level 2, no invented HATEOAS requirement |
| 41 Rubric audit | PASS | This document |
| 42 Honest claims | PASS | Verified local results distinguished from hosted blockers |
| 43 Preserve work | PASS | Targeted edits; architecture and useful code retained; no fabricated Git history |
| 44 AI disclosure | PASS (template) | Template updated; student must complete personal verification |
| 45 Final validation | PASS | Local tests plus successful Vercel production build and HTTP checks |
| 46 Final report | PASS | report/FINAL-REPORT.md and final response |
| 47 Quality gate | PASS (Production) | Local implementation and live Atlas/Vercel production checks complete; Preview configured and browser smoke passed; extended suite blocked by Vercel protection |

## Limits and blockers

Production deployment and Atlas connectivity verified on 2026-10-03. Live API: https://project-n8zne.vercel.app. Evidence: report/LIVE-DEPLOYMENT-VERIFICATION.json. Preview configuration and deployment verified on 2026-10-04 (Asia/Colombo). Browser smoke checks passed: Swagger renders, health returns 200 with MongoDB connected, and unauthenticated resource access returns 401. Vercel protection redirects public automated requests to sign-in, so the extended Preview suite remains unverified. Evidence: report/PREVIEW-DEPLOYMENT-VERIFICATION.json.

At the initial audit, no Atlas URI, Vercel authentication/project or Git repository was present. The user subsequently configured Atlas and GitHub; the project is now connected and deployed through the authenticated Vercel dashboard. MongoDB integration **was** runtime-tested using a real disposable local mongod; it would be inaccurate to say no MongoDB connection was available. Official mongoexport/mongoimport binaries were absent; the shipped Node exporter and a driver-based import were exercised instead.

Production deployment is evidenced by the live verification report. No screenshot evidence, student understanding or fabricated Git history is claimed. Seed/export data are test artifacts, not real solar telemetry. Seeding is deliberately destructive to six named collections only and requires explicit environment opt-in. Daily energy is an estimate between available meter samples and does not reconstruct meter resets. The limiter is process-local, and pagination count/items are separate reads rather than a transactional snapshot during concurrent ingestion.
