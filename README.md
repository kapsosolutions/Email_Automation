# Email Automation

Upload a CSV or Excel file, personalise every message with values from your own
columns, and send through the Brevo relay one recipient at a time.

- **backend/** — Express + MongoDB API, Brevo sending, BullMQ dispatch
- **frontend/** — React + Vite console, Google design system, Recharts

---

## Read this first

Two things block a real send right now.

### 1. Brevo is refusing this machine's IP

Both the SMTP relay and the HTTP API rejected the credentials during testing:

```
SMTP : 525 5.7.1 Unauthorized IP address
API  : 401 unauthorized — "unrecognised IP address 2409:40f0:...:cf77"
```

The account has IP authorisation switched on. Add your IP (or disable the
restriction) at **https://app.brevo.com/security/authorised_ips**, then confirm
with:

```powershell
curl http://localhost:5000/api/system/smtp-check
```

You want `{"smtp":{"ok":true,...}}`. Until then every send will fail with that
message in the campaign log — the pipeline itself works, the relay is just
closed. Note that a dynamic home IP changes; a fixed server IP is the practical
answer for production.

### 2. Rotate the credentials

The Brevo SMTP key, Brevo API key, MongoDB URI and Cloudinary secret were all
pasted in plain text and are now in `backend/.env`. Treat them as compromised:
generate new ones in each dashboard and replace the values. `.env` is already
gitignored, but that does not undo exposure that already happened.

### 3. Set a real sender address

`MAIL_FROM_EMAIL` is still the placeholder `noreply@yourdomain.com`. Mail from
an unauthenticated domain lands in spam regardless of how good the content is.
See [Landing in the inbox](#landing-in-the-inbox).

---

## Setup

Requires Node 20+ (tested on 24.11.1). Redis is optional.

```powershell
cd backend
npm install
npm run dev          # http://localhost:5000
```

```powershell
cd frontend
npm install
npm run dev          # http://localhost:5173
```

The Vite dev server proxies `/api` and `/t` to port 5000, so no CORS setup is
needed for local work.

### Optional: BullMQ worker

With `REDIS_URL` empty the API sends in-process. That is fine for lists in the
low thousands. Set `REDIS_URL` and the same code path moves to a durable queue:

```powershell
# terminal 1
cd backend; npm run dev
# terminal 2
cd backend; npm run worker
```

Campaigns survive a restart either way — orphaned in-flight rows are returned
to the queue on boot.

---

## How a send works

1. **Upload** — `POST /api/lists/upload`. The first filled row becomes the
   header. The email column is detected by header name, falling back to
   scanning cell contents. Invalid addresses and in-file duplicates are
   dropped and reported. Anything that previously unsubscribed stays
   suppressed. Every column is stored per contact, so any of them can be a
   placeholder. The original file is archived to Cloudinary.

2. **Compose** — on **Create a mail** or step 2 of **Send**. Placeholders are
   extracted live and matched against the chosen list's real columns, so you
   see which keys resolve before you commit.

3. **Send** — `POST /api/campaigns/send` snapshots the subject and body onto
   the campaign, creates one log row per recipient, and hands off to the
   dispatcher. Later template edits never rewrite sent history.

4. **Watch** — the campaign page polls while sending: delivered, failed,
   suppressed, opens, clicks, unsubscribes, plus a per-recipient log with the
   relay's response.

### Placeholders

| Syntax | Behaviour |
|---|---|
| `{name}` | value of the `name` column |
| `{{name}}` | same, double braces also accepted |
| `{name\|there}` | `there` when the column is empty or missing |
| `{unsubscribe_url}` | generated per recipient |

Matching is loose: `{first_name}`, `{First Name}` and `{firstname}` all resolve
to a column called **First Name**. Keys with no column and no fallback are
rejected at send time unless you pass `allowUnmatched`, so you never mail a
visible `{company}` to your whole list.

Given `Name,Email Address,Company,Plan` and the subject
`Hi {name}, your {plan} plan at {company}`, Alex Morgan receives
**"Hi Alex Morgan, your Pro plan at Northwind"**.

---

## Landing in the inbox

What the app does for you on every send:

- **One message per recipient.** Never BCC. A single message to many addresses
  is the clearest bulk-mail signal there is.
- **`List-Unsubscribe` + `List-Unsubscribe-Post: One-Click`.** Required by the
  Gmail and Yahoo bulk-sender rules, and trusted by filters below that
  threshold. A footer link is added too.
- **A plaintext part** generated from your HTML. HTML-only mail scores badly.
- **A unique `Message-ID`** anchored to your sending domain, plus an
  `X-Entity-Ref-ID` so Gmail does not collapse near-identical mail into one
  thread with a "trimmed content" notice.
- **Paced dispatch** at `SEND_RATE_PER_MINUTE` with random jitter. No bursts.
- **List hygiene.** Invalid syntax dropped at import, opt-outs suppressed
  account-wide, no address mailed twice in one campaign.
- **A content lint** (`POST /api/templates/analyze`) that scores the draft on
  the heuristics filters actually use — caps in the subject, spam phrases,
  shorteners, image-to-text ratio, missing preheader.

What only you can do — and it matters more than everything above:

1. **Authenticate your domain in Brevo.** Senders → Domains → add your domain,
   then publish the DKIM and Brevo SPF records it gives you.
2. **Publish DMARC.** Start at `v=DMARC1; p=none; rua=mailto:you@yourdomain.com`
   and tighten to `quarantine` once reports look clean.
3. **Send from your own domain.** A `gmail.com` From address cannot be
   DMARC-aligned through a relay; the lint flags this as an error.
4. **Warm up.** A new domain sending thousands on day one gets throttled. Start
   at 50–100/day and roughly double weekly. Keep `SEND_RATE_PER_MINUTE` low
   early on.
5. **Use a monitored reply address.** Replies are a strong positive signal;
   `noreply@` discards them.
6. **Only mail people who asked.** Nothing in this list survives a cold
   purchased list.

The deliverability score is a content check, not a prediction. A 100 from an
unauthenticated domain still goes to spam.

---

## API

```
POST   /api/lists/upload                 multipart: file, name?, emailColumn?
GET    /api/lists                        lists with live subscriber counts
GET    /api/lists/:id                    list + paginated contacts
GET    /api/lists/:id/emails             flat address array
DELETE /api/lists/:id

GET    /api/templates
POST   /api/templates
PUT    /api/templates/:id
DELETE /api/templates/:id
POST   /api/templates/placeholders       extract keys, map to list columns
POST   /api/templates/preview            render against a real contact row
POST   /api/templates/analyze            deliverability lint

POST   /api/campaigns/send               the one call the Send page makes
POST   /api/campaigns/test               one message to yourself
GET    /api/campaigns
GET    /api/campaigns/:id
GET    /api/campaigns/:id/logs
POST   /api/campaigns/:id/pause|resume|cancel|retry-failed
DELETE /api/campaigns/:id

GET    /api/dashboard/stats              card numbers
GET    /api/dashboard/timeseries?days=14 daily sent/opened/failed
GET    /api/dashboard/breakdown          pie datasets
GET    /api/dashboard/campaign-performance
GET    /api/dashboard/recent
GET    /api/dashboard/health

GET    /api/system/config|smtp-check|health

GET    /t/o/:trackId.png                 open pixel      (HMAC signed)
GET    /t/c/:trackId?u=...               click redirect  (HMAC signed)
GET    /t/u/:trackId                     unsubscribe page
POST   /t/u/:trackId                     one-click unsubscribe
```

Tracking payloads are HMAC-signed with `TRACKING_SECRET`. Without that
signature the click endpoint would be an open redirect and the unsubscribe
endpoint would let anyone opt out anyone. **Change the default secret.**

For open and click tracking to work in production, `PUBLIC_URL` must be a URL
that mail clients can reach — not `localhost`.

---

## Environment

Everything lives in `backend/.env`; `backend/.env.example` lists the keys with
no values.

| Key | Notes |
|---|---|
| `PORT`, `NODE_ENV`, `APP_NAME` | server basics |
| `PUBLIC_URL` | public base for tracking links; must be internet-reachable |
| `CORS_ORIGIN` | comma-separated allowed origins |
| `MONGO_URI` | MongoDB connection string |
| `BREVO_SMTP_HOST/PORT/LOGIN/KEY` | relay credentials |
| `BREVO_API_KEY` | HTTP fallback when port 587 is blocked |
| `MAIL_FROM_NAME/EMAIL`, `MAIL_REPLY_TO` | sender identity |
| `SEND_RATE_PER_MINUTE` | throttle, per campaign |
| `SEND_CONCURRENCY` | parallel SMTP conversations |
| `SEND_JITTER_MS` | random delay so the pattern is not robotic |
| `REDIS_URL` | empty = in-process dispatcher |
| `CLOUDINARY_*` | archives the uploaded spreadsheets |
| `TRACKING_SECRET` | signs tracking and unsubscribe links |

---

## Data model

| Collection | Holds |
|---|---|
| `contactlists` | one per uploaded file: columns, email column, row counts |
| `contacts` | one per recipient; `data` keeps every original column |
| `templates` | reusable subject + HTML, cached placeholder keys, fallbacks |
| `campaigns` | a dispatch run with a frozen copy of what was sent |
| `emaillogs` | one row per recipient per campaign — source of truth for every chart |

Campaign counters are incremented as messages go out, then recounted from
`emaillogs` when the campaign finishes, so the stored numbers always match the
log.

---

## What was verified

Exercised against the live MongoDB and Cloudinary during the build:

- CSV ingestion — 8 rows → email column detected as "Email Address", 6 valid,
  1 invalid, 1 duplicate, original archived to Cloudinary
- Placeholder mapping — `{plan}` → column "Plan", unmatched keys reported,
  `{first_name|there}` fallback applied
- Rendering — "Hi Alex Morgan, your Pro plan at Northwind"
- All six dashboard endpoints, with correct aggregates
- Tracking — pixel always returns an image but only counts a signed hit; a
  tampered click signature redirects back to the app instead of the target; a
  tampered unsubscribe returns 400; one-click POST suppresses the contact
  across every list
- Dispatcher — 6 recipients produce exactly 6 log rows, one attempt each
- Frontend production build

Not verified: actual delivery to a real mailbox. That needs the Brevo IP
restriction lifted and an authenticated sending domain.

`sample-contacts.csv` in the repo root is a ready-made file to try the upload
flow with — it deliberately includes one malformed address and one duplicate so
you can see the validation report.

---

## Design system

The frontend follows Google's about-page system. The constraint worth knowing
before you edit anything: **the four brand colours are held in reserve.** The
multicolour G appears once per page as a centred anchor; everywhere else
Google Blue `#1a73e8` is the only accent, carrying CTAs, links, focus rings and
the active nav rule. Red, yellow and green appear only where a status genuinely
needs a second colour, such as a failed send.

- Display type at weight **400** with negative tracking, not 700
- Cards at **4px** radius, CTAs at a **48px** pill — no middle tier
- **No shadows.** A 1px `#dadce0` hairline is the entire elevation system
- Manrope substitutes for Google Sans, Inter for Google Sans Text

Tokens live in `frontend/tailwind.config.js`; the `--glue-*` variables and
component classes are in `frontend/src/index.css`.
