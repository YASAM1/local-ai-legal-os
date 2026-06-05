# Setup Guide — Local Legal OS

A step-by-step guide to running this app on your own Mac. **No coding experience
required.** You'll copy and paste a few commands, click a couple of buttons, and
wait while things download. Total hands-on time is about 15 minutes; total time
including downloads is about 30–45 minutes (mostly unattended).

> **What this app is:** a private AI assistant for your documents that runs
> entirely on your own computer. Nothing you put into it is ever sent to the
> internet. That privacy is the whole point — and it's why setup installs a few
> things locally instead of just signing you into a website.

---

## Before you start — what you'll need

| Requirement | Notes |
| --- | --- |
| **A Mac** (Apple Silicon — M1/M2/M3/M4 — or a recent Intel Mac) | Windows is not supported. |
| **macOS Ventura (13) or newer** | Click the Apple menu → *About This Mac* to check. |
| **~15 GB of free disk space** | The AI models and database images are large. |
| **A stable internet connection** | Only needed during setup, to download everything. After that the app works fully offline. |
| **Your Mac login password** | You'll be asked for it once or twice during installation. This is normal. |

You do **not** need a GitHub account, a credit card, or any API keys. Everything
installed here is free and open-source.

---

## Step 1 — Download the code from GitHub

The easiest way (no extra tools needed):

1. Go to the repository page: **https://github.com/YASAM1/local-ai-legal-os**
2. Click the green **`< > Code`** button near the top right.
3. In the menu that drops down, click **Download ZIP**.
4. The file `local-ai-legal-os-main.zip` will land in your **Downloads** folder.
5. Go to your Downloads folder and **double-click the ZIP** to unzip it. You'll
   get a folder named `local-ai-legal-os-main`.
6. **Move that folder somewhere permanent and easy to find** — for example, drag
   it onto your **Desktop**. (Don't leave it in Downloads, which can get cleared.)

> **Tip:** Keep the folder name simple and avoid moving it later. The app
> remembers where it lives.

---

## Step 2 — Install Docker Desktop

The app uses a small local database that runs inside **Docker**. This is the one
piece the automatic installer can't set up for you, so we do it first.

1. Go to **https://www.docker.com/products/docker-desktop/**
2. Click **Download for Mac** and pick the version that matches your Mac:
   - **Apple Silicon** (most Macs from 2020 onward) — choose *Apple Chip*.
   - Not sure? Apple menu → *About This Mac*. If it says "Apple M1/M2/M3/M4",
     you have Apple Silicon. If it says "Intel", choose *Intel Chip*.
3. Open the downloaded `Docker.dmg` file.
4. In the window that appears, **drag the Docker whale icon onto the Applications
   folder.**
5. Open your **Applications** folder and **double-click Docker** to launch it.
6. Accept the service agreement and any prompts. You may be asked for your **Mac
   password** — enter it. If asked, the recommended/default settings are fine.
7. Wait until the **whale icon in your top menu bar (top-right of the screen) is
   solid and steady** — not animated. That means Docker is running. ✅

> **Leave Docker Desktop running.** The app needs it on whenever you use the app.
> You can let it start automatically: Docker → Settings (gear) → General →
> "Start Docker Desktop when you sign in".

---

## Step 3 — Open the Terminal

The Terminal is a built-in Mac app where you type commands. Don't worry — you'll
only **copy and paste**.

1. Press **`Command (⌘) + Space`** to open Spotlight search.
2. Type **`Terminal`** and press **Return**.
3. A window with a blinking cursor opens. Keep it open for the next steps.

> **How to paste:** click inside the Terminal window, then press
> **`Command (⌘) + V`**. Press **Return** to run what you pasted.

---

## Step 4 — Go to the app folder

We need to tell the Terminal to "enter" the app folder. The easiest, foolproof
way:

1. In the Terminal, type this exactly (with a space after `cd`), but **don't
   press Return yet**:

   ```
   cd 
   ```

2. Open **Finder**, find the folder you unzipped, and open it until you can see
   the folder named **`local-app`** inside it.
3. **Drag the `local-app` folder directly onto the Terminal window.** The Terminal
   will automatically fill in its full location.
4. Now press **Return**.

To confirm you're in the right place, paste this and press Return:

```
ls bin
```

If it prints **`setup`**, you're in the right spot. ✅
(If it says "No such file or directory", repeat this step — you likely landed in
the wrong folder.)

---

## Step 5 — Run the automatic installer

This single command installs everything else the app needs (the AI engine, the
AI models, the database tools, OCR for scanned documents) and starts the
database. It's safe to run more than once.

Paste this and press Return:

```
./bin/setup
```

**What to expect:**

- It works through a numbered checklist (1/9, 2/9, …). Green check marks (✓) are
  good.
- **You may be asked for your Mac password** — type it and press Return. (The
  letters won't appear as you type; that's normal for password fields.)
- **It will download several gigabytes** — the AI models alone are ~5 GB. This is
  the slow part. A spinning progress indicator is normal; just let it run.
- When it finishes, you'll see a green message: **"✓ Local Legal OS is ready."**

> **If it says something like "Docker not ready — re-run setup":** make sure the
> Docker whale icon in your menu bar is solid (Step 2), then simply run
> `./bin/setup` again. The installer is designed to be re-run safely and will
> pick up where it left off.

---

## Step 6 — Start the app

Once setup says it's ready, paste this and press Return:

```
pnpm dev
```

After a few seconds you'll see a line mentioning **`http://localhost:3000`**.

- Open your web browser (Safari, Chrome, etc.).
- Go to **http://localhost:3000**
- The Local Legal OS app loads. 🎉

> **Important:** Keep this Terminal window **open** while you use the app. The app
> is running *inside* it. If you close the Terminal or press `Control + C`, the
> app stops. (See "Using it day to day" below for how to start it again next
> time.)

---

## Step 7 — Confirm everything is healthy

1. In the app, click the **gear / Settings icon** (top of the left sidebar).
2. Look at **System health**. You want every row to show a green check:
   - Ollama running
   - Chat model installed
   - Embedding model installed
   - Vector database (Supabase) connected
   - OCR (Tesseract) installed
   - Workspace folder
3. If any row is red, click the **"Fix"** button next to it. That usually
   resolves it in one click (e.g. starting a service or pulling a model).

---

## Step 8 — Point it at your own documents

Out of the box, the app uses a sample folder. To use **your own** files:

1. In the app's left sidebar, find the **workspace switcher** (the folder name at
   the top of the sidebar).
2. Choose **"Change folder"** / the folder picker. A normal Mac **Finder window**
   opens.
3. Select the folder on your computer that contains the documents you want the
   assistant to work with, and confirm.

> **A "workspace" is just a folder on your Mac.** The assistant can only see and
> act on files inside the folder you choose — nothing else on your computer. You
> can switch between folders anytime (e.g. one folder per client or matter).

### Adding files

- **Drag and drop** files onto the sidebar, **or** simply put files into that
  folder using Finder as you normally would.
- Supported types: PDF, Word (`.docx`), Excel (`.xlsx`), CSV, text, Markdown,
  and images (scanned documents are read using OCR).

### Make new files searchable

The assistant can *read* any file you open, but for it to **search across all
your documents** by meaning, the files need to be "indexed" once.

- After adding files, go to **Settings → Re-index** and click it. Wait for it to
  finish. That's it — your documents are now searchable.

---

## Try it out

In the chat box, try asking things like:

- *"What documents are in this folder? Give me a one-line summary of each."*
- *"Summarize the key facts and who the parties are."* (it will cite which file
  each fact came from)
- *"Draft a one-page status memo based on these documents and save it as a PDF
  named status_memo.pdf."* → a real PDF appears in your folder.

---

## Using it day to day (starting it up next time)

The app doesn't run on its own after you restart your Mac. To start it again:

1. **Make sure Docker Desktop is running** — open it from Applications if the
   whale icon isn't in your menu bar, and wait for the whale to go solid.
2. Open **Terminal**.
3. Go to the app folder (repeat **Step 4** — the drag-the-folder trick).
4. Paste and run: `pnpm dev`
5. Open **http://localhost:3000** in your browser.

To **stop** the app: click the Terminal window and press **`Control + C`**, or
just close the Terminal window.

---

## Troubleshooting

| Problem | What to do |
| --- | --- |
| The app page won't load / "can't connect" | Make sure the Terminal still shows `pnpm dev` running and Docker's whale icon is solid. |
| Setup banner in the app says **"Setup required"** | Click "Open Settings" and press the **Fix** button on each red row. |
| **Docker daemon not running** | Open **Docker** from Applications; wait until the menu-bar whale is solid, then try again. |
| A **model is missing** | Settings → System health → **Fix** next to the model, or re-run `./bin/setup`. |
| Something failed during setup | Just run **`./bin/setup`** again — it's safe to repeat and will fix most issues. |
| "command not found: pnpm" | Setup didn't finish. Run `./bin/setup` again and watch for any red ✗ messages. |
| The app port is "already in use" | Close any other Terminal running the app, then run `pnpm dev` again. |

If you get truly stuck, the single most effective fix is: **make sure Docker is
running, then run `./bin/setup` again, then `pnpm dev`.**

---

## A note on privacy

Everything in this app stays on your Mac:

- The AI runs locally — no internet connection is used to answer questions.
- Your documents never leave your computer.
- The folders you point it at are *not* uploaded anywhere, and confidential files
  are never sent to GitHub or any cloud service.

That's the entire reason this runs locally instead of as a website.
