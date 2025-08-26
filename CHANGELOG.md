# Changelog

## [Unreleased]
### Added
- Phase 2 (in progress):
  - Snapshot-Format erweitert: Dateien/Anhänge (Base64) gebündelt und E2E verschlüsselt.
  - Speicherverwaltung-Screen mit realem „Optimieren“-Flow für Bilder (via expo-image-manipulator, falls verfügbar), Stubs für Audio/Video.
  - Cloud-Adapter-Stubs (iCloud/Drive/WebDAV) vorbereitet.

### Changed
- DB-Schema v2: `notes.attachments` Spalte (JSON), Migration integriert.

## [Phase 1] - Offline-First/SQLite
### Added
- SQLite als Source of Truth (notes, settings, audit) inkl. Migrationen.
- UI-Rewiring (Start, Detail, Settings) auf lokale DB.
- E2E Snapshots (Basis, ohne Dateien) und Recovery-Key Flow.