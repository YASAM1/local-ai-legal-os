import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import fsp from "node:fs/promises";

const CONFIG_FILE = path.join(process.cwd(), ".workspace-config.json");

function defaultWorkspaceRoot(): string {
  return path.resolve(
    process.env.WORKSPACE_ROOT ?? path.join(process.cwd(), "workspace"),
  );
}

function readConfig(): { root?: string } {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return {};
  }
}

export function expandPath(p: string): string {
  const trimmed = p.trim();
  if (!trimmed) return defaultWorkspaceRoot();
  if (trimmed === "~") return os.homedir();
  if (trimmed.startsWith("~/")) {
    return path.resolve(os.homedir(), trimmed.slice(2));
  }
  return path.resolve(trimmed);
}

export function getWorkspaceRoot(): string {
  const cfg = readConfig();
  if (cfg.root) return cfg.root;
  return defaultWorkspaceRoot();
}

export async function setWorkspaceRoot(p: string): Promise<string> {
  const abs = expandPath(p);
  const st = await fsp.stat(abs).catch(() => null);
  if (!st) throw new Error(`Folder does not exist: ${abs}`);
  if (!st.isDirectory()) throw new Error(`Not a folder: ${abs}`);
  await fsp.access(abs, fs.constants.R_OK | fs.constants.W_OK);
  await fsp.writeFile(
    CONFIG_FILE,
    JSON.stringify({ root: abs }, null, 2),
    "utf8",
  );
  return abs;
}

export async function createAndSetWorkspaceRoot(
  parent: string,
  name: string,
): Promise<string> {
  const safeName = name
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/^\.+/, "")
    .trim();
  if (!safeName) throw new Error("Folder name is required");
  const abs = path.join(expandPath(parent), safeName);
  await fsp.mkdir(abs, { recursive: true });
  return await setWorkspaceRoot(abs);
}

export async function pickWorkspaceRootNative(): Promise<string | null> {
  if (process.platform !== "darwin") return null;
  const { exec } = await import("node:child_process");
  return new Promise((resolve, reject) => {
    const script = `POSIX path of (choose folder with prompt "Choose a workspace folder")`;
    exec(`osascript -e '${script}'`, (err, stdout) => {
      if (err) {
        // osascript returns exit code 1 when the user cancels the picker.
        const code = (err as { code?: number }).code;
        if (code === 1) return resolve(null);
        return reject(err);
      }
      resolve(stdout.trim().replace(/\/$/, "") || null);
    });
  });
}

export async function ensureWorkspace(): Promise<string> {
  const root = getWorkspaceRoot();
  await fsp.mkdir(root, { recursive: true });
  return root;
}

export function resolveWithinWorkspace(relPath: string): string {
  const root = getWorkspaceRoot();
  const normalized = path
    .normalize(relPath)
    .replace(/^([/\\])+/, "")
    .replace(/\.\.(\/|\\|$)/g, "");
  const abs = path.resolve(root, normalized);
  if (!abs.startsWith(root)) {
    throw new Error(
      `Path escape detected: ${relPath} resolved outside workspace`,
    );
  }
  return abs;
}

export function toRelative(abs: string): string {
  return path.relative(getWorkspaceRoot(), abs) || ".";
}

export const COMMON_LOCATIONS = (): { label: string; path: string }[] => {
  const home = os.homedir();
  return [
    { label: "Desktop", path: path.join(home, "Desktop") },
    { label: "Documents", path: path.join(home, "Documents") },
    { label: "Home", path: home },
  ];
};

