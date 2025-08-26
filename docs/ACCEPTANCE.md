# ACCEPTANCE TEST PLAN

## Ziel
Validierung der Phasen 1–2 gemäß LOCKED SPEC: Offline-First + E2E-Snapshots inkl. Anhänge, Speicherverwaltung mit Optimieren-Flow (Bilder-komprimieren), Cloud-Stubs sichtbar.

## Voraussetzungen
- App gestartet (Expo Go/Preview OK). Keine Internetverbindung nötig (nur fürs Teilen/Picker UI optional).

## Testfälle
1) Notiz anlegen (offline-fähig)
- Start: Text in Editor eingeben → „Speichern“
- Erwartet: Neue Notiz erscheint, Zeitstempel gesetzt

2) Live-Suche & Pinned
- Suchfeld befüllen → Liste filtert live (Keyword)
- Pinned-Filter toggeln → Nur gepinnte

3) Detail-Edit
- Notiz öffnen → Text/Tags bearbeiten → Speichern → Zurück

4) Snapshot Export (E2E)
- Settings → „Snapshot exportieren“ → System-Share öffnet
- Erwartet: .onsnap Datei erzeugt

5) Snapshot Import (E2E)
- Settings → „Snapshot importieren“ → Datei wählen
- Erwartet: Daten werden ersetzt; Liste zeigt importierte Notizen

6) Anhänge in Snapshot
- (falls Attachments vorhanden) Export/Import erhält Dateien unter attachments/ wieder

7) Speicherverwaltung
- Settings → Speicherverwaltung
- Zeigt Belegung (DB/Anhänge/Cache)
- Schwellenwert umstellen, Warnungen an/aus speichern

8) Optimieren-Flow (Bilder)
- „Jetzt optimieren“ ausführen
- Erwartet: Mindestens 1 Bild wird komprimiert (falls vorhanden) oder Meldung, wenn image-manipulator nicht verfügbar

9) Cloud-Stubs
- Bereich zeigt iCloud/Drive/WebDAV Stubs (Buttons inaktiv oder Platzhalterfunktion)

## Abnahme
- Alle oben genannten Fälle erfolgreich; keine Crashs; Daten bleiben lokal. Snapshots verschlüsselt.