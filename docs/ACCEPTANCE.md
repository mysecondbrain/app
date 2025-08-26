# ACCEPTANCE TEST PLAN (Phase 1–3)

## Ziel
Validierung Phase 1–3: Offline-First, E2E-Snapshots inkl. Anhänge, Speicherverwaltung mit Optimieren (Bilder), KI (ENV-basiert) + Offline-Embeddings + Kombi-Suche.

## Voraussetzungen
- App gestartet (Expo Go/Preview OK). Keine Internetverbindung für Offline-Tests nötig. Für KI optional ENV-Key.

## Phase 1–2 Tests
(Siehe vorherige Liste in diesem Dokument)

## Phase 3 Tests
1) KI-Opt-in
- Settings → „Online-KI erlauben“ auf AN
- Erwartet: Toggle speichert sich; Detail-View bietet „KI aktualisieren“

2) KI-Annotation
- Notiz-Detail → „KI aktualisieren“
- Erwartet: Kategorien/Tags/Summary werden gefüllt (bei ENV-Key) oder Fallback ohne Fehler

3) Embeddings-Index Rebuild
- Settings → „Reindex starten“
- Erwartet: Fortschritt wird angezeigt, danach „Fertig“

4) Kombi-Suche
- Start → natürlichsprachliche Suche (z. B. „Wo liegt der Schraubenzieher?“)
- Erwartet: Trefferliste erscheint, sortiert nach Kombi-Score (Keyword + Cosine)

5) Filter
- Pinned-Filter und Kategorie/Zeitraum im Code verfügbar (UI Pinned vorhanden, erweiterbar)

6) Performance
- Bei 1k Notizen <150ms für Suchaufruf (profilierbar; deterministischer Embedding-Fallback bietet konstante Zeit)