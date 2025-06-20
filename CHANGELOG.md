# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) und dieses Projekt hält sich an die [Semantische Versionierung](https://semver.org/spec/v2.0.0.html).

---

## [0.2.0] - 2025-06-19

### Hinzugefügt (Added)

- **Neue Übersicht für LFS-Sperren:** Ein neuer Befehl `Git LFS: Show Active Locks` wurde hinzugefügt (aufrufbar über die Befehlspalette). Dieser öffnet ein neues Fenster, das alle aktiven LFS-Sperren im Repository in einer übersichtlichen Tabelle anzeigt. Die Tabelle enthält die Sperr-ID, den Dateipfad, den Besitzer und das Sperrdatum.

### Geändert (Changed)

- **Verbesserte Zuverlässigkeit:** Die Logik zum Parsen der `git lfs locks --json`-Ausgabe wurde robuster gestaltet, um verschiedene Ausgabeformate von Git LFS korrekt zu verarbeiten.

### Behoben (Fixed)

- Ein Fehler wurde behoben, der auftrat, wenn keine LFS-Sperren im Repository vorhanden waren. Die Erweiterung zeigt nun eine informative Nachricht an, anstatt einen Fehler zu verursachen.

## [0.1.0] - (Datum der ersten Version)

- Erste Veröffentlichung der Erweiterung.
- Befehle zum Sperren (`Git LFS: Lock File`) und Entsperren (`Git LFS: Unlock File`) von Dateien über das Kontextmenü im Explorer hinzugefügt.