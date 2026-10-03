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

Readings are strictly append-only through the API. PUT, PATCH and DELETE are not implemented. GET is safe/idempotent; POST creates immutable history and returns 201 + Location. Duplicate installation/timestamp returns 409. The official brief also asks for CRUD semantics and the rubric explicitly asks for full CRUD. This is unresolved assessment scope, not a confirmed exemption; see `report/OFFICIAL-ASSESSMENT-AUDIT.md`. GET supports If-Match with 412 on failure. CORS preflight returns 204.

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

`GET /api/v1/districts/:districtId/generation-summary` sums each installation's latest reading at or before the current time. Power is last-known rather than guaranteed simultaneous live power; `latestReadingAt` makes staleness visible. Daily energy is latest cumulative energy minus the last value at or before Colombo midnight, falling back to the first value today. Negative deltas are clamped to zero. Missing boundary readings and meter resets may undercount; no interpolation is fabricated. The window ends at exclusive next midnight. Aggregation uses MongoDB lookups backed by `(installation, timestamp)`.

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

**Production deployment verified (2026-10-03).** [Live Swagger](https://project-n8zne.vercel.app/docs/) · [Health](https://project-n8zne.vercel.app/health). Atlas connectivity, Swagger assets, all four demo-role logins, jurisdiction enforcement, 134,400 readings, pagination, filters, conditional requests, summaries and CORS passed live checks. See `report/LIVE-DEPLOYMENT-VERIFICATION.json`. The production domain retains the initial generated project name. Preview configuration and deployment verified on 2026-10-04 (Asia/Colombo). Browser smoke checks passed: Swagger renders, health returns 200 with MongoDB connected, and unauthenticated resource access returns 401. Vercel protection redirects public automated requests to sign-in, so the extended Preview suite remains unverified. Evidence: report/PREVIEW-DEPLOYMENT-VERIFICATION.json.

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

See `COURSEWORK-AUDIT.md` and `report/FINAL-REPORT.md` for the requirement mapping, verified evidence and remaining deployment blockers.


## Repeatable verification and deployment gate

The official assessment comparison is in `report/OFFICIAL-ASSESSMENT-AUDIT.md`. Full CRUD is unresolved: readings remain append-only and the assessment does not identify a compatible mutable resource/actor. Do not claim update/delete coverage until that scope is clarified.

With private local configuration in place, run:

```sh
SEED_CONFIRM=yes npm run seed
npm run seed:verify
npm test
npm run lint
npm run docs:validate
npm run smoke -- --local report/LOCAL-ATLAS-VERIFICATION.json
```

Seeding clears only the six coursework collections in the configured database. Use only the dedicated disposable coursework database. The verifier checks every collection count and 672 readings per installation. The seed no longer prints demo passwords. Do not paste raw credentials, CLI debug output, environment exports or database dumps into evidence.

The smoke runner starts a temporary localhost API with `--local`, or accepts the authorized coursework HTTPS deployment URL. It reads fictional seed credentials in memory, keeps tokens in memory, emits only check results, and preserves the dataset. It covers all four roles, hierarchy routes, own-device reads, forbidden writes, duplicate rejection, validation, conditional requests, summaries and exact reading count. Successful creation is exercised by the isolated automated suite; this smoke runner intentionally uses only rejected write attempts against Atlas.

Authenticate the Vercel CLI in this shell with `npx vercel login`, then link the existing `slsea-solar-generation-api` project in the `thisajams-projects` team. Verify required variable names and target scopes without printing values. Deploy Preview first, test its protected API through authenticated tooling, and deploy production only after Preview passes. Do not turn off Vercel protection to make tests pass. `.vercel` and environment files are ignored and must stay untracked.

Public production recheck command:

```sh
npm run smoke -- https://project-n8zne.vercel.app report/PRODUCTION-RECHECK.json
```

The 2026-10-04 follow-up reverified the existing production deployment; it did not publish a new release. The CLI session available to this checkout reported unauthenticated, so a new Preview/production release is pending sign-in. See `report/COMPLETION-STATUS.md` for the final verification scope and remaining submission requirements.
