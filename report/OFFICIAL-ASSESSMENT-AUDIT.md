# Current official-assessment comparison — 2026-10-10

This engineering update uses the official PDF review preserved in [the prior audit](archive/PRE-FINALIZATION-2026-10-10-OFFICIAL-ASSESSMENT-AUDIT.md), including its page references. It is not a predicted mark or a student-authored report. The referenced REST Design Guidelines white paper was not supplied; exact compliance with that separate document remains unverified.

The earlier CRUD implementation gap is now technically resolved locally through SolarInstallation create/read/PATCH/archive. The user's explicit instruction authorized a minimal separate installation-admin role rather than asking for lecturer clarification. This is a reasoned engineering interpretation of the brief's writable-resource CRUD requirement, not evidence of lecturer approval. Existing read-only roles remain read-only and GenerationReading remains append-only.

| Requirement | Current evidence | Assessment status |
| --- | --- | --- |
| Six-domain hierarchy, installation meter identifier, independent append-only readings | Existing schemas; schema/API/full-seed tests | Supported; ReadingSnapshot is an operational cache, not a Device entity |
| Atomic, collection, nested and composite resources | Geography/reading routes and API regression suite | Supported |
| Complete CRUD with correct semantics | installationService, scoped admin routes, finalization lifecycle tests; POST Location, PATCH and repeated 204 archive | Supported locally; archive semantics and new actor must be explained in the student's design rationale |
| Device write-only ownership boundary and jurisdiction-scoped analyst reads | Existing JWT/ownership middleware plus admin separation and archive transaction tests | Supported; privileged direct database access is outside API controls |
| Validation, error contract, status codes and HTTP validators | Strict input whitelists, duplicate/reference handling, API regression, OpenAPI | Supported; unsupported methods retain existing behavior |
| Count/next/previous pagination, sorting and filtering | Existing offset/live cursor modes preserved; additional bounded fixed-membership snapshot mode | Supported; snapshot mode is forward-only, legacy navigation remains available |
| Last-known reading and district summary | Freshness regression; live excludes stale power; conservative measured deltas with explicit coverage | Supported; incomplete physical observations remain incomplete |
| Historical reporting and local timezone | reportingService and numerical/validation tests | Supported; UTC storage, Asia/Colombo day windows |
| Plausible full-size seed and persistence | Read-only Atlas counts/digests; disposable 134400-row seed and snapshot tests | Supported; production seed preserved |
| Public HTTPS API and Swagger | Prior deployment evidence; new specification validates locally | Existing release previously verified; new release deployment remains pending approval |
| Automated verification | 171/171 tests, lint/OpenAPI, 17 isolated smoke groups and 5 demo groups | Supported; no coverage percentage or new live test result claimed |
| Richardson Level 2 | Resource methods/status codes and conditional GET retained | Supported; no Level 3 claim |
| Genuine incremental Git history | Existing commits preserved; this change to receive a genuine new commit | No history rewriting; quality of development history remains an assessment judgment |
| Conceptual model and independent report | Technical facts available in remediation evidence | Student must provide own rationale and required 2250–2750-word report; AI-generated assessed prose is prohibited by the brief |
| Declaration, prompts, collaborator access and viva | AI disclosure template and preserved engineering evidence | Personal completion/eligibility not established by code |

No lecturer clarification is requested as a blocker. Technical installation CRUD is complete and tested; formal marking acceptance is not guaranteed. This audit supersedes current-status statements in archived reports while preserving their historical evidence. New production readiness is conditional on the index/admin release steps and successful Preview verification in DEPLOYMENT-CHECKLIST.md.
