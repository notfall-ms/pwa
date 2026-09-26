# Bluetooth-Nachrichten mit dem Windows-Sender

Die bestehende `bluetooth.ts` verwendet weiterhin die Geräteauswahl und liest einen vollständigen UTF-8-JSON-Feed. HTTPS (oder localhost), ein Browser mit Web Bluetooth und ein BLE-GATT-Sender sind erforderlich. Die PWA selbst ist kein BLE-Sender.

## GATT-Vertrag

| Funktion | UUID | Property |
| --- | --- | --- |
| Service (auch im Advertising) | `7b183224-9168-443e-a927-7aeea07e1000` | — |
| Nachrichten: Laptop → PWA | `7b183224-9168-443e-a927-7aeea07e1001` | READ |
| Empfangsbestätigung: PWA → Laptop | `7b183224-9168-443e-a927-7aeea07e1002` | WRITE |

```json
{
  "messages": [
    {
      "id": "msg-1727340000000",
      "title": "Treffpunkt",
      "message": "Kommt zum Prinzipalmarkt.",
      "text": "Kommt zum Prinzipalmarkt.",
      "timestamp": "2026-09-26T11:45:00.000Z",
      "expiresAt": "2026-09-26T14:00:00.000Z"
    }
  ]
}
```

`id`, `title` und `timestamp` sind Pflichtfelder. Der Inhalt wird mit `message ?? text` normalisiert und muss ein String sein. `timestamp` ist ein gültiger ISO-8601-UTC-Zeitstempel mit `Z` und bleibt unverändert. Ein altes `text`-Feld ersetzt keinen fehlenden Zeitstempel. `text`, `expiresAt` und `demo` (Boolean) sind optional. Ungültiges UTF-8, JSON oder eine ungültige Nachricht verhindern die Verarbeitung des gesamten Feeds und lösen kein ACK aus.

## Speicherung und Bestätigung

Nach der Validierung speichert die PWA Nachrichten nach `id` dedupliziert, die zufällige Geräte-ID und ausstehende ACK-IDs zusammen in `localStorage` unter `notfall-ms-pager-inbox-v1`. Die Geräte-ID wird beim ersten erfolgreichen Empfang als `pwa-${crypto.randomUUID()}` erzeugt und dauerhaft wiederverwendet. Sie enthält keine Hardware-Adresse oder personenbezogenen Daten. Löschen der Website-Daten entfernt auch diese ID.

Erst wenn die Speicherung erfolgreich war, sendet die PWA für jede ausstehende ID UTF-8-JSON an `…1002`:

```json
{
  "messageId": "msg-1727340000000",
  "deviceId": "pwa-550e8400-e29b-41d4-a716-446655440000",
  "status": "received",
  "timestamp": "2026-09-26T11:46:12.000Z"
}
```

Der ACK-Zeitstempel beschreibt den Bestätigungsversuch, nicht den Erstellungszeitpunkt der Nachricht. ACKs verwenden `writeValueWithResponse`, damit Schreibfehler erkennbar sind. Eine reine WRITE_WITHOUT_RESPONSE-Characteristic gilt in dieser Implementierung als nicht verfügbar.

Bei ACK-Schreibfehlern bleiben Nachricht und ausstehendes ACK lokal erhalten. Nach jedem erfolgreichen Read wird die Warteschlange erneut versucht, auch wenn der neue Feed leer ist. Erfolgreiche ACKs werden aus der Warteschlange entfernt. Nach erneutem Lesen derselben ID entsteht kein doppelter Eintrag; bereits bestätigte IDs werden nicht erneut bestätigt. Falls der BLE-Write erfolgreich war, aber das anschließende lokale Entfernen fehlschlägt, kann dasselbe ACK erneut ankommen. Der Sender sollte ACKs anhand `(deviceId, messageId)` idempotent behandeln.

Fehlt `…1002` wie beim aktuellen Sender-v4, funktioniert der Empfang weiter. Die Oberfläche meldet die fehlende Unterstützung; ACKs bleiben für spätere Verbindungen gespeichert. Nach Ergänzung der Characteristic am Sender erneut koppeln. Die Sender-Firmware ist nicht Teil dieses Repositorys.

## Anzeige und Polling

Beim Koppeln wird sofort gelesen. Manuelles Aktualisieren und die gespeicherte Intervallauswahl bleiben erhalten: 15 Sekunden, 30 Sekunden, 1 Minute (Standard), 5 Minuten oder nur manuell. Automatische Abrufe laufen nur bei sichtbarer App und bestehender Verbindung; parallele Reads werden zusammengefasst. Es werden keine GATT-Notifications verwendet.

Nachrichten bleiben nach Neuladen und Verbindungsverlust verfügbar. Nur wenn keine Nachrichten gespeichert sind, erscheint die gekennzeichnete Demo. Abgelaufene Nachrichten werden bei der Anzeige herausgefiltert; ihre Datensätze bleiben zur Deduplizierung und für ausstehende ACKs gespeichert. Empfangene Inhalte werden als Text dargestellt.

## Prüfung am Sender

1. Mit Sender-v4 ohne `…1002` koppeln: Nachricht erscheint und bleibt nach Neuladen erhalten.
2. Mit WRITE-Characteristic koppeln: vollständiges ACK für die gespeicherte Nachricht prüfen.
3. Dieselbe ID wiederholt lesen: keine doppelten Nachrichten oder bereits erfolgreichen ACKs.
4. ACK-Write fehlschlagen lassen, wieder koppeln: gleiche Geräte-ID und erneutes ACK.
5. Abgelaufene Nachrichten, ungültige Daten, Verbindungsabbruch und blockierten lokalen Speicher prüfen.

Automatisierte Tests verwenden GATT-Mocks. Ein echter Windows-/Handy-Hardwaretest ist zusätzlich erforderlich.

API-Referenz: [Web Bluetooth](https://developer.chrome.com/docs/capabilities/bluetooth).
