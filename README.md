# Project Operations & Security SOP

This repo follows a strict security posture to protect secrets and user data.

## Secrets Handling
- Never commit real secrets. Use `.env` files locally and CI/CD secret stores.
- Backend secrets live in `backend/.env` (not committed). See `backend/.env.example`.
- Frontend public config lives in `frontend/.env` for Expo (no secrets). See `frontend/.env.example`.
- All API calls must use relative `/api/*` paths per ingress rules.

## Pre-commit & Scanning
- Install pre-commit hooks:
  - `pip install pre-commit`
  - `pre-commit install`
- Run a full scan before pushing:
  - `gitleaks detect --no-banner --redact --config .gitleaks.toml`

## GitHub Push Protection & History Rewrite
If a secret ever leaks:
1. Rotate the exposed key immediately where it was issued.
2. Remove it from code and config.
3. Rewrite history to purge the secret:
   - Use `git filter-repo` (recommended). Example:
```
# install: pip install git-filter-repo
git filter-repo --path-glob "*.env" --replace-text <(echo "secretreplacement==>REDACTED")
```
   - Force-push protected branches after review: `git push --force-with-lease origin main`
4. Enable GitHub push protection (repo settings) and require status checks.

## Environment Setup
- Backend:
  - Copy `backend/.env.example` to `backend/.env` and set `MONGO_URL`, `DB_NAME`, `EMERGENT_LLM_KEY`.
- Frontend (Expo):
  - Copy `frontend/.env.example` to `frontend/.env`.

## Development
- Backend runs at 0.0.0.0:8001, all routes prefixed with `/api`.
- Frontend uses Expo with file-based routes in `frontend/app`.

## Notes
- Do not modify protected files: `frontend/.env`, `backend/.env`, `frontend/metro.config.js`.
- Use `expo-router`. Avoid web-only libraries.