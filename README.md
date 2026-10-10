# Real-Time Solar Generation Data API

REST API coursework (NB6007CEM) for the Sri Lanka Sustainable Energy Authority (SLSEA). There is no frontend: the HTTP API is the deliverable.

**Richardson Maturity Model:** this project targets **Level 2** (resources, HTTP methods, and meaningful status codes). Level 3 / HATEOAS is out of scope.

This repository includes AI-assisted code. You must disclose that assistance and be able to explain the implementation at viva. See `report/AI-DISCLOSURE-TEMPLATE.md`.

## Overview

The API models a geographic and metering hierarchy:

Province → District → Grid Substation → Solar Installation → Generation Reading (append-only time series)

Analysts authenticate with JWT and may only read data inside their jurisdiction. Metering **devices** authenticate with JWT bound to one installation and may append readings only for that installation.

## Technology Stack

- Node.js 22.x
- Express.js
- MongoDB with Mongoose
- JWT bearer authentication and bcryptjs password hashes
- OpenAPI 3.0.3 and Swagger UI
- Helmet, CORS, and rate limiting
- Jest + Supertest for automated tests
- Vercel serverless deployment (`api/index.js`)
- MongoDB Atlas for hosted data

## Architecture

```
src/
  config/         environment and MongoDB connection (cached for serverless)
  controllers/    HTTP adapters
  middleware/     authn/authz and errors
  models/         Mongoose schemas
  routes/         /api/v1 resource routes
  services/       business rules and queries
  utils/          validation, ETags, pagination
  docs/           OpenAPI document
  app.js          Express application
  server.js       local HTTP listener
scripts/          seed and mongoexport
tests/            Jest + Supertest
api/index.js      Vercel serverless entry
```

Request flow: Route → middleware → controller → service → model → MongoDB → JSON response.

## Domain Model

| Entity | Collection | Notes |
| --- | --- | --- |
| Province | `provinces` | name, code |
| District | `districts` | belongs to one province |
| GridSubstation | `substations` | belongs to one district; optional GeoJSON location |
| SolarInstallation | `solarinstallations` | `meterId` **or** `inverterId` (not a Device entity) |
| GenerationReading | `generationreadings` | historical time series; unique `(installation, timestamp)` |
| User | `users` | role + jurisdiction + password hash |

There is **no Device collection**. The meter/inverter identifier is stored on `SolarInstallation`. Last-known power is **not** stored on the installation; `GET .../last-reading` queries `GenerationReading`.

## Installation

```bash
npm install
cp .env.example .env
```

Edit `.env` with your Atlas URI and a strong `JWT_SECRET`. Never commit `.env`.

## Environment Variables

| Variable | Required | Example |
| --- | --- | --- |
| `MONGODB_URI` | yes (non-test) | `mongodb+srv://.../slsea_solar` |
| `JWT_SECRET` | yes (non-test) | long random string |
| `JWT_EXPIRES_IN` | no | `1h` |
| `CORS_ORIGIN` | no | `*` |
| `PORT` | no | `3000` |
| `MONGODB_TEST_URI` | tests if not using memory server | local test DB |
| `RATE_LIMIT_WINDOW_MS` | no | `900000` |
| `RATE_LIMIT_MAX` | no | `300` |
| `SEED_CONFIRM` | seed only | `yes` explicitly permits replacement |
| `SEED_END` | no | fixed ISO timestamp for reproducibility |

## MongoDB Setup

1. Create a MongoDB Atlas cluster (or run MongoDB locally).
2. Create a database user and allow your IP (or `0.0.0.0/0` for coursework demos only).
3. Set `MONGODB_URI` to the SRV connection string, including the database name (for example `slsea_solar`).
4. The API reuses a cached Mongoose connection, which is required on Vercel.

## Seed Data

```bash
SEED_CONFIRM=yes npm run seed
```

This connects to `MONGODB_URI`, **clears** the six domain collections, and inserts deterministic demo data (seeded PRNG, coursework constant `6007`):

- 9 provinces
- 25 districts
- 27 grid substations
- 200 solar installations
- 134,400 generation readings (200 × 7 days × 96 readings/day at **15-minute** intervals)
- Demo users (national, Western province, one analyst per district, one device user per installation)

The solar curve uses **Asia/Colombo** hours: near-zero at night, rising after ~06:00, peak around midday, falling toward ~18:00.

Set `SEED_END` to a fixed ISO timestamp for reproducible measurement values (the example environment fixes it to 2026-09-26T18:15:00Z). Unset it for the latest aligned 15-minute slot. IDs, document timestamps and bcrypt salts vary on each run. The measurements and hierarchy are reproducible for a fixed window. Substations, locations and measurements are synthetic coursework data, not actual SLSEA telemetry. Old fixed windows naturally produce zero daily energy on later dates.

Seeding requires `SEED_CONFIRM=yes`, creates indexes first, and replaces only the six domain collections. Use a dedicated demo database and stop ingestion while seeding/exporting. It is not a transaction: a failed seed can leave partial data; correct the problem and rerun. A successful seed creates **227 users**.

## MongoDB Export

`npm run export:seed` streams the actual connected MongoDB collections into **canonical Extended JSON v2** arrays. ObjectIds and dates keep their BSON types when imported. This is a database export, not a copy of the seed source. No Database Tools installation is required for this Node driver exporter.

```bash
npm run export:seed
```

Outputs: `seed-output/provinces.json`, `districts.json`, `substations.json`, `solarinstallations.json`, `generationreadings.json`, and `users.json`.

Users contain password hashes. Export files are gitignored and created with owner-only permissions. Do not publish them. For the official tooling alternative, install [MongoDB Database Tools](https://www.mongodb.com/docs/database-tools/installation/) and run `mongoexport --uri "$MONGODB_URI" --collection provinces --out provinces.json --jsonArray --jsonFormat=canonical`, repeating for each collection. Shell commands need the variable exported in your shell; a `.env` file is loaded automatically only by the Node scripts.

`generationreadings.json` is large (100k+ documents).

## MongoDB Import

Install MongoDB Database Tools for `mongoimport`. Set the shell variable `MONGODB_URI` to the **new target database**, then run the commands below. `--drop` deletes each existing target collection; use only a disposable or backed-up destination. All six exports must come from the same quiescent source database. Extended JSON is required to restore BSON types ([MongoDB import documentation](https://www.mongodb.com/docs/database-tools/mongoimport/)).

```bash
mongoimport --uri "$MONGODB_URI" --collection provinces --file seed-output/provinces.json --jsonArray --drop
mongoimport --uri "$MONGODB_URI" --collection districts --file seed-output/districts.json --jsonArray --drop
mongoimport --uri "$MONGODB_URI" --collection substations --file seed-output/substations.json --jsonArray --drop
mongoimport --uri "$MONGODB_URI" --collection solarinstallations --file seed-output/solarinstallations.json --jsonArray --drop
mongoimport --uri "$MONGODB_URI" --collection generationreadings --file seed-output/generationreadings.json --jsonArray --drop
mongoimport --uri "$MONGODB_URI" --collection users --file seed-output/users.json --jsonArray --drop
```

The import does not restore indexes. Run `npm run indexes` against the target after import to create the schema indexes without changing documents. Alternatively, rerun `SEED_CONFIRM=yes npm run seed` against the target URI. The API uses whatever database `MONGODB_URI` names; seed and API must share that URI.

## Running Locally

```bash
npm run dev
```

- API: http://localhost:3000/api/v1
- Health: http://localhost:3000/health
- Swagger UI: http://localhost:3000/docs
- OpenAPI JSON: http://localhost:3000/openapi.json

`npm start` runs without nodemon.

JSON responses use `Content-Type: application/json`. Clients should send `Accept: application/json` (or `*/*`). Wildcard `application/*` is also supported. Requests that exclude JSON (including `q=0`) return **406**.

## Authentication

`POST /api/v1/auth/login` with JSON `{ "email", "password" }` returns `{ "data": { "tokenType": "Bearer", "expiresIn": "1h", "token": "...", "user": {} } }`.

Send:

```http
Authorization: Bearer <token>
```

Passwords are bcrypt hashes. JWT claims include `sub`, `role`, `scope`, `scopes`, and jurisdiction ids. No password is embedded in the token.

## Authorization

Enforced on the server (not by query parameters):

| Role | Read | Write |
| --- | --- | --- |
| `national-analyst` | all jurisdictions | none |
| `province-analyst` | own province only | none |
| `district-analyst` | own district only (parent province metadata allowed) | none |
| `device` | own installation (last-reading / own history) | POST only for own installation |

List endpoints hide out-of-jurisdiction siblings (a Colombo analyst listing Western districts only sees Colombo). Cross-jurisdiction ids return **403**.

## API Endpoints

Version prefix: `/api/v1`.

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/health` | no |
| POST | `/api/v1/auth/login` | no |
| GET | `/api/v1` | no |
| GET | `/api/v1/districts`, `/api/v1/substations`, `/api/v1/installations`, `/api/v1/readings` | analyst + jurisdiction |
| GET | `/api/v1/provinces` | analyst |
| GET | `/api/v1/provinces/:provinceId` | analyst + jurisdiction |
| GET | `/api/v1/provinces/:provinceId/districts` | analyst + jurisdiction |
| GET | `/api/v1/districts/:districtId` | analyst + jurisdiction |
| GET | `/api/v1/districts/:districtId/substations` | analyst + jurisdiction |
| GET | `/api/v1/districts/:districtId/generation-summary` | analyst + jurisdiction |
| GET | `/api/v1/substations/:substationId` | analyst + jurisdiction |
| GET | `/api/v1/substations/:substationId/installations` | analyst + jurisdiction |
| GET | `/api/v1/installations/:installationId` | analyst or owning device |
| GET | `/api/v1/installations/:installationId/composite` | analyst or owning device |
| GET | `/api/v1/installations/:installationId/last-reading` | analyst or owning device |
| GET | `/api/v1/installations/:installationId/readings` | analyst or owning device |
| POST | `/api/v1/installations/:installationId/readings` | owning device |
| GET | `/api/v1/installations/:installationId/readings/:readingId` | analyst or owning device |

Readings are strictly append-only through the API. PUT, PATCH and DELETE are not implemented. GET is safe/idempotent; POST creates immutable history and returns 201 + Location. Duplicate installation/timestamp returns 409. Full CRUD is implemented on SolarInstallation through a separate scoped administrator role; historical readings remain immutable. See the current release notes below and `report/OFFICIAL-ASSESSMENT-AUDIT.md`. GET supports If-Match with 412 on failure. CORS preflight returns 204.

## Pagination

All collections, including geography and historical readings, return `data`, `meta`, and `links`. Example:

`GET /api/v1/installations/:installationId/readings?page=1&limit=50`

```json
{
  "data": [],
  "meta": { "total": 134400, "page": 1, "limit": 50, "pages": 2688 },
  "links": { "self": "...", "next": "...", "previous": null }
}
```

`page` ≥ 1; `limit` between 1 and 100. Invalid values return **400**. Empty sets keep the same shape (`pages` may be 0).

## Filtering

History query parameters:

- `provinceId`, `districtId`, `substationId` — must match the installation **and** the caller’s jurisdiction
- `from`, `to` — ISO date-time with seconds and timezone, such as `2026-09-26T06:00:00Z`; calendar-invalid dates and `from` > `to` are **400**

Top-level `/readings` applies the same filters across permitted installations. A conflicting top-level jurisdiction filter returns an empty collection; a nested-history mismatch returns 403. Repeated/unknown query parameters are rejected.

## Sorting

Whitelist only:

- `sort=timestamp` ascending
- `sort=-timestamp` descending (**default**)

Arbitrary MongoDB sort expressions are rejected.

## Conditional GET

Domain GET resources send `ETag`. Atomic and geography resources also send `Last-Modified` where there is a reliable modification time. Reading collections, composites and daily summaries use ETag only: a row timestamp cannot reliably validate their changing totals, related data or calendar window.

```http
If-None-Match: "<etag>"
```

or `If-Modified-Since`. Unchanged representations return **304** with an **empty body**.

GET may send `If-Match`; a failed strong comparison returns **412**. `If-None-Match` uses weak comparison and takes precedence over `If-Modified-Since`. Authenticated responses use `Cache-Control: private, no-cache` and `Vary: Authorization`; login is `no-store`.

## Error Handling

```json
{
  "error": {
    "code": "INVALID_PARAMETER",
    "message": "The limit parameter must be between 1 and 100.",
    "detail": { "field": "limit", "value": "500" }
  }
}
```

Typical statuses: 400 validation, 401 unauthenticated, 403 unauthorized, 404 missing or hidden by policy, 406 Accept, 409 duplicate reading timestamp, 412 precondition, 413 oversized JSON, 415 body not JSON, 429 rate limit, 503 database unavailable, 201 created, 204 CORS preflight.

## District Summary

`GET /api/v1/districts/:districtId/generation-summary` includes only fresh non-future measurements in `currentPowerKw`; `lastKnownPowerKw` includes stale last-known values. `powerQuality` counts fresh/stale/missing installations. Last-reading keeps its `data` and adds `freshness`; composite adds `latestReadingFreshness`. Missing last-reading remains 404 with freshness in `error.detail`. Status is fresh, stale, missing, future or invalid. Age uses server UTC time and measurement timestamp, not receipt time. Exactly the freshness threshold remains fresh. Historical data is retained and delayed valid ingestion is accepted. Dynamic freshness uses ETag without Last-Modified.

Daily `todayEnergyKwh` sums valid consecutive nonnegative cumulative counter deltas wholly inside the Asia/Colombo day. Intervals over `READING_INTERVAL_SECONDS` (default 900), counter decreases and cross-midnight intervals are excluded. The post-reset counter is never assumed to be energy generated since reset; subsequent valid increments are counted. Without an exact midnight baseline, calculation starts with the first in-day pair and is partial. No interpolation or rollover modulus is assumed. `energyQuality` reports partial installations, decreases, gaps and reasons. Complete-through-last-reading means observed coverage only, not a full-day forecast or proof of meter accuracy. An undetectable reset between samples remains a limitation.

Optional `READING_FRESHNESS_SECONDS=1800` and `READING_INTERVAL_SECONDS=900` are positive integers in seconds; omission preserves these defaults. Set the freshness threshold according to the actual reporting schedule. Existing fixed seed history will normally be stale and may give zero observed energy today.

Both historical collection routes accept `pagination=cursor&limit=50&sort=timestamp` (or `-timestamp`). Follow `links.next` and `links.previous` unchanged. Signed cursors expire in one hour and bind the original filters, limit, order, resource and authenticated principal/jurisdiction. Changed or malformed cursors return 400 `INVALID_CURSOR`; every page independently authorizes the user. Ordering is timestamp plus public reading ID. This avoids offset shifts for existing immutable records, but is **not snapshot isolation**: newly inserted rows behind the boundary are not revisited; rows ahead may appear. Totals are live counts. Cursor metadata omits page/pages and identifies `live-keyset`. Default offset pagination and its existing contract remain available. Existing indexes are unchanged; broad national queries and exact counts still incur work proportional to the filtered dataset.

JWT validation restricts HS256 and requires subject, expiry, issued-at, role, scope and scopes; claims must match the active database user and device installation/analyst jurisdiction. Existing login-issued tokens remain compatible. No credential or secret was rotated. For credential rotation, disable the affected account first (immediately rejects its tokens), replace its bcrypt hash through a controlled administrative maintenance process, and wait until outstanding tokens expire before re-enabling. Merely changing a password does not revoke existing JWTs. Issuer/audience separation and shared rate-limit storage remain production-hardening work; the current app issues and accepts its own tokens with an exclusive signing secret. The process-local limiter cannot provide a global multi-instance Vercel limit.

Installation management now uses a separate installation-admin role with explicit jurisdiction and installation-manage scope. Existing analyst accounts retain read-only permissions. This engineering extension satisfies the technical CRUD path without adding mutable history. See `report/FIVE-ISSUES-REMEDIATION.md`.

## Swagger

Open http://localhost:3000/docs after `npm run dev`. Click **Authorize** and enter the JWT from login. The document matches implemented paths only.

## Testing

```bash
npm test
npm run lint
npm run docs:validate
```

Tests use `NODE_ENV=test` and disposable **mongodb-memory-server** databases; they never use Atlas. The seed integration suite starts its own isolated database, runs the full 134,400-row seed, verifies counts and references, exports and imports all collections with BSON types preserved, and starts the production HTTP server. The API suite exercises the exported Vercel handler with Supertest. A MongoDB binary is downloaded on first run; localhost sockets must be permitted. `MONGODB_TEST_URI` is required by application test mode and may never equal `MONGODB_URI`; the suite assigns its own disposable URI.

## Vercel Deployment

1. Push the repo to GitHub.
2. Import the project in Vercel using Node 22.x and the **Other** preset (`framework: null` is set). Leave the build command empty; this JavaScript backend has no compilation step.
3. Set environment variables: `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`.
4. Deploy. `vercel.json` rewrites all routes to `api/index.js`, includes Swagger assets in the function bundle, and sets an empty `public/` output directory so source files are not published as static files. This uses the standard Node function entry, not the newer Express framework static-asset convention.
5. Seed Atlas **from your machine** (`MONGODB_URI` = Atlas URI, `SEED_CONFIRM=yes npm run seed`). Do not seed inside the serverless handler.
6. Check `https://<project>.vercel.app/health` and `/docs`.

CLI alternative: `npx vercel login`, `npx vercel link`, configure the same environment variables in Preview and Production, then `npx vercel deploy`. Verify the preview before `npx vercel --prod`. Never commit `.vercel` or `.env`.

The configuration follows [Vercel Node functions](https://vercel.com/docs/functions/runtimes/node-js) and [function file inclusion](https://vercel.com/docs/project-configuration/vercel-json). No persistent filesystem, background process or production `app.listen()` is required. MongoDB connections and in-flight connection promises are reused within each warm process.

**Five-issues Production deployment verified (2026-10-09).** The Preview and authorized Production deployment each passed 17 smoke groups after 120 automated tests, lint and OpenAPI validation. All six Atlas collection counts and data digests remained unchanged. The current public API and Swagger are at [project-n8zne.vercel.app](https://project-n8zne.vercel.app/docs/); deployment `dpl_2wQEX9c6VHZxApMCiR5kdv5RtxVe`. At that earlier release, full CRUD was unresolved; the unreleased local implementation now adds it. See [remediation evidence](report/FIVE-ISSUES-REMEDIATION.md) and [consolidated test results](report/TEST-RESULTS.md).

**Production deployment verified (2026-10-03).** [Live Swagger](https://project-n8zne.vercel.app/docs/) · [Health](https://project-n8zne.vercel.app/health). Atlas connectivity, Swagger assets, all four demo-role logins, jurisdiction enforcement, 134,400 readings, pagination, filters, conditional requests, summaries and CORS passed live checks. See `report/archive/LIVE-DEPLOYMENT-VERIFICATION.json`. The production domain retains the initial generated project name. A new protected Preview passed all 14 smoke groups through authenticated CLI requests on 2026-10-04 (Asia/Colombo). Only then was a new Production deployment created; all 14 public production smoke groups passed. See report/archive/RELEASE-VERIFICATION.json, report/archive/NEW-PREVIEW-SMOKE.json and report/archive/NEW-PRODUCTION-SMOKE.json. Environment values were not recorded.

## Example API Requests

```bash
TOKEN=$(curl -s http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.test","password":"Admin@12345"}' | jq -r .data.token)

curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/provinces
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/installations/<id>/last-reading
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/installations/<id>/readings?page=1&limit=50&sort=-timestamp"
```

Device ingest:

```bash
curl -X POST http://localhost:3000/api/v1/installations/<id>/readings \
  -H "Authorization: Bearer $DEVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"timestamp":"2026-09-26T12:00:00.000Z","powerKw":6.2,"cumulativeEnergyKwh":1401.5,"voltage":230.1}'
```

Successful create: **201** and `Location: /api/v1/installations/{id}/readings/{readingId}`.

## Demo Credentials

**Coursework/local only. Change before any real deployment.**

| Account | Email | Password |
| --- | --- | --- |
| National analyst | `admin@example.test` | `Admin@12345` |
| Western province analyst | `analyst.western@example.test` | `Analyst@12345` |
| Colombo district analyst | `analyst.cmb@example.test` | `District@12345` |
| Device for `INST-00001` | `device00001@devices.example.test` | `Device@12345` |

Other districts follow `analyst.<code>@example.test` with `District@12345`. Device emails follow `deviceNNNNN@devices.example.test`.

## Security Notes

- Do not commit secrets or production URLs.
- National analysts cannot ingest readings.
- Devices cannot create geography or users (those routes do not exist).
- ObjectIds and query parameters are validated before queries.
- Stack traces are not returned when `NODE_ENV=production`.
- Helmet is enabled; CSP is disabled so Swagger UI can load.
- Rate limiting is per warm process, not a distributed production quota; use Vercel edge controls for stronger enforcement.
- CORS uses `CORS_ORIGIN=*` for public coursework API testing because authentication uses explicitly supplied JWT bearer tokens, not cookies or browser sessions. `credentials: false` ensures no Access-Control-Allow-Credentials header is sent. Browser clients should omit `credentials: "include"` / `withCredentials: true` and set Authorization explicitly. GET, HEAD, POST and OPTIONS are advertised; preflight permits requested headers, including Authorization and Content-Type. Location/ETag/Last-Modified are exposed. JWT and jurisdiction checks still apply regardless of origin. A comma-separated explicit origin allowlist remains available through CORS_ORIGIN if access requirements change.
- JWTs are verified with HS256; current user activity, scope and installation assignment are checked server-side.
- Demo passwords are deliberately public and only for a synthetic coursework database. Use private credentials before connecting real data.

## Richardson Maturity Level

- Level 1: noun resources under `/api/v1`.
- Level 2: GET/POST with matching status codes, `Location`, validators.
- Level 3: not implemented (no hypermedia controls beyond pagination `links` on the history collection).

## Submission and viva

Complete `report/AI-DISCLOSURE-TEMPLATE.md` in your own words. Keep genuine development/test evidence; this folder was not a Git repository at audit time and no history was fabricated. The Atlas/Vercel deployment is now verified. Before submission, personally rerun the live demonstrations and record your own evidence.

Be prepared to demonstrate login; national vs district visibility; a device POST with 201/Location; forbidden foreign ingestion; paginated/time-filtered history; ETag/304 and If-Match/412; summary arithmetic; Swagger authorization; and MongoDB export/import. Explain why readings are immutable and separate from installations, how queries enforce jurisdiction, what indexes do, and how the serverless connection cache works.

See `COURSEWORK-AUDIT.md`, `report/FINAL-REPORT.md`, and `report/FIVE-ISSUES-REMEDIATION.md` for the requirement mapping, verified evidence, and remaining assessment gaps.


## Repeatable verification and deployment gate

The official assessment comparison is in `report/OFFICIAL-ASSESSMENT-AUDIT.md`. Installation create/read/PATCH/archive is now tested locally. The separately authorized administrator is a documented engineering interpretation; historical readings remain append-only. New live deployment and personal submission requirements remain pending.

With private local configuration in place, run:

```sh
SEED_CONFIRM=yes npm run seed
npm run seed:verify
npm test
npm run lint
npm run docs:validate
npm run smoke -- --local
```

Seeding clears only the six coursework collections in the configured database. Use only the dedicated disposable coursework database. The verifier checks every collection count and 672 readings per installation. The seed no longer prints demo passwords. Do not paste raw credentials, CLI debug output, environment exports or database dumps into evidence.

The smoke runner starts a temporary localhost API with `--local`, or accepts the authorized coursework HTTPS deployment URL. It reads fictional seed credentials in memory, keeps tokens in memory, emits only check results, and preserves the dataset. Pass a new output filename under `report/evidence/` as an optional second argument to save a fresh JSON run; leave the original verification files intact. It covers all four roles, hierarchy routes, own-device reads, forbidden writes, duplicate rejection, validation, conditional requests, summaries and exact reading count. Successful creation is exercised by the isolated automated suite; this smoke runner intentionally uses only rejected write attempts against Atlas.

Authenticate the Vercel CLI in this shell with `npx vercel login`, then link the existing `slsea-solar-generation-api` project in the `thisajams-projects` team. Verify required variable names and target scopes without printing values. Deploy Preview first, test its protected API through authenticated tooling, and deploy production only after Preview passes. Do not turn off Vercel protection to make tests pass. `.vercel` and environment files are ignored and must stay untracked.

Public production recheck command:

```sh
npm run smoke -- https://project-n8zne.vercel.app
```

The 2026-10-04 release follow-up deployed a new Preview and passed all 14 smoke groups using authenticated Vercel CLI requests, then deployed Production and passed the same 14 groups at the public URL. An explicit `.vercelignore` was added after a dry run detected `.env` in the proposed upload; a second dry run confirmed private files were excluded before any upload. See `report/archive/COMPLETION-STATUS.md` for the final verification scope and remaining submission requirements.


## Unreleased finalization — 2026-10-10

This local source passed 171 tests, lint and OpenAPI validation, 17 isolated smoke groups and five isolated demo groups. It has **not** been pushed or deployed. The existing public site serves the previous release. See [engineering evidence](report/FIVE-ISSUES-REMEDIATION.md) and [release checklist](report/DEPLOYMENT-CHECKLIST.md).

### Installation CRUD in Swagger

1. For a safe demonstration, set a private `DEMO_ADMIN_PASSWORD` of 16–72 UTF-8 bytes (at least 16 characters) without putting its value in command history, then run `npm run demo`. The demo uses a disposable local MongoDB replica set, never Atlas, and seeded synthetic history. Open the printed localhost Swagger URL (default port 3001). Stop the process to remove the disposable database.
2. Use POST `/api/v1/auth/login` with `installation-admin@example.test` and your privately supplied password. Copy only the returned token into Swagger Authorize; do not share or log it.
3. GET `/api/v1/substations` and choose an actual returned substation ID. POST `/api/v1/installations` using a unique code and meterId, name, positive capacityKw, valid latitude/longitude and that substation reference. Follow the returned Location; expect 201 then GET 200.
4. GET `/api/v1/installations` supports provinceId, districtId, substationId, status, search and existing pagination. PATCH the new installation's name or capacityKw; expect 200. Identifier and substation changes are rejected. Read-only users and devices cannot manage installations.
5. DELETE that disposable installation; expect 204. Repeat DELETE; expect 204. Default lists exclude it; `status=archived` reveals it to authorized readers. Historical retrieval remains available. New reading ingestion into archived installations returns 409. Never use seeded production installations for destructive demonstrations.

Production administrators are not automatically provisioned. `npm run admin:create` is a guarded, create-only maintenance operation described in the release checklist; no existing user is elevated. Management can be national, province or district scoped.

### Live and historical reports

- Live: `/api/v1/generation-summary?mode=live` preserves actual timestamps and excludes stale power.
- Historical Colombo day: `/api/v1/generation-summary?mode=historical&date=2026-10-02`.
- Historical explicit range: `/api/v1/generation-summary?mode=historical&from=2026-10-01T18%3A30%3A00Z&to=2026-10-02T18%3A30%3A00Z`.
- Installation: `/api/v1/installations/{installationId}/generation-summary?mode=historical&date=2026-10-02`.
- Existing district summary accepts the same historical parameters. Global reports support geographical filters within the authenticated jurisdiction.

Actual Atlas measurements span 2026-09-26T21:45Z through 2026-10-03T21:30Z. Historical reports bypass live freshness filtering without rewriting timestamps. Windows are limited to 31 days and 150000 input readings. Query smaller windows if 422 is returned.

Read energyKwh together with coveragePercent, expectedReadings, actualReadings, missingIntervals, hasMeterReset, isComplete and qualityStatus. Only observed valid counter intervals count. Missing/reset intervals are excluded; no estimates are invented. Completeness requires full duration coverage without quality warnings. Unavailable may retain numeric zero for compatibility; it is not proof of zero generation. Coverage uses selected catalog installations, without an inferred commissioning history.

### Fixed-membership history pagination

Request `/api/v1/readings?pagination=snapshot&limit=50&sort=timestamp` (or the existing installation readings route). Follow links.next unchanged. The first request captures ordered IDs in a short snapshot-read transaction; later requests use that fixed manifest, excluding later inserts even if backdated. Total is fixed. Existing offset and live-keyset modes remain available.

Snapshots expire after 15 minutes, contain at most 150000 readings and allow one active session per account. Starting another replaces the prior session. Cursors bind filters, order, limit, principal and jurisdiction; authorization is repeated per page. Invalid cursors return 400, replaced/expired manifests 410, missing members 409, oversized results 422. Direct privileged database modifications are outside the immutable API contract. This is not a long-lived database snapshot transaction.

Run approved `npm run indexes` maintenance before enabling snapshot mode on a target environment; missing TTL setup returns 503. It creates an ephemeral operational cache and additive reading index, with no historical rewrite. Ingestion and snapshot capture require replica-set transaction support. No Atlas maintenance was performed during this finalization.
