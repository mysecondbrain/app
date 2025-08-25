# Project Operations & Security SOP

This repo follows a strict security posture to protect secrets and user data.

## Secrets Handling
- Never commit real secrets. Use `.env` files locally and CI/CD secret stores.
- Backend secrets live in `backend/.env` (not committed). See `backend/.env.example`.
- Frontend public config lives in `frontend/.env` for Expo (no secrets). See `frontend/.env.example`.
- All API calls must use relative `/api/*` paths per ingress rules or EXPO_PUBLIC_BACKEND_URL.

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
3. Rewrite history to purge the secret (or use an orphan export for a clean baseline).
4. Enable push protection and require status checks.

## Lokaler Speicher & Backups
- Offline-First: SQLite (expo-sqlite) als primäre Datenquelle. Tabellen: `notes`, `settings`, `audit`.
- Migrationen: Schema-Version in `settings(schema_version)`; Migrations-Helper im Modul `src/storage/db.ts`.
- Snapshots (E2E): Lokaler Export/Import in `src/storage/snapshots.ts` mit AES-GCM über `@noble/ciphers`.
  - Master-Key wird über `expo-secure-store` verwaltet (Recovery-Key als Base58 angezeigt).
  - Export: erstellt verschlüsselte `.onsnap`-Datei und teilt über native Shares (iOS Dateien/iCloud, Android Drive/Dateien).
  - Import: Auswahl über Document Picker, Entschlüsselung und Restore aller Tabellen.

## Development
- Backend runs at 0.0.0.0:8001, routes under `/api`. Reads Emergent LLM key from env.
- Frontend uses Expo Router. Calls backend via `EXPO_PUBLIC_BACKEND_URL`.