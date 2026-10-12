# Credential cleanup notes

The cleanup removes tracked environment files, a populated local database snapshot, and Python bytecode. It also removes hardcoded JWT/SMTP/database credentials and automatic creation of privileged and test accounts.

The project owner confirmed that the application was only used locally, its accounts and credentials were for testing, and it was never used publicly. There is no active production deployment to migrate. The provider/account actions below apply only if a test credential was reused for a real service; otherwise no rotation campaign is needed.

## Actions outside this source change

1. Generate a new JWT `SECRET_KEY` and set it on every running backend. The previously hardcoded key must not remain trusted; changing it invalidates existing login tokens.
2. Replace the MySQL user's password if the previously committed local database connection was real or the password was reused.
3. Inspect the previously committed SMTP sender configuration privately. Revoke and replace any real mail/app password; placeholders do not require rotation.
4. Remove the automatically seeded administrator/client/driver accounts from running databases, or change their passwords and review their roles. Updating source code does not change existing accounts.
5. Review the published SQLite snapshot for real customer information. Its row contents have not been copied into these notes.
6. Set `DATABASE_URL`, `FRONTEND_URL`, `CORS_ORIGINS`, and optional SMTP settings on the host before applying the changes to a running service.

No secret values are recorded in these notes. New credentials must be configured privately; do not paste them into an issue, pull request, or chat.

## Git history

Earlier commits still contain the removed files and old source literals. If any credential was reused for a real service, rotate that credential first. A history rewrite is not required for the confirmed local test-only data. Any later rewrite would require coordinating clones, branches, tags, and possible forks. This cleanup preserves history and does not use a force push.

## Scope

This change is credential/repository hygiene with focused account and password-reset safeguards, not a full application security audit. In particular, WebSocket authentication/authorization remains a follow-up before exposing this prototype to real users.
