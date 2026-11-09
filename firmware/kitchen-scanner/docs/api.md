# Kitchen Scanner – API-Vertrag

Endpunkt für den ESP32-Küchenscanner. Implementierung: `api/pantry/scan.js`, Regeln: `server/pantryScan.cjs`
(Tests: `tests/pantryScan.test.cjs`).

## Einrichtung (Vercel)

| Variable | Inhalt |
| --- | --- |
| `KITCHEN_SCANNER_DEVICES` | JSON `{"kueche-1":"<Token, mind. 16 Zeichen>"}` – ein Token pro Gerät |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Service-Account (oder `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) |

Token erzeugen: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`.
Das Token legt fest, als welches Gerät gebucht wird. Wird das Token ausgetauscht, ist nur dieses Gerät betroffen.

Die Admin-SDK umgeht die Realtime-Database-Regeln. Die **App** (Clients) braucht aber Lese-/Schreibrechte auf
`family_hub_pantry`, `family_hub_pantry_log`, `family_hub_pantry_unknown`, `family_hub_shopping_lists`,
`family_hub_shopping_items` – falls die Regeln Schlüssel einzeln freigeben, müssen diese fünf ergänzt werden.

## Anfrage

`POST https://<host>/api/pantry/scan`

```
Authorization: Bearer <Geräte-Token>
Content-Type: application/json
```

```json
{
  "device_id": "kueche-1",
  "event_id": "kueche-1-000123",
  "barcode": "4000417025005",
  "action": "remove",
  "quantity": 1
}
```

| Feld | Regel |
| --- | --- |
| `device_id` | optional; wenn gesetzt, muss es zum Token passen (sonst 403) |
| `event_id` | 6–64 Zeichen `A-Z a-z 0-9 _ -`; pro Buchung eindeutig und bei Wiederholung **gleich** |
| `barcode` | nur Ziffern, 6–14 Stellen (EAN-8/13, UPC-A, ITF-14) |
| `action` | `add` (einlagern) oder `remove` (entnehmen) |
| `quantity` | ganze Zahl 1–99, Standard 1 |

Maximale Größe: 2000 Byte.

## Antwort (HTTP 200)

```json
{ "status": "ok", "event_id": "kueche-1-000123", "name": "Milch", "unit": "Stk",
  "applied": -1, "quantity_after": 1, "restocked": true }
```

| `status` | Bedeutung | Gerät |
| --- | --- | --- |
| `ok` | gebucht (`applied`, `quantity_after`; `restocked: true` = steht jetzt auf der Einkaufsliste) | grün, Ereignis löschen |
| `unknown_product` | EAN nicht im Vorrat; landet im Eingang „Neu gescannt“ der App, bei **Einlagern** wird die Menge später bei der Zuordnung gebucht | gelb, Ereignis löschen |
| `not_in_stock` | Entnehmen bei Bestand 0 – nichts verändert | rot, Ereignis löschen |
| `duplicate` | `event_id` war schon verarbeitet (`original_status` nennt das Ergebnis) | wie `original_status`, Ereignis löschen |

Entnahmen werden auf den vorhandenen Bestand begrenzt (`applied` zeigt, was wirklich abgezogen wurde).

## Fehlercodes

| HTTP | Bedeutung | Gerät |
| --- | --- | --- |
| 400 | Anfrage ungültig (`error`: `invalid_event_id`, `invalid_barcode`, `invalid_action`, `invalid_quantity`, `invalid_request`) | Ereignis verwerfen, nicht wiederholen |
| 401 | Token fehlt/falsch | Fehler anzeigen, Ereignis behalten |
| 403 | `device_id` passt nicht zum Token | Konfiguration prüfen |
| 405 | falsche Methode | – |
| 413 | Body zu groß | Ereignis verwerfen |
| 5xx / Netzwerk / Timeout | nicht gebucht oder unklar | Ereignis **im Puffer behalten**, später mit derselben `event_id` erneut senden |

## Wiederholung und Idempotenz

- Gebucht gilt nur, was der Server mit `status` ≠ Fehler bestätigt hat.
- Jede Buchung bekommt einmal eine `event_id` (z. B. Gerätename + laufende Nummer im Flash). Sie wird bei jedem
  Wiederholungsversuch unverändert gesendet. Der Server bucht sie genau einmal; weitere Sendungen liefern `duplicate`.
- Ein Ereignis, das mitten in der Verarbeitung abbricht, wird vom Server wieder freigegeben (Wiederholung klappt);
  hängengebliebene Reservierungen werden nach 60 s neu vergeben.
- Empfohlenes Backoff im Gerät: 2 s, 5 s, 15 s, 60 s, danach alle 60 s.

## Nachkauf-Regel

Sinkt der Bestand durch `remove` auf oder unter den Mindestbestand (vorher darüber), legt der Server den Eintrag
`auto-<Vorrats-ID>` auf der Einkaufsliste an (gewählte Liste des Artikels, sonst die erste, sonst „Supermarkt“).
Ein bereits offener Eintrag wird nicht doppelt angelegt. Dieselbe Regel gilt in der App.

## Beispiel

```bash
curl -X POST https://<host>/api/pantry/scan \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"event_id":"test-000001","barcode":"4000417025005","action":"add","quantity":2}'
```
