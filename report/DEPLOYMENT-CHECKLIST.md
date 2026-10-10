# Release checklist — approval required

This checkout is locally verified and prepared for a genuine commit. Do not push or deploy until explicitly approved; pushing main may trigger Vercel Production.

## Before Preview

- Review the committed diff and verify the intended existing Vercel project link privately.
- Retain the current production deployment identifier and record the new source commit.
- Existing MONGODB_URI, JWT_SECRET, JWT_EXPIRES_IN, CORS_ORIGIN and freshness/interval configuration remain compatible. Never print environment values. Do not rotate credentials.
- Use Node 22. Reading ingestion and snapshot capture now require MongoDB replica-set/sharded transaction support; Atlas support was confirmed read-only. Standalone local MongoDB must be replaced with a local replica set or the disposable demo.
- Capture counts/digests before any approved maintenance. Run `npm run indexes` against the explicitly verified target: it creates the operational ReadingSnapshot collection/TTL index and additive timestamp/_id reading index. It does not backfill or rewrite historical records. The command was tested idempotently in isolation but has NOT run on Atlas.
- Create a new scoped administrator only when intended, using `ADMIN_BOOTSTRAP_CONFIRM=create npm run admin:create < .env.admin.json`. Prepare that ignored private file securely with name/email/password/scope and optional provinceId or districtId; password must be at least 16 characters and at most 72 UTF-8 bytes. Remove the file securely after use. Never paste credentials into commands, logs, documentation or chat. Existing users are never upgraded or overwritten. Record the legitimate additional user separately from seed preservation counts.
- No reseed or destructive migration is required. Existing documents remain compatible with optional lifecycle fields. Do not run seed against production.
- Check `.env`, `.env.*`, `.vercel`, `.git`, dependency directories, reports, tests and logs are excluded from the deployment bundle according to `.vercelignore`. Never upload private bootstrap input.

## Preview gate

- Deploy the approved source to Preview first and record source commit/deployment ID.
- Run all 17 smoke groups with private authentication and existing read-only checks; inspect health/Atlas, Swagger assets and OpenAPI.
- Verify historical date queries, live stale classification, energy quality and snapshot traversal against actual seed dates. Snapshot requests create only the bounded operational cache, not domain data.
- Run destructive CRUD/concurrency demonstrations only in the isolated demo or a separately approved test database. Do not create test readings or archive production seed installations.
- Compare all six domain counts/digests to the correct pre-release baseline. Account explicitly for any approved administrator provisioning.
- Review Preview evidence before requesting Production approval.

## Production and rollback

- Deploy only after Preview passes and Production is approved. Record final URL, source hash and deployment identifier.
- Repeat the 17 smoke groups and relevant read-only historical/freshness/energy/snapshot checks. Verify Swagger and six domain counts/digests. Stop and report any failure.
- Before any use of new CRUD, an earlier code deployment can be restored; additive indexes/cache can remain safely.
- After installations have been archived, **do not roll back to the old pre-archive application**: it does not enforce archival and could accept readings for archived sites. Use an archive-aware rollback build or a forward fix. Never restore seed data or undo historical readings to roll back code.
- Snapshot sessions expire naturally; replacement invalidates the prior session. Do not rotate JWT secrets merely to clear snapshots.

## Submission

- Confirm public HTTPS Swagger and API availability after release.
- Student independently writes the required report, conceptual model and trade-off discussion; preserves prompts/AI disclosure; completes signed declaration and collaborator access; prepares for the viva.
