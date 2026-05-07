# drive-projects

Single-tenant project + tasks app, backed entirely by **one Google Drive owned by a service account**. Email/password login (no Google sign-in for end users). Each project gets a Drive subfolder containing one Tasks Sheet and one Notes Doc; each task has rich Steps (heading, owner, target dates, checklist, warning callout, notes) that round-trip through the Tasks Sheet and render into the Notes Doc.

```
Service-account Drive
└── MyApp/                          (root, env-pinned via APP_ROOT_FOLDER_ID)
    ├── Users Sheet                 (USERS_SHEET_ID — login table)
    ├── Projects Sheet              (PROJECTS_SHEET_ID — project catalogue)
    └── <Project Title>/
        ├── <Project Title> Tasks   (10 cols incl. Steps JSON)
        └── <Project Title> Notes   (anyone-with-link readable, embedded in app)
```

---

## Stack

- **Frontend**: Vite + React + TypeScript + Tailwind + axios + react-router-dom + Tiptap
- **Backend**: Node + Express + TypeScript + `googleapis` (service-account auth)
- **Storage**: Google Sheets + Drive + Docs. Local `server/data/store.json` only holds session ids.

```
D:\demo\drive-projects\
├── server/   (Express + googleapis)
└── client/   (Vite + React)
```

---

## 1. Google Cloud setup

You need **one service account** that owns every Drive/Sheets/Docs operation.

1. Visit https://console.cloud.google.com/ and create (or pick) a project.
2. **APIs & Services → Library** — enable each:
   - Google Drive API
   - Google Sheets API
   - Google Docs API
3. **IAM & Admin → Service Accounts → Create service account** (any name, e.g. `drive-projects`). Open it → *Keys* → *Add key → JSON*. Save the file to `server/credentials/service-account.json` (the `server/credentials/` folder is gitignored).
4. Copy the service account email (looks like `…@<project>.iam.gserviceaccount.com`) — you'll grant it editor on three Drive resources next.

---

## 2. Drive resources

You have **two options** — fully manual or fully auto.

### Option A — Auto-provision (zero setup)

Leave `APP_ROOT_FOLDER_ID`, `USERS_SHEET_ID`, and `PROJECTS_SHEET_ID` **empty** in `.env`. On first boot, the server creates them in the service account's own Drive: a `MyApp` folder, plus the two sheets inside it. The ids are persisted to `server/data/store.json` so subsequent boots reuse them. The console will print the resolved ids — copy them into `.env` later if you want to pin them.

Trade-off: the resources live in the service account's Drive, which has a 15 GB cap and isn't directly visible in your normal Drive UI. Fine for demo/dev. If you want them in your own Drive, pick Option B.

### Option B — User-owned resources (recommended for shared use)

In **the Google Drive that should hold all app data** (your own Drive or a Workspace shared drive):

1. **Create a folder** named anything (e.g. `MyApp`). Right-click → Share → invite the service account email as **Editor**. Copy the folder id from its URL (`drive.google.com/drive/folders/<THIS_PART>`) → `APP_ROOT_FOLDER_ID`.
2. **Create a Google Sheet** (any name, e.g. `DriveProjects Users`). Share it with the service account as **Editor**. Copy the spreadsheet id from the URL (`docs.google.com/spreadsheets/d/<THIS_PART>/edit`) → `USERS_SHEET_ID`. The server adds the `Users` tab + header row on first boot if missing.
3. **Create a Google Sheet** (any name, e.g. `DriveProjects Projects`). Share it with the service account as **Editor**. Copy its spreadsheet id → `PROJECTS_SHEET_ID`. The `Projects` tab + headers are added on first boot if missing.

You can mix: pin some env vars and leave others empty. Anything left empty is auto-provisioned inside `APP_ROOT_FOLDER_ID` (auto-created if that's also empty).

> **Storage cap**: a service account on a personal Drive shares the owner's 15 GB cap. For a Workspace shared drive there's no per-user cap — recommended for production.

> **Notes Doc sharing**: each project's Notes Doc is automatically set to **anyone-with-link can view** so the in-app preview iframe can load. The doc is *not* indexed/listed publicly, but anyone who has the URL can read. Keep this in mind before storing sensitive notes.

---

## 3. Local setup

```bash
cd D:\demo\drive-projects
cp server/.env.example server/.env
# then fill in: SESSION_SECRET, APP_ROOT_FOLDER_ID, USERS_SHEET_ID, PROJECTS_SHEET_ID

# generate a SESSION_SECRET:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

npm install
```

`server/.env`:
```
SESSION_SECRET=<random hex>
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./credentials/service-account.json
APP_ROOT_FOLDER_ID=<MyApp folder id>
USERS_SHEET_ID=<users sheet id>
PROJECTS_SHEET_ID=<projects sheet id>
CLIENT_ORIGIN=http://localhost:5173
```

---

## 4. Run

```bash
npm run dev
```

This starts:
- **server** on `http://localhost:4000`
- **client** on `http://localhost:5173` (Vite proxies `/api/*` to the server)

Open `http://localhost:5173` → register an account → you land on `/projects`. Create a project; the Drive subfolder + Tasks Sheet + Notes Doc are provisioned on the spot.

### Wipe / reset

To start fresh: stop the server, delete `server/data/store.json`, and manually empty the `MyApp` Drive folder (or just the rows in the Users + Projects sheets). On next boot the app re-initialises the header rows.

---

## 5. API summary

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/register` | body `{ name, email, password }` — appends to Users sheet, sets cookie |
| POST | `/api/auth/login` | body `{ email, password }` — verifies against Users sheet, sets cookie |
| GET | `/api/auth/me` | `{ user: { id, email, name } }` or 401 |
| POST | `/api/auth/logout` | clears cookie |
| GET | `/api/projects` | list all projects |
| POST | `/api/projects` | body `{ title, assignedTo? }` |
| GET | `/api/projects/:id` | single project incl. `notesDocAvailable` |
| PATCH | `/api/projects/:id` | rename / status |
| DELETE | `/api/projects/:id` | trashes Drive folder + removes Projects Sheet row |
| POST | `/api/projects/:id/recreate-doc` | re-create a missing or trashed Notes Doc |
| GET | `/api/projects/:projectId/tasks` | list tasks |
| POST | `/api/projects/:projectId/tasks` | body `{ title, description?, steps?, status?, assignedTo? }` |
| PUT | `/api/projects/:projectId/tasks/:taskId` | partial update |
| DELETE | `/api/projects/:projectId/tasks/:taskId` | remove task row |

---

## 6. Data model

`Task` row in the per-project Tasks Sheet (10 columns):

`Task ID | Title | Description | Status | Assigned To | Created At | Description HTML | Steps JSON | Step Count | Updated At`

`Step` (stored as JSON in column H):

```ts
{
  id, heading, owner, targetStart, targetEnd,
  overview, checklist: [{ id, text, done }],
  warning, notes, workingStatus, assignedTo,
}
```

The server hard-caps the serialized Steps payload at 40,000 chars (Sheets allows ~50,000 per cell). PUTs that exceed this return 413.

---

## 7. Project structure

```
server/
├── src/
│   ├── index.ts                              # boot + sheet header init
│   ├── app.ts                                # express app + routes
│   ├── types.ts                              # Step, Task, Project types
│   ├── store.ts                              # session ids only
│   ├── session.ts                            # signed sid cookie helpers
│   ├── idGenerator.ts                        # T##### / P##### ids
│   ├── lib/
│   │   ├── httpError.ts
│   │   ├── serviceAccountClient.ts           # singleton GoogleAuth
│   │   └── sheetsQueue.ts                    # per-sheet write serialization
│   ├── middleware/requireAuth.ts
│   ├── services/
│   │   ├── usersSheetService.ts              # register/login backing sheet
│   │   ├── projectsSheetService.ts           # global Projects sheet CRUD
│   │   ├── driveService.ts                   # folder + share helpers
│   │   ├── sheetsService.ts                  # per-project Tasks sheet CRUD
│   │   ├── docsService.ts                    # per-project Notes doc sync
│   │   ├── docSync.ts                        # HTML → Docs requests
│   │   └── stepsService.ts                   # parse/serialize/sanitize Steps
│   └── routes/
│       ├── auth.ts
│       ├── projects.ts
│       └── tasks.ts
├── data/                                     # store.json (sessions only) at runtime
├── credentials/                              # service-account.json (gitignored)
├── .env.example
└── package.json

client/
├── src/
│   ├── main.tsx
│   ├── App.tsx                               # /login, /projects, /projects/:id
│   ├── api/client.ts
│   ├── hooks/useAuth.ts
│   ├── lib/types.ts
│   ├── pages/{LoginPage,ProjectsPage,TasksPage}.tsx
│   └── components/
│       ├── Layout.tsx, Sidebar.tsx, ProtectedRoute.tsx
│       ├── AuthForm.tsx, Button.tsx, Modal.tsx, Spinner.tsx
│       ├── ProjectCard.tsx, TaskTable.tsx, RichTextEditor.tsx
│       └── steps/
│           ├── StepsEditor.tsx, StepCard.tsx
│           ├── ChecklistEditor.tsx, StepBlock.tsx
└── package.json
```

---

## 8. Production notes (out of scope for MVP)

- Replace `server/data/store.json` with SQLite or Postgres before multi-instance deploys.
- Add CSRF protection on state-changing routes (we rely on `sameSite=lax` cookies + same-site backend for now).
- For private notes docs, swap the iframe `/preview` for a server-side `documents.get` render to HTML — keeps the doc anyone-with-link off.
- Move to a Workspace **shared drive** so the 15 GB personal-Drive cap doesn't apply.

---

## 9. Deploying to Vercel

Both the React client and the Express API run on a single Vercel project: the client is built into `client/dist` (served as static), and the entire Express app is wrapped as one Node serverless function at `api/[...path].ts`. Configuration lives in `vercel.json`.

### 9.1 One-time platform setup

1. **Provision a Vercel KV (or Upstash Redis) store** on the Vercel project. Pick *Storage → Create → KV*. Vercel auto-injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` into the deployment environment. These replace `server/data/store.json` for sessions, the install record, and owner OAuth tokens — required because serverless functions don't have a persistent filesystem.
2. **Update the Google OAuth redirect URI** (only if you use `/api/auth/google`). In Google Cloud Console → *Credentials*, add `https://<your-vercel-domain>/api/auth/callback` to *Authorized redirect URIs*.

### 9.2 Required Vercel env vars

| Variable | Notes |
|---|---|
| `SESSION_SECRET` | Random 32-byte hex. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
| `GOOGLE_SERVICE_ACCOUNT_KEY_JSON` | Paste the **full** service-account JSON file contents (one line, with `\n` inside `private_key`). Replaces the file path used locally. |
| `APP_ROOT_FOLDER_ID` | Drive folder id (or empty to auto-provision on first request). |
| `USERS_SHEET_ID` | Sheet id (or empty to auto-provision). |
| `PROJECTS_SHEET_ID` | Sheet id (or empty to auto-provision). |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Auto-injected by the KV integration. Don't set manually. |
| `CLIENT_ORIGIN` | **Leave unset** on Vercel — client and API share an origin, so CORS reflection is fine. Only set this if you front the API with a different domain. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Only needed if you use the owner-OAuth flow. |

`PORT` is ignored on Vercel — the platform picks the port for you. `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` is ignored when `GOOGLE_SERVICE_ACCOUNT_KEY_JSON` is set.

### 9.3 Deploy

From the repo root:

```bash
npm i -g vercel       # one-time
vercel link           # link to your existing task-mangement-phi project
vercel env pull       # optional — pulls Vercel env vars into .env.local
vercel --prod         # deploy to production
```

Or push to the linked Git branch if Git deploys are enabled.

### 9.4 First-request bootstrap

The serverless function lazily runs the same `bootstrapInstall` step the local server runs at startup. The first request after a cold start (e.g. `GET /api/health`) may take a few extra seconds while the install creates Drive resources and writes the install record into KV. Subsequent requests reuse the record.

### 9.5 Known limitations

- **Cold start** of the function is slower than a long-running Node server (Google libs are heavy). Consider hitting `/api/health` after a deploy to warm the function.
- **`googleapis`** ships a large bundle. Vercel's 250 MB unzipped function limit is comfortable today, but if it grows, switch to the per-API package (`@googleapis/drive`, `@googleapis/sheets`, `@googleapis/docs`).
- **No file uploads to local disk** — the function fs is read-only outside `/tmp`. Today's code doesn't need it; flag this if you add file storage later.
