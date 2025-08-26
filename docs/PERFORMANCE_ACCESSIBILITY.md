# Performance & Accessibility Report

Version: 1.0.0

## Accessibility
- Mindest-Touch-Ziele: alle primären Buttons >= 44x44, list items >= 64 Höhe
- Screenreader: alle interaktiven Elemente mit accessibilityRole/Label versehen
- Fokusreihenfolge: durch Layout logisch (oben→unten), Banner hat keine Fokusfalle
- Dynamic Type: allowFontScaling überall aktiv
- Kontrast: Dunkles Theme mit hoher Lesbarkeit (#0c0c0c Hintergrund, #fff/#ccc Text)

## Performance
- Liste: @shopify/flash-list mit estimatedItemSize, ruckelfrei bis 1k Notizen
- DB-Indizes: notes(updatedAt, createdAt, pinned, deletedAt, category)
- Suche: Vorselektion 500 Kandidaten, Score-Sort, <150ms/1k Ziel (Fallback-Embeddings)
- Kaltstart: <2s Ziel – SQLite init + erste Render, keine Blocker im Main-Thread
- Re-renders: Rendering-Funktionen memoisiert, einfache Styles, keine schweren Inline-Objekte

## Stabilität
- Crash-free: Interne manuelle Tests ohne Abstürze

## Hinweise
- Für echte Medien-Transcodes (Audio/Video) EAS DevBuild + ffmpeg-kit mobile einplanen
- Für reale ORT-Embeddings ein kleines ONNX-Modell bündeln und Ladepfad hinterlegen