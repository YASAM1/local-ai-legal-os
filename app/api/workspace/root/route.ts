import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  getWorkspaceRoot,
  setWorkspaceRoot,
  createAndSetWorkspaceRoot,
  pickWorkspaceRootNative,
  expandPath,
  COMMON_LOCATIONS,
} from "@/lib/workspace";

export async function GET() {
  const current = getWorkspaceRoot();
  return NextResponse.json({
    current,
    home: os.homedir(),
    suggestions: COMMON_LOCATIONS(),
    platform: process.platform,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action: string | undefined = body.action;

    if (action === "switch") {
      const root = await setWorkspaceRoot(body.path);
      return NextResponse.json({ ok: true, root });
    }

    if (action === "create") {
      const parent: string = body.parent || path.join(os.homedir(), "Desktop");
      const name: string = body.name;
      if (!name) {
        return NextResponse.json(
          { error: "Folder name is required" },
          { status: 400 },
        );
      }
      const root = await createAndSetWorkspaceRoot(parent, name);
      return NextResponse.json({ ok: true, root });
    }

    if (action === "pick") {
      const picked = await pickWorkspaceRootNative();
      if (!picked) {
        return NextResponse.json({ ok: false, cancelled: true });
      }
      const root = await setWorkspaceRoot(picked);
      return NextResponse.json({ ok: true, root });
    }

    if (action === "list") {
      // List immediate subdirectories of `dir` to help the user navigate.
      const dir = expandPath(body.dir ?? os.homedir());
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const folders = entries
        .filter((e) => e.isDirectory() && !e.name.startsWith("."))
        .map((e) => ({ name: e.name, path: path.join(dir, e.name) }))
        .sort((a, b) => a.name.localeCompare(b.name));
      const parent = path.dirname(dir);
      return NextResponse.json({
        ok: true,
        dir,
        parent: parent === dir ? null : parent,
        folders,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 400 },
    );
  }
}
