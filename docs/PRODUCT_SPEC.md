# LOCKED PRODUCT SPEC

(Quelle: Nutzer-Spezifikation, final und verbindlich)

## Plattformen
- iOS & Android (React Native / Expo). App veröffentlichbar im App Store & Play Store.

## Lokal-first & Sicherheit
- Alles standardmäßig lokal. SQLite als Source of Truth.
- E2E-Master-Key im OS-Keystore; optionale Passphrase (vom Nutzer, nicht speichern).
- Export/Import & Cloud-Backups: immer AES-GCM verschlüsselt (Recovery-Key Flow).

## Eingabe
- Text, Sprache (on-device bevorzugt; nur wenn nicht verfügbar → Hinweis, kein Zwang zu Online-ASR), Datei-Uploads (Dokumente), Bilder, Videos, Audios.

## KI-Funktionen (Opt-in)
- Automatische Kategorisierung (z. B. Business/Privat/…), Tags & Entitäten, Kurz-Zusammenfassung.
- Smarte Suche in natürlicher Sprache.
- Offline-Embeddings on-device (onnxruntime) + Keyword-Suche. Online-KI nur bei explizitem Opt-in, strikt über Backend-Env (`EMERGENT_LLM_KEY`) – keine Keys im Client.
- KI-Opt-in-Gate im Onboarding + in Settings ein/aus.

## Kontextfelder
- Zeitstempel immer.
- Standort nur optional mit klarer Einwilligung; default AUS.

## Anhänge & Speicherstrategie
- Soft-Limits + „Speicher sparen“-Option:
  - Per-Datei Soft-Limit 200 MB (nur Hinweis, nie blockieren).
  - Globaler App-Speicher-Schwellenwert (z. B. 5 GB) → sanfter Hinweis mit 1-Klick „Optimieren“.
  - „Optimieren“: Bilder → WebP/JPEG komprimieren; Audio → AAC; Video → H.264/H.265 – alles lokal. Originale behalten oder nach Zustimmung ersetzen.
  - Einstellbar: Warnungen AUS, Schwellenwerte ändern, Speicherübersicht (Größen pro Kategorie).
  - Wenn Cloud aktiviert: Option „Große Anhänge automatisch in verschlüsselten Cloud-Snapshot auslagern“.

## Cloud (Upgrade, opt-in)
- iCloud Drive (Files Picker), Google Drive (appDataFolder), WebDAV/Nextcloud. Alles als verschlüsselte Snapshots.
- Kein Sync-Zwang, zuerst manuelle Backups/Restore. Später optionaler Delta-Sync.

## Recht & Datenschutz (blocking gates)
- Onboarding: (1) AGB/DS, (2) Recording-Hinweis + Pflicht-Checkboxen, (3) KI-Opt-in separat.
- Im Audit-Log speichern (Zeit, Version, Häkchen).
- Settings: „Recht & Datenschutz“. Deutlicher Aufnahme-Indikator.

## UX
- Startscreen: Suche (natürlichsprachlich), großes Eingabefeld, Buttons: Merken, Merken (Voice), Anhang.
- Liste: neueste zuerst, Chips (Kategorie/Tags/Entitäten), Aktionen: Kopieren, Bearbeiten, Löschen.
- Detail: Volltext, KI-Infos, Anhänge, Zeit/Ort (falls vorhanden).
- Suche: Keyword + Embedding; zeigt Originalnotizen mit Datum, Quelle & Hervorhebung.

## Implementierungsschritte
1. Phase 1: Offline-First Fundament (SQLite, UI-Rewiring)
2. Phase 2: Snapshots & E2E-Backups (Dateien/Anhänge, Optimieren, Cloud-Stubs)
3. Phase 3: KI (Backend-Annotation, Offline-Embeddings, Opt-in)
4. Phase 4: Onboarding/Consent + Audit + Recording-Banner
5. Phase 5: Polish/Tests/Accessibility

## Akzeptanzkriterien (Auszug)
- „Schraubenzieher“-Use Case: Eintrag heute, Treffer in 2 Jahren via natürlicher Frage mit Datum & Kontext.
- Offline funktionsfähig (anlegen/suchen/anzeigen/Export/Import) ohne Cloud.
- KI nur bei Opt-in; ohne Opt-in funktionieren Heuristiken + Offline-Embeddings.
- Speicher-Management: Warnung bei Schwellenwerten, 1-Klick-Optimieren, abschaltbar.