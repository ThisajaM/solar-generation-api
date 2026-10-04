# Official assessment comparison

Reviewed 2026-10-04 (Asia/Colombo), against the supplied NB6007CEM_Coursework_Brief.pdf (9 pages, dated 24 Aug 2026) and NB6007CEM_Marking_Rubric.pdf (7 pages, dated 25 Aug 2026). Both documents were read in full; the CRUD passages were also visually checked in the rendered pages. The brief is the primary assessment authority. Earlier master-prompt checklists are not substitutes for these documents.

This is an AI-assisted engineering review, not the student's assessed report or a predicted mark. No application, authentication, database, seed, or deployment behavior was changed by this review. Existing live evidence is dated evidence, not a new submission-time availability guarantee.

## Main findings

1. **CRUD is unresolved, not PASS.** The implementation preserves append-only history but has no update/delete API on any resource. The official documents explicitly require CRUD. They also explicitly require append-only readings. Clarification of the intended mutable resource and authorized actor is necessary before choosing an implementation.
2. **Submission eligibility is not established.** A signed declaration and module-leader collaborator access are not evidenced in this workspace. Viva attendance and understanding remain personal requirements.
3. **The existing implementation report is not the required student report.** It is roughly 1,577 whitespace-delimited words after removing fenced code and table rows, before further exclusions; it is an implementation log rather than a complete 2,250-2,750-word justification. The brief prohibits AI-generated report prose. Use technical evidence to support an independently written report.
4. **Incremental history is weak.** The local repository currently has one commit, `62f733a Initial coursework project`; creating a Preview branch at that same commit adds no development history. Preserve genuine future increments; do not fabricate retrospective commits.
5. **Most technical capabilities have concrete implementation and test evidence.** The six models, resource hierarchy, ingestion, JWT scopes, history queries, HTTP validators, summary, MongoDB persistence and OpenAPI are present. Full compliance must not be inferred from passing tests alone.

## Requirement-by-requirement evidence

Status meanings: Supported = implementation and relevant evidence found; Partial = some required evidence missing; Unresolved = official wording needs clarification; Not evidenced = cannot verify from available materials. These are audit findings, not marks.

| Requirement and official source | Current implementation / evidence | Finding |
| --- | --- | --- |
| Backend API only; RMM Level 2; JSON (brief pp.3,5,8-9) | Express API; Swagger interface; `public/.gitkeep` only; README states Level 2 and Level-3 gap | Supported; no dashboard or HATEOAS expansion needed |
| Implementation-independent domain model before resource design (brief p.4; rubric p.2, 15 marks) | README hierarchy and six Mongoose schemas; `FINAL-REPORT.md` model summary | Partial: current prose gives the hierarchy but does not demonstrate that a complete conceptual model with cardinalities preceded implementation. A student-owned conceptual model and rationale would strengthen evidence |
| Province -> District -> Grid Substation -> SolarInstallation -> GenerationReading, plus User (brief p.4) | Six models under `src/models`; parent ObjectId references; integration seed tests join parents | Supported; grid substations are named `Substation` internally, which preserves the domain concept |
| Meter/inverter identifier belongs to installation; no Device entity (brief p.4) | `SolarInstallation.js` meterId/inverterId, at least one required; no Device collection | Supported. Device principals use the User authentication schema; explain this storage choice without describing them as SLSEA people |
| Separate append-only history with installation, time, power, cumulative energy and voltage (brief p.4) | `GenerationReading.js`; unique installation/timestamp index; no API mutation; `frequencyHz` is an extra field | Supported; report should justify the extra field and distinguish API immutability from administrator access to MongoDB |
| Plausible, reference-consistent seed: 9 provinces, 25 districts, >=20 substations, >=200 installations, >=week history (brief p.5; rubric p.4, 5 marks) | Atlas evidence: 9/25/27/200/134400 and 227 principals; 672 readings per installation. `tests/seed.test.js` checks full scale, references, intervals, diurnal shape and reproducibility | Supported by recorded Atlas verification and isolated full-seed test. 227 users and exactly 134400 readings are project targets, not literal official minimums |
| Collection and atomic resources for all four hierarchy levels (brief p.5) | `routes/geography.js`: top-level collections plus individual province, district, substation and installation GET | Supported |
| Scoped parent collections (brief p.5; rubric p.2) | Province districts; district substations; substation installations; installation readings | Supported; additional global filtered collections complement nesting |
| Installation composite (brief p.5) | `geographyService.getComposite`: installation, substation, district, province and latest reading | Supported |
| Derived last-known-reading (brief pp.5-6) | `readingService.lastReading` queries maximum timestamp; dedicated `/installations/:id/last-reading` | Supported. Future timestamps are accepted at ingestion; last-reading can therefore differ from summary, which excludes future readings. Document or consider a clock-skew policy if this matters; no explicit future-time prohibition is stated |
| Installation historical sub-collection (brief pp.5-6) | GET `/installations/:id/readings`; individual reading GET constrained by installation | Supported |
| Ingestion by owning device; 201 and Location (brief p.5) | POST `/installations/:id/readings`; ownership/scope middleware; controller returns 201 and canonical Location; tests follow Location and detect duplicate 409 | Supported locally. Prior live suite was read-only and did not prove live ingestion |
| Create/retrieve/update/delete semantics; full CRUD write path (brief p.5; rubric p.3) | Only reading create/read, plus token creation; no PUT/PATCH/DELETE, no writable administrative resource | Unresolved and incomplete against literal CRUD wording; see conflict below |
| Correct methods, safety, idempotency (rubric p.2) | GET reads only; POST appends; duplicate timestamp returns 409. No partial PUT exists | Supported for implemented methods; update/delete semantics untested because absent |
| URI taxonomy and names (rubric p.2) | Atomic/collection/composite/processing routes; lowercase plural noun collections; hyphenated `last-reading` and `generation-summary` | Supported for domain routes. `/auth/login` is an action-named authentication route; strict application of the noun-only rule may need justification against the missing white paper, not an automatic rename |
| JSON and specific 200/201/400/404/406/412; Location/ETag/Last-Modified/Content-Type (brief p.9; rubric p.2) | Controllers, `utils/etag.js`, negotiation middleware, typed errors, concrete tests | Supported for domain resources. ETags validate composites/history; Last-Modified deliberately omitted where a reliable timestamp is unavailable. Unsupported methods currently return 404, not 405/Allow: a semantics improvement candidate, not a reason to add forbidden mutation |
| Pagination: count, next, previous (brief p.5; rubric p.3) | `utils/pagination.js`; history queries with bounded page/limit; empty/beyond-last tests | Supported; count/items are separate queries, so concurrent writes can change page consistency |
| Province/district/substation and time-window filtering (brief p.5) | Global collection jurisdiction intersections; nested history validates filter against installation; inclusive from/to | Supported; conflicting global scope returns empty data, conflicting nested scope returns 403 |
| Timestamp sorting in both directions (brief p.5) | `timestamp` / `-timestamp`; global tie-break by id; per-installation timestamp unique | Supported |
| Conditional GET with empty 304 (brief p.6; rubric p.3) | Domain controllers use ETag/If-None-Match; selected reliable Last-Modified/If-Modified-Since; precedence/weak-tag tests | Supported on domain reads. `/health` and API metadata do not implement these validators; treat them as operational endpoints and explain this boundary |
| Consistent client error code/message/detail (brief p.6) | `utils/http.js`, `middleware/error.js`; malformed JSON, validation, auth, media and rate-limit errors | Supported. Health's 503 status object is a documented operational/server-error exception, not a client-error schema failure |
| District summary stretch (brief p.6; rubric p.3) | `summaryService.js`: latest non-future power, cumulative delta from Colombo midnight; arithmetic and stable ETag tests | Supported. Staleness, missing baselines and counter resets can limit interpretation; documented. No live data feeder is required by the supplied brief |
| JWT bearer with installation and jurisdiction scopes (rubric p.5, 15 marks) | bcrypt login; JWT HS256, expiry, subject validation; `analyst-read` and `installation-write`; database user reloaded on requests | Supported. Full OAuth authorization server is explicitly unnecessary |
| Device writes only its installation; analysts never write readings (brief pp.3-4,6) | `requireScope` and `deviceOwnsInstallation`; foreign-device and analyst-write denial tests | Supported. Own-device reads are an additional, bounded capability; brief does not explicitly ban those reads |
| National/province/district read boundaries; no cross-jurisdiction records (brief p.6; rubric p.5) | `accessService.js`, `collectionService.js`, populated ancestry authorization; scoped totals and nested endpoints tested | Supported for tested cases; existence-sensitive 403/404 behavior should be explained, and no claim of exhaustive penetration testing is made |
| HTTPS, scope versus attribute-based access-control reasoning (rubric p.5) | Vercel HTTPS; scope grants combined with ownership/jurisdiction attributes | Technical implementation supported; student report needs an explicit trade-off discussion |
| MongoDB persistence (user-requested check) | Real Mongoose queries/writes and Atlas; connection reuse; unique indexes; full export/import round trip | Supported. Supplied brief/rubric specify domain and seed behavior, not MongoDB as a named mandatory technology. MongoDB foreign keys and history immutability are not enforced against direct administrator writes |
| Validation (user-requested check; brief error contract and rubric functionality) | Strict object/field/numeric/date/id/page/sort/query checks; schema constraints; duplicate key handling; negative and malformed tests | Supported. No universal upper physical bounds, clock-skew rule, or monotonic-energy constraint is required in supplied documents |
| Testing and edge cases (rubric p.4) | Jest/Supertest with disposable real MongoDB; API, schema and full seed suites; recorded live evidence | Supported for implemented behavior, with live POST and extended Preview limitations. No official test-count or coverage-percentage target is specified |
| Coherent generated code, critique and repair evidence (rubric p.3, 10 marks) | Route/controller/service/model separation; INITIAL-AUDIT and regression tests; implementation log | Technical evidence supported; full prompt/AI provenance and personal comprehension incomplete |
| Public HTTPS deployment, populated and operating (brief p.6; rubric p.4, 10 marks) | Production `https://project-n8zne.vercel.app`; LIVE-DEPLOYMENT-VERIFICATION.json and ATLAS-SEED-VERIFICATION.json | Supported by prior live checks; recheck at submission. Protected Preview is additional and should not replace the public production URL |
| Live OpenAPI/Swagger (brief p.6) | `/docs/`, `/openapi.json`; `src/docs/openapi.js`; formal validation, browser rendering, deployment asset evidence | Supported for implemented routes; missing CRUD is not cured by documenting only existing operations |
| Repository shared with module leader as collaborator (brief pp.6,8-9; rubric pp.4,6) | GitHub repository exists; no collaborator evidence inspected | Not evidenced. A public repository or Vercel GitHub access is not proof of collaborator invitation/acceptance |
| Incremental development commits (brief pp.6,8; rubric p.4) | One commit in `git log --all` | Gap; retain truthful future commits, do not reconstruct fictitious history |
| 2250-2750-word justification with six sections (brief p.7; rubric p.5, 10 marks) | Existing FINAL-REPORT is an AI engineering log, approximately 1577 words before some exclusions; README contains further technical notes | Gap. Required student sections: architecture/model, API design, security, deployment, RMM evaluation, critical evaluation |
| Signed declaration and complete prompt/AI appendix (brief pp.1,6-9; rubric pp.5-6) | AI-DISCLOSURE-TEMPLATE has placeholders and outdated statement that no live checks are claimed; no signed declaration found | Gap/not evidenced; preserve exact prompts and aid details, include deployment/audit assistance, student completes own statements and signature |
| Viva attendance and ability to explain all artifacts (brief pp.7-9; rubric p.6) | Viva notes exist, but comprehension/attendance cannot be proved by code | Personal eligibility requirement, not verified |
| Module REST API Design Guidelines as design authority (brief pp.3,8-9) | Referenced by both official PDFs, but that white paper was not supplied in this review | Partial: compare against rules reproduced in PDFs only; exact white-paper compliance cannot be certified |

## CRUD conflict requiring an authoritative answer

The brief p.4 requires GenerationReading to be an append-only time series. Brief pp.3-4 restrict devices to writing readings for their own installation and describe SLSEA users as read-clients. Brief p.5 nevertheless calls for create/retrieve/update/delete semantics across writable resources. Rubric p.3 explicitly includes full CRUD on the write path in its highest coverage descriptor.

The current code protects history correctly but cannot demonstrate update/delete anywhere. Earlier claims that this alone earns CRUD PASS were too strong. The brief itself contains both requirements; prioritizing the brief over the rubric does not remove the conflict.

Recommended clarification to the module leader: **Which resource and actor should demonstrate update/delete while GenerationReading remains append-only and devices can write only their own readings? Is a separately authorized metadata-management resource intended, or is create/read with explicit rejection of history mutation sufficient?** This question has not been sent externally.

Pending clarification, retain the working append-only implementation. Do not invent an administrator role, give analysts write access, mutate stored readings, or claim CRUD completion. If a mutable resource is confirmed, implement only that resource with explicit authorization, validation, idempotency, conflict/reference rules, OpenAPI and tests; preserve historical readings.

## Eight-dimension conclusion

| Rubric dimension | Weight | Assessment readiness |
| --- | ---: | --- |
| Architecture/data model | 15 | Strong implemented hierarchy; conceptual-model process and justification need student evidence |
| API design | 20 | Broad technical evidence; CRUD interpretation and minor method/auth-route semantics remain to resolve |
| Coverage | 15 | Required reads, advanced history and stretch summary present; full CRUD cannot be marked complete |
| Implementation/generated code | 10 | Structured code and repair tests; disclosure and personal defense incomplete |
| Functionality against seed | 5 | Full-size isolated seed and prior Atlas/read checks; local tests cannot prove every deployed path |
| Deployment/operation | 10 | Public production and live Swagger verified previously; one-commit history and collaborator evidence are weaknesses |
| Security/authentication | 15 | JWT, scoped grants, ownership and jurisdiction checks supported; articulate scope/attribute trade-offs |
| Report quality | 10 | Required independently authored report, signed declaration and complete appendix not established |

No numerical score is assigned. Eligibility and viva requirements can invalidate an otherwise strong technical submission.

## Verification and scope

Lint and formal OpenAPI validation passed during this review. The first test attempt could not start local listeners under the sandbox (EPERM), so it was rerun with permission for disposable local MongoDB and HTTP servers. The permitted rerun passed all 82 tests across 3 suites in 20.691 seconds, including the full seed/export/import/startup test. Atlas was not reseeded and no live readings were created or modified in this audit.

Prior external evidence: `ATLAS-SEED-VERIFICATION.json`, `LIVE-DEPLOYMENT-VERIFICATION.json`, `PREVIEW-DEPLOYMENT-VERIFICATION.json`. Preview browser checks cover rendered Swagger, database health 200 and unauthorized resource access 401; Vercel protection blocked the extended public automated suite. Official MongoDB Database Tools execution is not verified and is not explicitly required by these two assessment documents.

Next priorities: resolve the CRUD ambiguity and obtain the referenced design white paper; prepare the student-owned report/declaration/disclosure and verify collaborator access; preserve genuine future commits and run a final public-production demonstration before submission.


## Final follow-up audit (2026-10-04)

The subsequent authorized completion pass reseeded Atlas and verified exactly 9 provinces, 25 districts, 27 substations, 200 installations, 134400 readings and 227 principals. All 82 tests passed again (final run: 3 suites, 20.495 seconds). Local Atlas and existing production each passed 14 smoke groups; successful reading creation remains tested in isolated MongoDB, while Atlas checks preserve its exact counts. Seed output no longer prints passwords; repeatable verification commands were added.

The eight-dimension conclusions above remain substantively unchanged: technical read/ingestion/security coverage is supported, but full CRUD is unresolved; submission/report/collaborator/viva evidence is still incomplete. No invented resource or role was introduced. The available Vercel CLI is unauthenticated and the checkout is unlinked, so no new Preview or production release occurred; existing production was reverified. See COMPLETION-STATUS.md for the full result and gated release steps.


## Deployment blocker resolved

The subsequent release deployed a new protected Preview and verified all 14 smoke groups through authenticated CLI access, then created a new Production deployment and passed the same 14 public checks. Preview protection remains enabled. Required variable names were verified in both environments without recording values. The deployment dry run exposed an upload-exclusion gap, fixed with `.vercelignore` before upload. See RELEASE-VERIFICATION.json. Checkout now has a further genuine commit, `ee82d5c`; earlier one-commit findings describe the audit-time state. CRUD clarification and personal submission requirements remain unresolved.
