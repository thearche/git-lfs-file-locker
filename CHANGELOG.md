# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) und dieses Projekt hält sich an die [Semantische Versionierung](https://semver.org/spec/v2.0.0.html).

---

## [0.7.4] - 2026-04-24

### Behoben (Fixed)

- **lockmanager.ts:** Unterstützt nun auch Multi Root Workspaces

---

## [0.7.3] - 2026-04-24

### Behoben (Fixed)

- **package.json:** Enthält nun zusätzlichen Sourcecode in der VSIX Package Datei

---

## [0.7.2] - 2026-04-24

### Hinzugefügt (Added)

- **Automatische Aktualisierung der Sperrliste:** Die Sperrliste wird nun automatisch aktualisiert, wenn:
  - das VS Code-Fenster den Fokus erhält
  - der aktive Texteditor wechselt
  - Arbeitsbereichsordner hinzugefügt oder entfernt werden
  - ein Hintergrund-Intervall (alle 5 Minuten) abläuft, um Änderungen von anderen Benutzern zu erfassen

### Behoben (Fixed)

- **Webview Context:** Behebt einen Fehler, bei dem `extensionUri` in der Webview aufgrund eines falschen Kontexts undefiniert war
- **Extension Entrypoint:** Korrigiert den `main`-Eintrag in `package.json` von `./out/extension.js` zu `./out/main.js`, um sicherzustellen, dass die neueste kompilierte Erweiterung geladen wird

---

## [0.7.1] - 2026-04-22

### Geändert (Changed)

- **Lock/Unlock Logic:** Vereinheitlicht die Lock/Unlock-Logik über alle UI-Eingangspunkte (Explorer-Kontextmenü, Tree-View, Webview)
- **Benutzerfeedback:** Konsistente Benutzeroberfläche mit Popups bei Erfolg und bedingtem Terminal bei Fehlern
- **.AL-Datei-Unterstützung:** Intelligente .AL-Datei-Umleitung funktioniert jetzt in allen Unlock-Methoden

### Behoben (Fixed)

- **Inkonsistente Verhaltensweisen:** Lock- und Unlock-Operationen verhalten sich jetzt identisch unabhängig vom Auslöser
- **Timing-Probleme:** Zustandsaktualisierungen warten jetzt auf den Abschluss der Git-Befehle
- **Redundanter Code:** Mehrfach vorhandene Unlock-Logik wurde in eine einzige Funktion konsolidiert

---

## [0.7.0] - 2026-04-22

### Hinzugefügt (Added)

- **Git LFS Lock Management:** Implementierung der vollständigen Git LFS Lock-Verwaltung mit Decoration Provider und Webview-Integration
- **Datei-Dekorationen:** Visuelle Anzeige von gesperrten Dateien im Explorer mit 🔒-Symbol
- **Webview-Integration:** Detaillierte Ansicht aller aktiven Git LFS Locks in einem separaten Editor-Tab
- **Tree View:** Native VS Code Tree View für Git LFS Locks in der Activity Bar mit Gruppierung nach Datum

---

## [0.6.4] - 2026-04-05

### Geändert (Changed)

- **tags:** Is now keywords

---

## [0.6.3] - 2026-01-31

### Hinzugefügt (Added)

- **package.json:** Mehr Informationen zu der Erweiterung hinzugefügt:
  - activationEvents
  - categories
  - tags
  - license
  - galleryBanner

### Geändert (Changed)

- **Dependencies:** Abhängigkeiten auf den neusten Stand aktualisiert.

- **.vscodeignore angepasst:** Weitere Dateien aus dem VSIX-Paket ausgeschlossen.

---

## [0.6.2] - 2026-01-21

### Hinzugefügt (Added)

- **Homepage hinzugefügt:** `homepage`-Feld in der `package.json` auf `https://github.thearche.de/` gesetzt.

---

## [0.6.1] - 2026-01-13

### Geändert (Changed)

- **.vscodeignore ergänzt:** TypeScript-Dateien und tsconfig werden aus dem VSIX-Paket ausgeschlossen.

## [0.6.0] - 2026-01-13

### Hinzugefügt (Added)

- **Gruppierte Tree View mit Datum:** Die LFS-Locks in der Seitenleiste werden nun nach Zeiträumen (Today, This Week, This Month, Older) gruppiert und lassen sich einklappen.
- **Datumsanzeige in Einträgen:** Jedes Lock zeigt jetzt Datum und Uhrzeit direkt in der Beschreibung der Tree-Items.

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