# Bluetooth-Nachrichten

Im Stadt-Pager öffnet „Bluetooth koppeln“ die Geräteauswahl des Browsers. Ein kompatibler BLE-Sender muss folgenden GATT-Vertrag anbieten:

- Service UUID: `7b183224-9168-443e-a927-7aeea07e1000` (auch im Advertising)
- Lesbare Characteristic UUID: `7b183224-9168-443e-a927-7aeea07e1001`
- Wert: vollständiges UTF-8-JSON, beispielsweise `{"messages":[{"id":"1","title":"Treffpunkt","text":"Nachricht vom Sender"}]}`
- Optional pro Nachricht: `demo` (Boolean), `expiresAt` (ISO-Datum).

Jeder GATT-Read liefert einen vollständigen Feed (maximal 512 Byte entsprechend dem GATT-Characteristic-Limit); Fragmentierung über mehrere Notifications wird nicht verwendet. Der Sender muss längere Reads gegebenenfalls über GATT Read Blob unterstützen. Die App liest beim Koppeln, bei manueller Aktualisierung und im gewählten Intervall (15 Sekunden, 30 Sekunden, 1 Minute oder 5 Minuten; Standard: 1 Minute) im sichtbaren Tab bei bestehender Verbindung. „Nur manuell“ schaltet den Timer aus; beim Koppeln wird weiterhin sofort gelesen. Die Auswahl wird lokal gespeichert und Änderungen starten das Intervall neu. Es gibt keine Hintergrundaktualisierung bei geschlossener App und keine GATT-Notifications. Inhalte werden vor der Anzeige validiert und als Text gerendert. Abgelaufene Nachrichten werden ausgeblendet.

Ohne Verbindung, bei Abbruch, ungültigen Daten oder einem Lesefehler erscheint die lokal gebündelte, sichtbar als Demo markierte Beispielnachricht. „Bluetooth trennen“ beendet die Verbindung. Eine neue Kopplung erfordert einen Klick.

Erforderlich sind HTTPS (oder localhost), ein Browser mit Web Bluetooth und ein BLE-Sender mit diesem Vertrag. Zwei Browser können damit nicht direkt miteinander chatten: Die Web-App ist GATT-Client, der Sender muss als GATT-Server implementiert sein. Das Repository enthält keine Sender-Firmware. UUIDs bei vorhandener Hardware in `bluetooth/bluetooth.ts` anpassen.

Referenz: https://developer.chrome.com/docs/capabilities/bluetooth

Manueller Hardwaretest: Sender auswählen, Nachricht mit Umlauten lesen, Feed ändern und aktualisieren, Sender ausschalten und Demo-Fallback prüfen. Zusätzlich Abbruch der Geräteauswahl und einen Browser ohne Web Bluetooth testen.
