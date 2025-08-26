# Changelog

## [Unreleased]
### Added
- Phase 3 (in progress):
  - Backend /api/ai/annotate produktiv: ENV-Key, Timeout/Backoff, Rate-Limit, robustes JSON Parsing + Fallbacks.
  - Offline-Embeddings: SQLite-Tabelle embeddings(noteId, vec BLOB, updatedAt), Reindex-Flow, inkrementeller Upsert vorgesehen.
  - Kombi-Suche: Keyword + Cosine, Ranking/Filter, natürlichsprachliche Suche im UI.
  - KI-Opt-in Toggle (Settings), KI-Update im Detail.

### Changed
- DB-Schema v2: `notes.attachments` Spalte (JSON), Migration integriert.

## [Phase 1] - Offline-First/SQLite
### Added
- SQLite als Source of Truth (notes, settings, audit) inkl. Migrationen.
- UI-Rewiring (Start, Detail, Settings) auf lokale DB.
- E2E Snapshots (Basis, ohne Dateien) und Recovery-Key Flow.

## [Phase 2] - Snapshots & E2E-Backups
### Added
- Snapshot-Format erweitert: Dateien/Anhänge (Base64) eingebettet und E2E verschlüsselt.
- Speicherverwaltung-Screen mit „Optimieren“-Flow für Bilder (expo-image-manipulator optional), Stubs für Audio/Video.
- Cloud-Adapter-Stubs (iCloud/Drive/WebDAV) vorbereitet.