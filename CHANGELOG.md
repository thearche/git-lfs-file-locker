# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) und dieses Projekt hält sich an die [Semantische Versionierung](https://semver.org/spec/v2.0.0.html).

---

## [0.5.0] - 2025-08-07

### Hinzugefügt (Added)

- **Icon im Webview:** Die Webview für aktive Git LFS Locks zeigt nun ein Icon in der Titelleiste an.

### Behoben (Fixed)

- **Bugfix bei AL-Dateien im Workspace:** Verbesserte Behandlung von AL-Dateien und deren Layout-Pfaden im Workspace-Kontext.

## [0.4.0] - 2025-07-10

### Hinzugefügt (Added)

- **Intelligentes Sperren für AL-Dateien:** Beim Versuch, eine `.al`-Datei zu sperren oder zu entsperren, findet die Erweiterung nun automatisch die zugehörige Layout-Datei (z.B. `.docx`) und führt die Aktion auf diese aus.

### Geändert (Changed)

- **Native Tree View:** Die bisherige Webview in der Aktivitätsleiste wurde durch eine native VS Code Tree View ersetzt. Diese listet alle gesperrten Dateien übersichtlich auf und bietet eine bessere Performance und ein konsistenteres UI-Erlebnis.
- **Detaillierte Ansicht im Editor:** Die ursprüngliche, detaillierte Tabellenansicht der Locks wird nun über einen Befehl in der Titelleiste der Tree View in einem eigenen Editor-Tab geöffnet.
- **Code-Refactoring:** Interne Hilfsfunktionen wurden in eine separate `utils.ts`-Datei ausgelagert, um die Codebasis sauberer und wartbarer zu machen.

### Behoben (Fixed)

- **Pfadauflösung für AL-Layouts:** Ein Fehler wurde behoben, bei dem der Pfad zur Layout-Datei relativ zur `.al`-Datei statt zum Workspace-Root aufgelöst wurde.

## [0.3.0] - 2025-06-25

### Hinzugefügt (Added)

- **Webview für aktive Git LFS Locks:** Eine neue Webview zeigt alle aktiven Git LFS Locks als Tabelle an. Die Tabelle enthält die Spalten: ID, Dateipfad (klickbar), Gesperrt von, Gesperrt am und Aktion (Entsperren).
- **Direktes Entsperren aus der Webview:** Dateien können jetzt direkt aus der Webview über einen Entsperren-Button entsperrt werden.
- **Öffnen im VS Code Explorer:** Ein Klick auf den Dateipfad in der Webview öffnet die entsprechende Datei im VS Code Explorer.
- **Automatische und manuelle Aktualisierung der Webview:** Die Webview aktualisiert sich automatisch, wenn sie sichtbar wird, und bietet zusätzlich einen manuellen Refresh-Button.
- **Verbesserte Pfadauflösung:** Die Datei wird nun zuverlässig relativ zum Stammverzeichnis des Git-Repositories gefunden, nicht nur zum Workspace-Ordner.

### Behoben (Fixed)

- **Reveal in Explorer:** Funktioniert jetzt auch, wenn das Workspace-Root nicht mit dem Git-Repository-Root übereinstimmt.

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