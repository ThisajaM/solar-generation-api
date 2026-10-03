# Validation evidence — 2026-09-29

## Final observed results

| Check | Result | Evidence / scope |
| --- | --- | --- |
| npm install | PASS | Dependencies installed; lockfile created; npm reported 0 known vulnerabilities at installation |
| npm test | PASS | 3 suites, 82 tests; 18.608 seconds on final run |
| npm run lint | PASS | No errors or warnings |
| npm run docs:validate | PASS | OpenAPI 3 document and references validated |
| npm run seed | PASS | Invoked twice by integration harness against disposable local MongoDB; 134400 readings each time |
| Seed reproducibility | PASS | Fixed-window power/energy/voltage/timestamp arrays match across reseeds |
| Seed destructive guard | PASS | SEED_CONFIRM=no refuses to seed; 134400 existing test records remain |
| Full MongoDB export | PASS | scripts/export-seed.js (the export:seed npm entry) executed against real seeded DB; six files written |
| BSON import round trip | PASS | Exported EJSON parsed/imported into separate disposable database, counts and ObjectId/Date types preserved |
| npm run indexes | PASS | Executed against imported test database; all schema indexes created |
| Production startup | PASS | src/server.js started with NODE_ENV=production on ephemeral port; HTTP health/login/134400-row collection/docs asset checks |
| Exported Vercel handler | PASS locally | API suite imports api/index.js and uses Supertest |
| Vercel platform deployment | BLOCKED | No CLI auth, linked project or deployment credentials |
| Atlas connection | NOT VERIFIED | No MONGODB_URI supplied for Atlas |
| Official Database Tools import/export | NOT VERIFIED | mongoexport/mongoimport not installed; driver export/import verified instead |

The full-data integration suite uses independent, temporary MongoDB databases and removes its processes/export directory on completion. No production database was cleared. The local mongod binary is provided by mongodb-memory-server; this is a real database process rather than mocked Mongoose calls.

## Final test output

```text
PASS tests/seed.test.js (16.56 s)
PASS tests/api.test.js
PASS tests/schema.test.js

Test Suites: 3 passed, 3 total
Tests:       82 passed, 82 total
Snapshots:   0 total
Time:        18.608 s, estimated 20 s
Ran all test suites.
```

## Coverage exercised

- Startup, connection, all seeded counts, reference joins, per-installation sample counts, 15-minute intervals, zero nighttime generation, capacity bound and cumulative energy monotonicity.
- Login, JWT issuance/claims, bcrypt authentication, wrong password, missing/invalid/expired bearer tokens.
- National, province, district and device boundaries; nested geography, global collections, composite, history, last reading and summary.
- Reading POST 201 and Location, duplicate 409, foreign/analyst writes denied; GET returns stored record; attempted PUT/PATCH/DELETE cannot mutate it.
- Pagination totals/next/previous/empty/beyond pages, all jurisdiction filters, time window and both sort directions.
- Strict IDs/dates/page/limit/sort validation, repeated and injection-shaped queries, body fields, NaN/Infinity, negative and wrong-type telemetry.
- Error envelopes, malformed JSON, 413, 415, 406; Accept wildcard and q=0 semantics.
- ETag and Last-Modified, weak/list/wildcard tags, date-only conditional request, precedence, bodyless 304, GET If-Match 412.
- CORS preflight 204, exposed headers, private caching.
- Summary known numeric delta, midnight baseline, future exclusion and stable summary conditional request.
- Concrete OpenAPI responses and references, no documented destructive reading methods, docs CSS/JS assets.

Not every infrastructure failure was injected: rate-limit/database-failure handlers were also reviewed statically. Vercel routing, cold starts, platform bundling and remote Atlas permissions remain live-deployment checks.

## Failures found and resolved during validation

1. The sandbox's initial npm install could not resolve the registry. Authorized network access completed installation.
2. The sandbox initially denied localhost socket creation. Authorized local integration execution allowed temporary mongod and HTTP listeners.
3. Lint caught missing braces while the OpenAPI document was being completed; corrected before runtime checks.
4. The latest OpenAPI validator includes an ESM dependency that Jest 29's CommonJS loader cannot parse. The validation test now invokes the same validator using Node 22's native module loading; standalone and suite checks pass.

No failed checks were silently skipped. Tests exit normally without Jest forceExit. Seed/import/production startup are genuine test executions; no hosted deployment evidence is claimed.
