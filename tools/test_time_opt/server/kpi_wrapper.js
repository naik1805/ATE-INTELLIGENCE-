/**
 * Read-only KPI/status sidecar for the ATE Test Time / Vector Memory agent.
 *
 * Runs as a separate Express process on its own port. It does not import,
 * modify, or spawn anything from server/index.js -- it probes the agent's
 * existing GET /api/health and reads the timestamp-prefixed upload files the
 * agent already writes.
 *
 *   node server/kpi_wrapper.js
 *
 * Env:
 *   TTO_KPI_PORT     port for this sidecar          (default 8802)
 *   TTO_AGENT_URL    base URL of the agent server   (default http://127.0.0.1:8787)
 */

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const AGENT_ID = "test_time_opt";
const AGENT_NAME = "ATE Test Time Optimization";

const ROOT = path.resolve(__dirname, "..");
const UPLOAD_DIR = path.join(ROOT, "uploads");

const PORT = Number(process.env.TTO_KPI_PORT || 8802);
const AGENT_URL = (process.env.TTO_AGENT_URL || "http://127.0.0.1:8787").replace(/\/$/, "");

// A simulation counts as "active" if an upload landed this recently.
const ACTIVE_WINDOW_MS = 120_000;

const app = express();
app.use(cors());

function listUploads() {
  if (!fs.existsSync(UPLOAD_DIR)) return [];
  return fs
    .readdirSync(UPLOAD_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name !== ".gitkeep")
    .map((e) => {
      const full = path.join(UPLOAD_DIR, e.name);
      const st = fs.statSync(full);
      return { name: e.name, size: st.size, mtimeMs: st.mtimeMs };
    });
}

const http = require("http");
const { URL } = require("url");

function probeAgentHealth() {
  return new Promise((resolve) => {
    const url = new URL(`${AGENT_URL}/api/health`);
    const req = http.get(
      {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname,
        timeout: 2500,
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => {
          raw += c;
        });
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve({ reachable: true, body: JSON.parse(raw) });
            } catch {
              resolve({ reachable: true, body: null });
            }
          } else {
            resolve({ reachable: false, body: null });
          }
        });
      },
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ reachable: false, body: null });
    });
    req.on("error", () => resolve({ reachable: false, body: null }));
  });
}

async function snapshot() {
  const warnings = [];
  const uploads = listUploads();

  if (!fs.existsSync(UPLOAD_DIR)) {
    warnings.push("uploads/ directory is missing; run counts will read as 0.");
  }

  const health = await probeAgentHealth();
  if (!health.reachable) {
    warnings.push(`Test-time agent not reachable at ${AGENT_URL}/api/health.`);
  } else if (health.body && health.body.defaultStilExists === false) {
    warnings.push("Agent reports the default STIL file is missing.");
  }

  warnings.push(
    "The live worker streams results over SSE and persists nothing, so vector-RAM " +
      "saved / test-time saved cannot be read after a run ends. KPIs below are " +
      "run-volume metrics derived from uploads/.",
  );

  const lastActivityMs = uploads.length
    ? Math.max(...uploads.map((u) => u.mtimeMs))
    : null;
  const age = lastActivityMs ? Date.now() - lastActivityMs : null;

  let status;
  if (!health.reachable) status = "error";
  else if (age !== null && age <= ACTIVE_WINDOW_MS) status = "running";
  else status = "idle";

  const stilUploads = uploads.filter((u) => /\.stil$/i.test(u.name));
  const totalBytes = uploads.reduce((acc, u) => acc + u.size, 0);

  return {
    agent_id: AGENT_ID,
    name: AGENT_NAME,
    status,
    generated_at: new Date().toISOString(),
    last_activity_at: lastActivityMs ? new Date(lastActivityMs).toISOString() : null,
    source: "agent GET /api/health + filesystem: uploads/",
    detail_url: AGENT_URL,
    kpis: [
      { id: "simulations_run", label: "Simulations Run", value: stilUploads.length, unit: "", trend: "flat", precision: 0 },
      { id: "uploads_total", label: "Files Uploaded", value: uploads.length, unit: "", trend: "flat", precision: 0 },
      { id: "upload_volume", label: "Upload Volume", value: totalBytes / 1_048_576, unit: "MB", trend: "flat", precision: 2 },
      { id: "agent_health", label: "Agent Reachable", value: health.reachable ? 1 : 0, unit: "", trend: "flat", precision: 0 },
    ],
    warnings,
  };
}

app.get(`/api/agents/${AGENT_ID}/kpis`, async (_req, res) => {
  try {
    res.json(await snapshot());
  } catch (err) {
    res.json({
      agent_id: AGENT_ID,
      name: AGENT_NAME,
      status: "error",
      generated_at: new Date().toISOString(),
      last_activity_at: null,
      source: "agent GET /api/health + filesystem: uploads/",
      detail_url: AGENT_URL,
      kpis: [],
      warnings: [`KPI collection failed: ${err.message}`],
    });
  }
});

app.get(`/api/agents/${AGENT_ID}/status`, async (_req, res) => {
  try {
    const snap = await snapshot();
    res.json({ status: snap.status });
  } catch {
    res.json({ status: "error" });
  }
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`[${AGENT_ID}] KPI wrapper on http://127.0.0.1:${PORT} (agent: ${AGENT_URL})`);
});
