# Local Legal OS

An on-premise AI operating system for a small law firm. Every byte stays on
the firm's own hardware. The assistant can answer questions about the firm's
documents (PDF, DOCX, XLSX, images via OCR, plain text), and take real action
on them — read, write, edit, organize — the same way Claude Code does.

## Quick start

The setup script does everything: installs Ollama, Supabase, Docker (where it
can), Tesseract for OCR, pulls the language models, starts the local
database, wires up environment variables, applies the schema, and tells you
when the app is ready.

```bash
# 1. Clone
git clone <this-repo>
cd local-ai-legal-os/local-app

# 2. Run setup (idempotent — safe to re-run any time)
./bin/setup       # or: pnpm setup

# 3. Start
pnpm dev
```

Open **http://localhost:3000**.

Total time on a clean Mac: ~10 minutes of unattended downloads (mostly
models + container images). You'll be prompted once for your macOS password
when Docker Desktop installs — that's the only manual step.

## What setup does for you

| # | Step                            | Detail                                                              |
| - | ------------------------------- | ------------------------------------------------------------------- |
| 1 | Platform check                  | macOS / Linux                                                       |
| 2 | Homebrew                        | Installs if missing (macOS only)                                    |
| 3 | Node 20+ and pnpm               | Checks and installs                                                 |
| 4 | Ollama                          | Installs and starts as a brew service                               |
| 5 | Language models                 | Pulls `qwen2.5:7b` (chat) + `nomic-embed-text` (embeddings)         |
| 6 | Tesseract                       | Optional, enables OCR for scanned files                             |
| 7 | Supabase CLI                    | Installs                                                            |
| 8 | Docker                          | Detects; prompts for sudo install if missing; starts Docker Desktop |
| 9 | App deps + Supabase + migrations | `pnpm install`, `supabase start`, writes keys to `.env.local`, applies schema |

Re-run `./bin/setup` any time — every step is idempotent.

## Configuring after install

Everything is configurable from the in-app **Settings** page (gear icon in
the sidebar header):

- **System health**: live status of every service. Each broken check has a
  one-click "Fix" button (pull a model, start Ollama, start Supabase, install
  Tesseract).
- **AI mode**: toggle between Local (Ollama, default) and Cloud (Vercel AI
  Gateway with your own API key).
- **Models**: switch between `qwen2.5:7b`, `qwen2.5:14b`, `llama3.1:8b`,
  `llama3.1:70b`, or any other Ollama-compatible model. Pull new ones with a
  single button.
- **Workspace**: change which folder the assistant operates inside (handled
  via the workspace switcher in the sidebar, with a native Finder picker on
  macOS).
- **Re-index**: re-embed every supported document in the workspace for
  semantic search.

Settings are written to `.app-config.json` (gitignored) and applied
immediately — no dev-server restart required.

## Day-to-day flow

1. Drop documents into the workspace folder via drag-drop on the sidebar, or
   create a new matter (`+` → New matter).
2. Ask the assistant questions or give it work.
3. When you add new files, click "Re-index" in Settings (or run `pnpm
   ingest`) — semantic search will pick them up.

## Supported file types

| Format         | How it's handled                                                |
| -------------- | --------------------------------------------------------------- |
| `.pdf`         | Text-layer extraction (`unpdf`). Warns when a PDF is scan-only. |
| `.docx`        | `mammoth` raw-text extraction                                   |
| `.xlsx`/`.xls` | Each sheet flattened to CSV                                     |
| `.csv`         | Plain read                                                      |
| `.html`        | Tags stripped, entities decoded                                 |
| `.rtf`         | Control words stripped                                          |
| `.txt`/`.md`/`.json`/`.log`/`.yaml`/`.xml` | UTF-8 read                          |
| Images         | OCR via `tesseract` if installed (auto-detected at runtime)     |
| Anything else  | UTF-8 if it looks like text, otherwise marked as binary         |

## Privacy & safety

- The agent is sandboxed to a single workspace directory. Absolute paths and
  `..` escapes are rejected.
- No telemetry. No external API calls in `local` mode.
- The system prompt frames all output as drafts for attorney review.
- Workspaces are isolated per folder — switching workspaces does not leak
  document content from one matter into another (chunks are scoped by
  `workspace_root` in the vector DB).
- Confidential client data should not be committed to git. `workspace/`,
  `.workspace-config.json`, and `.app-config.json` are all gitignored.

## Troubleshooting

| Problem                            | Fix                                                                 |
| ---------------------------------- | ------------------------------------------------------------------- |
| Setup banner says "Setup required" | Click "Open Settings" and use the "Fix" button on each red row      |
| Docker daemon not running          | Open `/Applications/Docker.app`; whale icon must be solid in menu bar |
| Ollama returns 404                 | `brew services restart ollama`                                      |
| Models missing                     | Settings → System health → Fix beside each missing model            |
| Supabase migrations out of date    | `supabase migration up --local`                                     |
| Stale dev-server                   | Stop with `kill $(lsof -ti:3000)` and re-run `pnpm dev`              |

## Architecture overview

- **Next.js 16** (App Router) — UI and API on `localhost:3000`
- **Vercel AI SDK v6** — model abstraction + tool-calling agent loop
- **Ollama** — local model runtime (chat + embeddings)
- **Supabase (local)** — Postgres + `pgvector` for vector search, runs in Docker
- **Tesseract** — OCR for scanned PDFs / images (optional)
- **shadcn/ui + Tailwind v4** — Clio-inspired blue + white theme, light/dark
- **Workspace sandbox** — every file operation resolved inside a single configurable folder

The app is a single Next.js project under `local-app/`. The setup script is
the only thing you should need to run; the in-app Settings page handles
everything after.
