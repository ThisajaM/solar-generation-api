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
| Vercel platform deployment | PASS (2026-10-03) | Production build ready, commit 62f733a; HTTPS smoke checks passed |
| Atlas connection | PASS (2026-10-03) | Local connection/reseed verified; deployed health reports connected |
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

Not every infrastructure failure was injected: rate-limit/database-failure handlers were also reviewed statically. Vercel routing, Swagger bundling and remote Atlas connectivity were subsequently checked live on 2026-10-03. Exhaustive cold-start/load testing was not performed.

## Failures found and resolved during validation

1. The sandbox's initial npm install could not resolve the registry. Authorized network access completed installation.
2. The sandbox initially denied localhost socket creation. Authorized local integration execution allowed temporary mongod and HTTP listeners.
3. Lint caught missing braces while the OpenAPI document was being completed; corrected before runtime checks.
4. The latest OpenAPI validator includes an ESM dependency that Jest 29's CommonJS loader cannot parse. The validation test now invokes the same validator using Node 22's native module loading; standalone and suite checks pass.

No failed checks were silently skipped. Tests exit normally without Jest forceExit. Seed/import/production startup are genuine test executions; hosted deployment evidence was subsequently recorded in LIVE-DEPLOYMENT-VERIFICATION.json on 2026-10-03.

## Live deployment follow-up — 2026-10-03

Production deployment and Atlas connectivity verified on 2026-10-03. Live API: https://project-n8zne.vercel.app. Evidence: report/LIVE-DEPLOYMENT-VERIFICATION.json. A new protected Preview passed all 14 smoke groups through authenticated CLI requests on 2026-10-04 (Asia/Colombo). Only then was a new Production deployment created; all 14 public production smoke groups passed. See report/RELEASE-VERIFICATION.json, report/NEW-PREVIEW-SMOKE.json and report/NEW-PRODUCTION-SMOKE.json. Environment values were not recorded.

Read-only HTTPS smoke checks passed; no new generation readings were inserted. All four demo roles authenticated. Collection counts matched, and scope, pagination, date filtering, ETag/304, If-Match/412, summary and CORS checks passed. The independently verified Atlas demo-user count remains 227 from the reseed verification. Official Database Tools remain untested.


## Final completion follow-up (2026-10-04)

- Final `npm test`: 82 passed, 3 suites, 20.495 seconds; see FINAL-TEST-VERIFICATION.json.
- `npm run lint`, `npm run docs:validate`, and `git diff --check`: passed.
- Dedicated Atlas reseed and independent exact-count check: passed; see ATLAS-SEED-VERIFICATION.json.
- Local application against Atlas: 14 smoke groups passed; see LOCAL-ATLAS-VERIFICATION.json.
- Existing public production after reseed: 14 smoke groups passed; see PRODUCTION-RECHECK.json.
- New Preview and Production deployed in order: 14 smoke groups passed on each; see RELEASE-VERIFICATION.json. Preview protection was retained.
- Update/delete CRUD: absent and unresolved against conflicting official requirements, not marked PASS.
