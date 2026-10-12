# Credential cleanup notes

The cleanup removes tracked environment files, a populated local database snapshot, and Python bytecode. It also removes hardcoded JWT/SMTP/database credentials and automatic creation of privileged and test accounts.

## Actions outside this source change

1. Generate a new JWT `SECRET_KEY` and set it on every running backend. The previously hardcoded key must not remain trusted; changing it invalidates existing login tokens.
2. Replace the MySQL user's password if the previously committed local database connection was real or the password was reused.
3. Inspect the previously committed SMTP sender configuration privately. Revoke and replace any real mail/app password; placeholders do not require rotation.
4. Remove the automatically seeded administrator/client/driver accounts from running databases, or change their passwords and review their roles. Updating source code does not change existing accounts.
5. Review the published SQLite snapshot for real customer information. Its row contents have not been copied into these notes.
6. Set `DATABASE_URL`, `FRONTEND_URL`, `CORS_ORIGINS`, and optional SMTP settings on the host before applying the changes to a running service.

No secret values are recorded in these notes. New credentials must be configured privately; do not paste them into an issue, pull request, or chat.

## Git history

Earlier commits still contain the removed files and old source literals. Rotate credentials first. Any history rewrite requires coordinating clones, branches, tags, and possible forks; it is deliberately outside this cleanup commit. New changes can be reviewed without a force push.

## Scope

This change is credential/repository hygiene with focused account and password-reset safeguards, not a full application security audit. In particular, WebSocket authentication/authorization remains a follow-up before exposing this prototype to real users.
