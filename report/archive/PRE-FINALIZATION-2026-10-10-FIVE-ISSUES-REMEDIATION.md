# Five-issues audit, remediation and verification

Engineering evidence, not a finished academic report. Review date: 9 October 2026. Base: branch `main`, commit `43991a6`; initial working tree was clean. Changes remain reviewable in the working tree; no Git history was rewritten. Previous test/deployment claims were treated as historical evidence.

## 1. Executive Summary

Before editing, inspected the repository, package/configuration files, routes/controllers/services/models, validation, authentication, seed/export/index scripts, tests, README and prior coursework/deployment reports. Assessment authority: supplied **NB6007CEM_Coursework_Brief.pdf**, then **NB6007CEM_Marking_Rubric.pdf**. Also located and consulted `Downloads/3rd Year/wso2_rest_api_design_guidelines.pdf`; this supersedes the older audit's statement that the white paper was unavailable.

Initial classification:

| Issue | Initial finding | Resolution | Remaining risk |
| --- | --- | --- | --- |
| CRUD | Requires external clarification; update/delete absent | Preserve authorized read/append-only design; do not invent an admin role | Literal full-CRUD assessment requirement remains incomplete |
| Stale readings | Confirmed defect: old power silently represented as current | Server-time freshness, stale-power exclusion, additive quality metadata | Old seed data is intentionally stale; threshold must match deployment schedule |
| Energy | Confirmed defect: endpoint subtraction/clamping loses reset increments and misattributes boundary data | Conservative within-day interval deltas and explicit partial quality | Missing/reset intervals cannot be reconstructed; undetectable resets remain possible |
| Pagination | Potential concurrency risk confirmed in offset algorithm | Optional signed keyset traversal; offset contract retained | Live traversal is not a snapshot; exact totals and broad sorts cost work |
| Device security | Ownership/signature checks already present; required-claim validation partial | Require and reconcile claims with active database identity | Public demo credentials, process-local rate limits and no issuer/audience partitioning |

Implementation uses Express 5, Mongoose 8, custom input validators, bcryptjs and jsonwebtoken HS256. Local entry is `src/server.js`; Vercel entry is `api/index.js` with rewrites in `vercel.json`. No framework, entity, collection or deployment configuration replacement was needed.

## 2. Issue-by-Issue Results

### CRUD

- Root cause: no authorized mutable-resource actor is defined. Brief pp.3–4 gives devices their own reading writes and SLSEA analysts read access; p.4 makes GenerationReading append-only. Brief p.5 and rubric p.3 nevertheless require CRUD semantics/full CRUD coverage.
- Affected files: `src/routes/geography.js`, `src/routes/readings.js`, `src/middleware/auth.js`, `COURSEWORK-AUDIT.md` and the official assessment audit.
- Actual methods: hierarchy, composite, summary and history GET; login POST; own-installation reading POST. No PUT/PATCH/DELETE resource implementation. Full route map remains in `archive/ROUTE-AUDIT.md`; this remediation adds no routes.
- Decision: no administrative write scope, Device entity or historical mutation introduced. Ask the lecturer whether a separate installation-administrator role and installation CRUD are permitted, and which resource/actor is intended if not.
- Existing tests verify authorized reading creation/retrieval, 201/Location, duplicate 409, invalid payloads/IDs, scope denial and absent history mutations. These pass. Update/delete idempotency, deletion conflicts, mutable-reference integrity, and CRUD 204 cannot be claimed or tested as implemented behavior. CORS preflight 204 is not CRUD evidence.

### Stale readings

- Root cause: last-reading and composite returned historical measurements without freshness classification; summary used latest power regardless of age.
- Files: `src/utils/readingQuality.js`, `src/config/env.js`, `src/controllers/readingController.js`, `src/services/geographyService.js`, `src/services/summaryService.js`, OpenAPI and README.
- Default freshness is 1,800 seconds, configurable by `READING_FRESHNESS_SECONDS`; observed seed interval is 900 seconds. Exactly the threshold is fresh. Measurement timestamp is compared with trusted server UTC time, not ingestion time. Status distinguishes fresh/stale/missing/future/invalid.
- Last-reading retains `data` and adds `freshness`; composite adds `latestReadingFreshness`. Missing last-reading remains 404 with freshness in error detail. Stored history and delayed valid ingestion remain unchanged. Future ingestion is still accepted for compatibility but explicitly not treated as current power; summary selects the latest non-future record.
- `currentPowerKw` now counts only fresh measurements. `lastKnownPowerKw` exposes the former last-known meaning, and `powerQuality` counts coverage. Dynamic freshness omits Last-Modified; ETag includes the actual representation.
- Tests: threshold boundary, just-over boundary, future/missing/invalid, UTC-equivalent timestamps, stopped reporting, mixed district coverage, and ETag changes without a database write. Passed in the final suite.

### Energy calculations

- Root cause: latest minus midnight baseline (or first daily sample), clamped to zero, discarded valid pre/post-reset increments and could attribute a cross-midnight interval to the wrong day.
- Files: `src/utils/readingQuality.js`, `src/services/summaryService.js`, `tests/readingQuality.test.js`, `tests/api.test.js`, README/OpenAPI.
- `cumulativeEnergyKwh` is a cumulative meter counter, as confirmed by model, seed increments and API semantics. Deltas are computed after ordering observations within the Asia/Colombo reporting day. Storage/comparison remain UTC.
- Nonnegative consecutive deltas at most one configured reporting interval apart are accumulated. Counter decreases, cross-midnight intervals, long gaps, invalid counters and intervals adjacent to conflicting duplicate counters are excluded. Equal duplicates are deterministically handled and flagged; the existing database unique index normally prevents them.
- A decrease is an ambiguous reset/rollover/error, not proof that the post-reset value is newly generated energy. Subsequent valid increases still count. No preceding-day interval is attributed to today. Without an exact midnight reading the first in-day sample is a baseline only, and quality is partial. No rollover modulus or interpolation is assumed.
- `energyQuality` exposes reasons, partial-installation count, counter decreases and gaps. Complete-through-last-reading means observed coverage, not exact whole-day energy. Summary rounds aggregate kWh to two decimal places as before.
- Deterministic expected values include normal 5 kWh; zero/nonzero-reset sequences 5 kWh; missing midnight 3 kWh; missing interval 3 kWh; unproven rollover 1 kWh; mixed district 9 kWh. Tests also cover ordering, duplicate conflicts, invalid negative counters, no readings, future rows and Colombo midnight. Passed.

### Historical pagination

- Root cause: skip/limit offset positions shift when rows are inserted before a requested page. Existing deterministic global tie-breaking does not prevent offset shifts.
- Files: `src/services/cursorService.js`, `src/services/readingService.js`, `src/services/collectionService.js`, `src/app.js`, API/seed tests, README/OpenAPI.
- Both history collections now optionally accept `pagination=cursor`. Ordering uses timestamp plus unique public reading ID in either direction. Signed next/previous boundaries bind filters, limit, ordering, resource and current principal/jurisdiction; HMAC verification uses a domain-separated key derived in memory from the existing signing secret. Cursor expiry is one hour. No secret/credential is encoded.
- Malformed, tampered, expired or mismatched cursors return 400 `INVALID_CURSOR`; page cannot be combined with cursor mode. Authorization independently executes for each request. Responses retain filtered live totals and navigation links; cursor metadata identifies `live-keyset` instead of page/pages. Default offset behavior is unchanged.
- Guarantee: pre-existing immutable records are traversed without offset shifting. New records ahead may appear; new records behind the boundary are not revisited. Counts/links are live, not a bounded snapshot. No snapshot isolation is claimed.
- Tests insert rows between pages in both directions, cover identical timestamps, reverse navigation, final/empty pages, invalid cursor, changed filters/principal and wrong device. Full-size isolated seed test traverses national cursor pages over 134,400 rows. Passed.
- Existing indexes preserved. Exact filtered counts and broad compound ordering remain a scaling consideration; no unapproved production index migration was run.

### Device security

- Already implemented: bcrypt hashes, HS256 restriction, expiration checking, active-user lookup, device installation binding in authorization, analyst read-only scopes, generic error contract and request limiting.
- Gap: a validly signed token missing expiry or other essential claims could previously reach database-backed authorization; explicit claim coherence was incomplete.
- Files: `src/middleware/auth.js`, `tests/api.test.js`, README/OpenAPI, `scripts/smoke.js`.
- Require valid subject, integer expiry/issued-at, expiry after issued-at, non-future issued-at (60-second tolerance), role, scope and nonempty string scopes. Reconcile role/scopes and installation/jurisdiction with the current active database user. Disabled/reassigned identities are rejected. Existing application-login tokens have these claims and remain compatible.
- Tests cover missing claims, forged signatures, HS384, expired tokens, altered role/scopes/installation claims, disabled identity, wrong device reads/writes, invalid IDs/payloads and analyst ingestion denial. Passed. There is no privileged CRUD endpoint for a device to access.
- No real credential/secret was changed or added to fixtures. Local signing-secret length meets the 32-byte check; length does not prove entropy. The deployment retains its existing secrets.
- Rotation procedure is documented: disable account, replace bcrypt credential via controlled maintenance, wait for outstanding tokens to expire before reactivation. Password change alone is not token revocation. Issuer/audience introduction would require a planned compatibility rollout; this single-application deployment does not share its signing secret with another issuer. Process-local rate limiting is not a distributed brute-force defense.

## 3. API Changes

No new endpoint, HTTP method, model or role. Additive fields: `freshness`, `latestReadingFreshness`, `lastKnownPowerKw`, `powerQuality`, `energyQuality`. New optional history query parameters: `pagination`, `cursor`. New cursor error: 400 `INVALID_CURSOR`. Existing authentication failures remain 401; ownership/jurisdiction denial remains 403.

Intentional semantic correction: stale power no longer contributes to `currentPowerKw`; daily energy excludes unsupported intervals instead of endpoint subtraction. Clients requiring last-known values should use `lastKnownPowerKw`. All existing fields retain their types. Offset responses remain compatible. JWTs manually minted without required claims are intentionally rejected; login-issued tokens retain their format. Schema and behavior descriptions are in `src/docs/openapi.js`; examples can be tried through `/docs/`.

## 4. Database Changes

No collection/schema/index change, migration, reseed, password reset or historical-record edit. Six collections and existing `(installation, timestamp)` unique and timestamp indexes remain. No rollback migration is needed; application rollback can redeploy the previous release, noting it restores the old defects. Future index changes should be benchmarked on isolated data and reviewed before production execution.

Read-only Atlas baseline confirmed 9 provinces, 25 districts, 27 substations, 200 installations, **134,400 readings and 227 users**. `evidence/FIVE-ISSUES-ATLAS-BEFORE.json` contains counts and SHA-256 digests of sorted BSON records, not document contents. After Preview and again after Production smoke tests, all six collection digests and reading index definitions matched the original baseline exactly. Counts remained unchanged. Evidence: `evidence/FIVE-ISSUES-ATLAS-AFTER.json`, `evidence/FIVE-ISSUES-ATLAS-AFTER-PRODUCTION.json`, `evidence/FIVE-ISSUES-DATA-PRESERVATION.json` and `evidence/FIVE-ISSUES-PRODUCTION-DATA-PRESERVATION.json`. This sequential read-only comparison is strong observed preservation evidence, not a transactional snapshot guarantee. Direct connection initially failed, then succeeded on retry; no credentials were printed.

## 5. Testing Evidence

Final automated run: **120 executed, 120 passed, 0 failed, 0 skipped; four suites passed** in 19.864 seconds. The pre-Production rerun also passed **120/120** in 19.396 seconds, with lint and OpenAPI validation passing again. `tests/api.test.js` covers API/security/regression behavior; `tests/schema.test.js` covers model constraints; `tests/readingQuality.test.js` covers deterministic freshness/energy; `tests/seed.test.js` uses a disposable local MongoDB for complete seed, reseed, reference checks, export/import, cursor scale and production-mode HTTP startup. No live database was used for destructive fixtures.

The first sandbox run could not bind a local port. After allowing the isolated server, the first application run found one obsolete stale-power expectation; it was replaced with explicit fresh-versus-last-known assertions, not removed. Additional deterministic energy/security/cursor regressions were retained. Final lint, formal OpenAPI reference validation and Git whitespace check passed. Evidence: `evidence/FIVE-ISSUES-TEST-RESULTS.json`.

There is no compile/build script for this plain-JavaScript Express project. Production-mode startup is tested locally; Vercel's actual build result is recorded separately. Secret/upload audit: no configured secret matches in tracked source or reachable commit patches; no tracked private env/Vercel files; deployment dry-run excludes private files. The single URI-pattern candidate was a placeholder in `.env.example`. This heuristic is not a proof that all possible secrets are absent.

## 6. Deployment Evidence

New protected Preview: `https://slsea-solar-generation-f9t69o86m-thisajams-projects.vercel.app`, deployment `dpl_ug1TXMJ216BxFhUtAfJBfddXNgeQ`, Vercel state **READY**. Actual build/deployment succeeded using the existing authenticated CLI/project. Preview protection remains enabled. The source was the reviewed working tree, not a fabricated commit. The pre-Production upload contained the same 55 files as the Preview preflight; two files changed between that early dry run and Preview, both before Preview became READY. No deployment source file changed after Preview. The later README-only note was restored to its Preview content before Production. See `evidence/FIVE-ISSUES-PRODUCTION-PREFLIGHT.json`.

**Preview smoke results: 17/17 groups passed**, including all 14 existing groups and three new groups. Evidence: `evidence/FIVE-ISSUES-PREVIEW-SMOKE.json`. Checks include existing endpoint groups plus freshness/energy quality, signed cursor navigation/binding, forged tokens and cross-device reads. Tests create no successful readings; invalid/duplicate/unsupported write attempts must be rejected.

**Production deployed after explicit user approval:** `https://project-n8zne.vercel.app`; deployment `dpl_2wQEX9c6VHZxApMCiR5kdv5RtxVe`, Vercel state **READY**, target `production`. All **17/17 Production smoke groups passed**: Atlas health; Swagger and OpenAPI; all demo roles; exact public counts; scope/ownership; freshness and energy-quality responses; signed cursor navigation/query binding; forged JWT rejection; conditional responses; validation; rejected-only writes; and final reading count. No successful live ingestion was performed. Before/after Atlas digests and counts matched in all six collections; indexes also matched. See `evidence/FIVE-ISSUES-PRODUCTION-DEPLOYMENT.json`, `evidence/FIVE-ISSUES-PRODUCTION-SMOKE.json` and `evidence/FIVE-ISSUES-PRODUCTION-DATA-PRESERVATION.json`. A previous public baseline had returned 200 for health/OpenAPI without the new Freshness schema; current smoke verified the new representation. Deterministic numerical reset/gap cases were verified in isolated tests, while live seed measurements are historical and cannot demonstrate active metering.

## 7. Coursework Compliance

| Affected requirement | Actual code and evidence | Final finding |
| --- | --- | --- |
| Required six-entity domain, hierarchy, meter attribute; brief p.4 | Existing six models, `tests/schema.test.js`, full seed reference checks | Preserved; no Device entity |
| Independent append-only readings; brief pp.4–5 | Reading routes/service, schema unique key, rejected mutations in API tests | Preserved |
| Device-owned POST, 201/Location; brief p.5 | Reading controller/auth middleware; isolated API creation tests | Supported; live successful writes intentionally not performed |
| Atomic/collection/composite/derived resources; brief pp.5–6 | Geography/readings routes, composite service, API and Preview smoke | Supported for implemented resources |
| CRUD; brief p.5 and rubric p.3 | No authorized mutable-resource actor or update/delete routes | Unresolved; lecturer clarification required |
| Pagination/counts/links/filtering/sorting; brief p.5 | Existing offset plus optional cursor services; concurrent/scale tests | Supported with documented live consistency limits |
| ETag/conditional GET/status/errors; rubric pp.2–4 | Controllers/ETag utilities, tests for 304/412 and structured errors | Preserved; dynamic freshness omits unreliable Last-Modified |
| Own-device writes and scoped analyst reads; brief p.6 | Auth/access services, token and jurisdiction regressions | Supported, with documented operational security limitations |
| District processing resource; brief p.6 | Summary service and numerical fixtures | Corrected freshness and observed-energy semantics |
| MongoDB persistence and populated domain | Isolated real-MongoDB tests plus read-only Atlas count verification | Supported; no live mutation demonstration claimed |
| Swagger/public deployment; brief p.6 | Valid OpenAPI; Preview and Production READY; 17 Production smoke groups | New fixes deployed and publicly verified |
| Richardson Level 2; brief pp.3,5 | Resource URIs, HTTP methods/statuses/validators; retained route map | Supported for implemented methods; CRUD gap remains |
| REST white-paper guidance | Methods/statuses, collection pagination, caching and security compared with located WSO2 paper | No reason found to override brief's authorization boundaries; no Level-3 claim |

Full coursework compliance is **not** claimed. Other student-owned requirements from the official audit remain: conceptual-model justification, independently written 2,250–2,750-word report, genuine development-history evidence, module-leader collaborator access, signed declaration, complete AI/prompt appendix and viva preparation. This run did not verify invitations, signatures or personal understanding. There are now three reachable commits; older reports describing one commit are dated observations.

## 8. Remaining Warnings

- Resolve CRUD ambiguity with lecturer; absence of update/delete is an assessment gap, not a passed requirement.
- Fixed historical seed data does not demonstrate continuously reporting physical meters. Zero fresh power is expected when all devices are stale.
- Counter gaps/resets/rollovers cannot be exactly recovered without meter semantics or more telemetry. The conservative total can undercount and must be read with quality metadata.
- Cursor traversal is live, not a snapshot. Existing offsets remain susceptible to concurrent insert shifts. Exact counts and national sorting can be expensive beyond coursework scale; no compound tie-break index was added.
- Future records remain valid historical submissions but are explicitly non-current; no automatic clock correction is performed.
- Public demo credentials suit synthetic coursework only. A production-grade deployment needs unique device credentials, stronger distributed abuse controls and a planned revocation/issuer policy.

## 9. Recommended Report Updates

Factual prompts for the student's independent writing:

- **Architecture:** explain the existing Express controller/service/model separation, six collections, independent time-series history, connection reuse and serverless entry point.
- **API design:** explain immutable readings, resource taxonomy, POST/Location, conditional requests and why CRUD authorization requires clarification.
- **Security:** distinguish signed claims from current database authorization; explain ownership, jurisdiction, required claims, bcrypt, expiry and rotation limitations.
- **Deployment:** cite the real Preview and Production build/smoke evidence, deployment identifiers, Atlas preservation checks and public URL; explain private environment configuration without copying its values.
- **Richardson maturity:** explain why HTTP methods/statuses/resources support Level 2; pagination links alone do not establish Level 3.
- **Critical evaluation:** discuss stale-data transparency, conservative energy undercount, Colombo midnight, live versus snapshot pagination, index/count costs and distributed rate-limit limitations.
- Preserve these prompts and actual assistance details for the required AI disclosure; do not submit this engineering report as independently authored academic prose.
