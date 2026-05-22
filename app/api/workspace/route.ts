import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import {
  ensureWorkspace,
  resolveWithinWorkspace,
  toRelative,
  getWorkspaceRoot,
} from "@/lib/workspace";

type TreeNode = {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
  children?: TreeNode[];
};

async function buildTree(dir: string, depth = 0): Promise<TreeNode[]> {
  if (depth > 4) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const sorted = entries
    .filter((e) => !e.name.startsWith("."))
    .sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const result: TreeNode[] = [];
  for (const e of sorted) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      result.push({
        name: e.name,
        path: toRelative(abs),
        type: "dir",
        children: await buildTree(abs, depth + 1),
      });
    } else {
      const st = await fs.stat(abs);
      result.push({
        name: e.name,
        path: toRelative(abs),
        type: "file",
        size: st.size,
      });
    }
  }
  return result;
}

function safeName(name: string): string {
  return name.replace(/[\\/]/g, "_").replace(/^\.+/, "").trim() || "untitled";
}

function matterSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "matter"
  );
}

const MATTER_SUBFOLDERS = [
  "correspondence",
  "contracts",
  "pleadings",
  "research",
  "billing",
];

export async function GET() {
  const root = await ensureWorkspace();
  const tree = await buildTree(root);
  return NextResponse.json({ root, tree });
}

export async function POST(req: Request) {
  await ensureWorkspace();
  const body = await req.json();
  const { action } = body as { action?: string };

  if (action === "create_folder") {
    const { path: rel } = body as { path: string };
    const abs = resolveWithinWorkspace(rel);
    await fs.mkdir(abs, { recursive: true });
    return NextResponse.json({ ok: true, path: toRelative(abs) });
  }

  if (action === "create_file") {
    const { path: rel, content } = body as { path: string; content?: string };
    const abs = resolveWithinWorkspace(rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content ?? "", "utf8");
    return NextResponse.json({ ok: true, path: toRelative(abs) });
  }

  if (action === "create_matter") {
    const { name, parent } = body as { name: string; parent?: string };
    const slug = matterSlug(name);
    const base = path.join(parent || "matters", slug);
    const abs = resolveWithinWorkspace(base);
    await fs.mkdir(abs, { recursive: true });
    for (const sub of MATTER_SUBFOLDERS) {
      await fs.mkdir(path.join(abs, sub), { recursive: true });
    }
    const intake = `# ${name}\n\nCreated: ${new Date().toISOString().slice(0, 10)}\n\n## Parties\n- Client:\n- Opposing:\n\n## Key dates\n- Engagement:\n- Next deadline:\n\n## Notes\n`;
    await fs.writeFile(path.join(abs, "intake.md"), intake, "utf8");
    return NextResponse.json({
      ok: true,
      path: toRelative(abs),
      created: ["intake.md", ...MATTER_SUBFOLDERS],
    });
  }

  if (action === "rename") {
    const { from, to } = body as { from: string; to: string };
    const src = resolveWithinWorkspace(from);
    const dst = resolveWithinWorkspace(to);
    await fs.mkdir(path.dirname(dst), { recursive: true });
    await fs.rename(src, dst);
    return NextResponse.json({
      ok: true,
      from: toRelative(src),
      to: toRelative(dst),
    });
  }

  if (action === "delete") {
    const { path: rel } = body as { path: string };
    const abs = resolveWithinWorkspace(rel);
    const st = await fs.stat(abs).catch(() => null);
    if (!st) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (st.isDirectory()) {
      await fs.rm(abs, { recursive: true, force: true });
    } else {
      await fs.unlink(abs);
    }
    return NextResponse.json({ ok: true, path: toRelative(abs) });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function PUT(req: Request) {
  await ensureWorkspace();
  const form = await req.formData();
  const targetDir = (form.get("dir") as string | null) ?? ".";
  const files = form.getAll("files").filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "No files" }, { status: 400 });
  }

  const destDir = resolveWithinWorkspace(targetDir);
  await fs.mkdir(destDir, { recursive: true });

  const written: { path: string; bytes: number }[] = [];
  for (const file of files) {
    const rel = (file as File & { webkitRelativePath?: string })
      .webkitRelativePath;
    const name = safeName(file.name);
    const abs = rel
      ? resolveWithinWorkspace(path.join(targetDir, rel))
      : path.join(destDir, name);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(abs, buf);
    written.push({ path: toRelative(abs), bytes: buf.length });
  }
  return NextResponse.json({ ok: true, count: written.length, written });
}
