# ACCEPTANCE TEST PLAN (Phase 1–4)

## Ziel
Validierung Phase 1–4: Offline-First, E2E-Snapshots inkl. Anhänge, Speicherverwaltung mit Optimieren (Bilder), KI (ENV-basiert) + Offline-Embeddings + Kombi-Suche, Onboarding/Consent & Recording-Banner.

## Voraussetzungen
- App gestartet. Für Phase 3 optional Backend-ENV-Key vorhanden. Keine manuellen Setups nötig.

## Phase 1–3 Tests
(Siehe vorherige Liste in diesem Dokument)

## Phase 4 Tests
1) Onboarding Gates (blocking)
- Beim Start ohne „onboarding_done“ → /onboarding wird erzwungen
- Screen 1: AGB/DS Checkbox setzen → Weiter aktiv → führt zu Screen 2
- Screen 2: Recording-Hinweis Checkbox setzen → Weiter aktiv → führt zu Screen 3
- Screen 3: KI-Opt-in optional → Fertig → onboarding_done=1

2) Audit-Logging
- Nach Screen 1: audit(consent_accept)
- Nach Screen 2: audit(recording_ack)
- Nach Screen 3: audit(ai_optin_toggle, meta.optin)
- Settings → Recht & Datenschutz zeigt letzte Zeiten; Export CSV/JSON verfügbar

3) Permissions & Recording
- Voice-Button ohne Recording-Consent → Hinweis (blockiert), kein Permission-Dialog
- Nach Consent: Voice-Button → Permission-Dialog (Mic), Start/Stop, Banner „AUFNAHME LÄUFT“ sichtbar

4) Settings
- „Onboarding erneut durchlaufen“ führt zurück zu /onboarding beim nächsten Eintritt
- KI-Opt-in Toggle persistiert und erzeugt audit(ai_optin_toggle)

5) Banner
- Während Aufnahme ist roter Banner in allen Views sichtbar (global)

Erfolgskriterien
- Alle Gates blockieren korrekt
- Audit korrekt geloggt und exportierbar
- Recording nur nach Consent + Banner sichtbar
- KI-Opt-in toggelbar und geloggt