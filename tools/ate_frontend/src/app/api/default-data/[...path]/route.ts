import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const REPO_ROOT = path.join(process.cwd(), "..", "..");
const DATA_DIR = path.join(REPO_ROOT, "data");
const STATE_DIR = path.join(REPO_ROOT, "integration", ".state");
const AGENT_IDS = new Set(["shmoo_ml", "test_time_opt", "dtl", "retest_reduction"]);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Accept",
};

function listFiles(agentId: string) {
  const folder = path.join(DATA_DIR, agentId);
  if (!fs.existsSync(folder)) return [];
  const out: Array<{ name: string; size: number; suffix: string }> = [];
  const walk = (dir: string, prefix = "") => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(full, rel);
      else {
        out.push({
          name: rel.replace(/\\/g, "/"),
          size: fs.statSync(full).size,
          suffix: path.extname(entry.name).toLowerCase(),
        });
      }
    }
  };
  walk(folder);
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function readState(agentId: string): Record<string, unknown> {
  const file = path.join(STATE_DIR, `${agentId}.json`);
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const segments = (await ctx.params).path ?? [];
  const [root, agentId, kind, ...rest] = segments;

  if (root !== "agents" || !agentId || !AGENT_IDS.has(agentId)) {
    return NextResponse.json({ detail: "Not found" }, { status: 404, headers: CORS });
  }

  if (kind === "bootstrap") {
    return NextResponse.json(
      { agent_id: agentId, files: listFiles(agentId), ...readState(agentId) },
      { headers: CORS },
    );
  }

  if (kind === "files" && rest.length > 0) {
    const rel = rest.join("/");
    const folder = path.join(DATA_DIR, agentId);
    const target = path.resolve(folder, rel);
    if (!target.startsWith(path.resolve(folder)) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
      return NextResponse.json({ detail: "File not found" }, { status: 404, headers: CORS });
    }
    const buf = fs.readFileSync(target);
    const ext = path.extname(target).toLowerCase();
    const type =
      ext === ".zip"
        ? "application/zip"
        : ext === ".csv"
          ? "text/csv"
          : ext === ".xlsx"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "application/octet-stream";
    return new NextResponse(buf, {
      headers: {
        ...CORS,
        "Content-Type": type,
        "Content-Disposition": `inline; filename="${path.basename(target)}"`,
      },
    });
  }

  return NextResponse.json({ detail: "Not found" }, { status: 404, headers: CORS });
}
