# Validation evidence — 2026-09-29 through 2026-10-09

## Latest verified remediation results — 2026-10-09

The latest recorded isolated run passed **120/120 tests across four suites**, with no failures or skips. The pre-Production rerun also passed 120 tests. Lint, formal OpenAPI validation, and the Git whitespace check passed. The original machine-generated record is [FIVE-ISSUES-TEST-RESULTS.json](evidence/FIVE-ISSUES-TEST-RESULTS.json). These are recorded results from the remediation pass, not a claim that the suite was rerun during this documentation cleanup.

The protected Preview and public Production each passed **17/17 smoke groups**. See the original [Preview](evidence/FIVE-ISSUES-PREVIEW-SMOKE.json) and [Production](evidence/FIVE-ISSUES-PRODUCTION-SMOKE.json) results, plus [deployment verification](evidence/FIVE-ISSUES-PRODUCTION-DEPLOYMENT.json). The smoke runner made no successful live reading writes. The [baseline](evidence/FIVE-ISSUES-ATLAS-BEFORE.json), [post-Preview](evidence/FIVE-ISSUES-ATLAS-AFTER.json), and [post-Production](evidence/FIVE-ISSUES-ATLAS-AFTER-PRODUCTION.json) records retain all six collection counts, digests, and reading index definitions. The [Production comparison](evidence/FIVE-ISSUES-PRODUCTION-DATA-PRESERVATION.json) reports them unchanged; these are sequential checks, not a transactional snapshot.

The earlier 82-test and 14-group runs below remain dated historical results. Full CRUD is still unresolved because no update/delete resource exists. The student-authored assessment report, declaration, collaborator evidence, and personal verification remain outstanding as described in [OFFICIAL-ASSESSMENT-AUDIT.md](OFFICIAL-ASSESSMENT-AUDIT.md).

The 2026-10-03/04 machine records and completion note are in `archive/`; they can be excluded from a compact submission package if the assessment permits, while retaining this repository archive. Preserve `evidence/` and the five primary reports with the submission.

On 2026-10-10, after the report reorganization, the existing isolated suite was rerun with local socket access and passed **120/120 tests across four suites**. Lint, OpenAPI validation, `git diff --check`, JSON parsing, and report-reference checks also passed. No Atlas or Vercel checks were rerun as part of this documentation cleanup; their dated records remain the authority for those outcomes.

## Historical validation — 2026-09-29 through 2026-10-04

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

No failed checks were silently skipped. Tests exit normally without Jest forceExit. Seed/import/production startup are genuine test executions; hosted deployment evidence was subsequently recorded in archive/LIVE-DEPLOYMENT-VERIFICATION.json on 2026-10-03.

## Live deployment follow-up — 2026-10-03

Production deployment and Atlas connectivity verified on 2026-10-03. Live API: https://project-n8zne.vercel.app. Evidence: archive/LIVE-DEPLOYMENT-VERIFICATION.json. A new protected Preview passed all 14 smoke groups through authenticated CLI requests on 2026-10-04 (Asia/Colombo). Only then was a new Production deployment created; all 14 public production smoke groups passed. See archive/RELEASE-VERIFICATION.json, archive/NEW-PREVIEW-SMOKE.json and archive/NEW-PRODUCTION-SMOKE.json. Environment values were not recorded.

Read-only HTTPS smoke checks passed; no new generation readings were inserted. All four demo roles authenticated. Collection counts matched, and scope, pagination, date filtering, ETag/304, If-Match/412, summary and CORS checks passed. The independently verified Atlas demo-user count remains 227 from the reseed verification. Official Database Tools remain untested.


## Final completion follow-up (2026-10-04)

- Final `npm test`: 82 passed, 3 suites, 20.495 seconds; see archive/FINAL-TEST-VERIFICATION.json.
- `npm run lint`, `npm run docs:validate`, and `git diff --check`: passed.
- Dedicated Atlas reseed and independent exact-count check: passed; see evidence/ATLAS-SEED-VERIFICATION.json.
- Local application against Atlas: 14 smoke groups passed; see evidence/LOCAL-ATLAS-VERIFICATION.json.
- Existing public production after reseed: 14 smoke groups passed; see archive/PRODUCTION-RECHECK.json.
- New Preview and Production deployed in order: 14 smoke groups passed on each; see archive/RELEASE-VERIFICATION.json. Preview protection was retained.
- Update/delete CRUD: absent and unresolved against conflicting official requirements, not marked PASS.
