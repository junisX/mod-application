# Mod Application

Bewerbungsformular für Community-Moderatoren (Twitch / Discord). Zehn Fragen, eine pro Schritt,
danach geht die Bewerbung als Discord-Embed raus.

Das Projekt hat **keine Dependencies**: das Backend nutzt ausschließlich Node-Bordmittel
(`node:http`, globales `fetch`), das Frontend ist pures HTML/CSS/JavaScript ohne Build-Schritt.

## Struktur

```text
/
├── frontend/
│   ├── index.html      # Alle Ansichten (Start, Formular, Alterssperre, Erfolg, Fehler)
│   ├── styles.css      # Dark-UI
│   └── app.js          # Fragen, Navigation, Bewerbung senden
├── backend/
│   ├── server.js       # HTTP-Server, Routing, Static, Sicherheits-Header
│   ├── application.js  # Fragen-Schema, Validierung, Discord-Embed
│   ├── rate-limit.js   # In-Memory Limit gegen Spam
│   └── env.js          # Lädt .env nur lokal (im Hosting greifen die echten Env-Vars)
├── api/
│   └── apply.js        # Vercel-Funktion für das GitHub-Pages-Frontend
├── deploy/
│   └── Dockerfile      # Für Docker-Hosts
├── .github/workflows/
│   └── pages.yml       # Deployment des Frontends auf GitHub Pages
├── .env.example
├── render.yaml
├── package.json
└── README.md
```

## Lokal starten

```bash
cp .env.example .env      # DISCORD_WEBHOOK_URL eintragen
npm start
```

Danach läuft die Seite auf <http://localhost:3000>. Node-Version: **18.17 oder neuer**.

## Environment Variable

| Variable              | Pflicht | Beschreibung                                  |
| --------------------- | ------- | --------------------------------------------- |
| `DISCORD_WEBHOOK_URL` | ja      | Webhook des Ziel-Channels. Wird nur serverseitig gelesen. |
| `PORT`                | nein    | Port des Node-Servers, Standard `3000`.       |
| `ALLOWED_ORIGINS`     | nein    | Erlaubte Frontend-Domains für die Vercel-Funktion, Standard `https://junisx.github.io,http://localhost:3000`. |

Der Webhook liegt ausschließlich im Backend. Im Frontend steht nur die API-Adresse
(`<meta name="api-base">`), und die ist kein Secret: sie zeigt entweder auf die eigene Domain
(Node-Host) oder auf die Vercel-Funktion (GitHub Pages). Es gibt keine Webhook-URL und keine
Secrets im Client-Code, in `localStorage` oder im `sessionStorage`.

## API

`POST /api/apply`

```json
{
  "answers": {
    "age": "16_17",
    "platform": "both",
    "moderation": "yes",
    "activity": "2_4",
    "online": "daily",
    "character": "relaxed",
    "spam": "point_out",
    "insults": "step_in",
    "skills": "good",
    "motivation": "support"
  },
  "platform": "twitch",
  "website": ""
}
```

- `answers` – alle zehn Fragen, Werte müssen den Slugs in `backend/application.js` entsprechen.
- `platform` – optionale Auswahl von der Startseite (`twitch`, `discord`, `both`).
- `website` – Honeypot, muss leer bleiben. Gefüllte Felder werden verworfen (Antwort bleibt `200`).

Antwort: `{ "ok": true }` oder `{ "ok": false, "error": "..." }` mit passendem Status
(`400` Validierung, `413` zu groß, `415` falscher Content-Type, `422` unter 13 Jahren,
`429` Rate Limit, `502`/`503` Discord nicht erreichbar).

Die Vercel-Variante beantwortet zusätzlich `OPTIONS` (CORS-Preflight) und setzt
`Access-Control-Allow-Origin` ausschließlich für die Domains aus `ALLOWED_ORIGINS`.

`GET /api/health` – `{ "status": "ok" }` für den Health-Check des Hostings.

Die Antworttexte für den Nutzer sind in `frontend/app.js` hinterlegt; das Backend liefert nur
unbedenkliche Meldungen zurück.

## Deployment

### GitHub Pages (Frontend) + Vercel (API)

Aktueller Aufbau: die Oberfläche liegt statisch auf GitHub Pages, die API läuft als
Serverless-Funktion auf Vercel. Der Webhook existiert nur in der Vercel-Umgebung, das Frontend
kennt ihn nicht.

**Vercel**

1. Repository importieren, Framework Preset **Other** (nicht als Container – ein `Dockerfile` im
   Root lässt Vercel sonst einen Container-Service bauen und ignoriert `api/`; deshalb liegt es in
   `deploy/`).
2. Unter *Settings → Environment Variables* die Variable `DISCORD_WEBHOOK_URL` für *Production*
   anlegen (der Wert ist danach nicht mehr auslesbar, Typ `sensitive`).
3. Deployen: `vercel --prod` – die API ist dann unter `https://<projekt>.vercel.app/api/apply`
   erreichbar.

**GitHub Pages**

1. *Settings → Pages* → Source **GitHub Actions** (einmalig).
2. *Settings → Secrets and variables → Actions → Variables* → `API_BASE` auf die Vercel-Domain
   setzen, z. B. `https://mod-bewerbung.vercel.app`.
3. `.github/workflows/pages.yml` veröffentlicht `frontend/` und ersetzt dabei den Platzhalter
   `__API_BASE__` in `index.html` durch `API_BASE`.

Die Funktion erlaubt per CORS nur die in `ALLOWED_ORIGINS` gelisteten Domains
(Standard: `https://junisx.github.io,http://localhost:3000`).

Hinweis zu Lovable: Lovable hostet nur Frontends (plus Supabase als Backend) und kann keinen
eigenen Server mit Secrets betreiben – ein Webhook ließe sich dort also nicht versteckt
serverseitig ablegen. Ein separates Backend ist dafür nicht nötig, die Vercel-Funktion ist
dieselbe Logik wie der Node-Server. Das Frontend bleibt reines HTML/CSS/JS und lässt sich
jederzeit in ein React/Vite-Setup übernehmen.

### Alles auf einem Node-Host (Render, Railway, Fly.io, eigener Server)

Wenn Frontend und API auf derselben Domain liegen sollen, übernimmt `backend/server.js` beides –
dann bleibt `__API_BASE__` in `index.html` stehen und die Seite spricht `/api/apply` auf der
eigenen Domain an.

`render.yaml` ist im Repo enthalten, damit lässt sich der Service direkt anlegen
(New → Blueprint → Repo auswählen). Alternativ manuell:

- Runtime: Node
- Build Command: *(leer lassen)*
- Start Command: `npm start`
- Health Check Path: `/api/health`

Danach im Dashboard unter **Environment** die Variable `DISCORD_WEBHOOK_URL` als Secret setzen
(in `render.yaml` steht sie mit `sync: false`, damit sie nicht im Repo landet).

### Docker

```bash
docker build -f deploy/Dockerfile -t mod-application .
docker run -p 3000:3000 -e DISCORD_WEBHOOK_URL=... mod-application
```

`.env` und `.env.*` sind in `.gitignore`, `.dockerignore` und `.vercelignore` ausgeschlossen und
landen weder im Repository noch im Image oder im Deployment.

## Sicherheit

- Webhook nur serverseitig über `DISCORD_WEBHOOK_URL`
- Serverseitige Validierung gegen feste Slugs, Antworten werden nie ungeprüft übernommen
- Altersprüfung zusätzlich im Backend (`under_13` → `422`)
- Rate Limit: 5 Bewerbungen pro 10 Minuten und IP, mindestens 2 Sekunden Abstand (im
  Serverless-Betrieb gilt das Limit pro Instanz)
- Honeypot-Feld gegen einfache Bots, Body-Limit von 8 KB, nur `application/json` (mit `charset`-Toleranz)
- Es werden nur die zehn Fragen verarbeitet – keine Namen, Adressen, Telefonnummern, Logins oder Tokens
- Discord-Fehler werden geloggt, aber nie im Detail ans Frontend weitergegeben
- CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` werden für alle Antworten gesetzt
- `allowed_mentions: { parse: [] }` im Webhook-Aufruf, damit nichts versehentlich gepingt wird

## Hinweise

- Die Plattform-Auswahl auf der Startseite belegt Frage 2 vor, bleibt dort änderbar und wird
  zusätzlich mitgesendet. Im Embed erscheint sie nur, wenn sie von der Antwort in Frage 2 abweicht.
- Es wird bewusst kein Kontaktfeld (z. B. Discord-Name) abgefragt. Falls du Kontaktdaten brauchst,
  ergänze die Frage in `QUESTIONS` in `backend/application.js` und in `frontend/app.js`.
