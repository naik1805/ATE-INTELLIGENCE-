import { NextRequest, NextResponse } from "next/server";
import type { DashboardSummary, DieOut, WaferDetail } from "@/types/api";
import type { Kpi } from "@/types/kpi";

export function isOfflineDesktop(): boolean {
  if (
    process.env.OFFLINE_DESKTOP === "1" ||
    process.env.NEXT_PUBLIC_OFFLINE_DESKTOP === "1"
  ) {
    return true;
  }
  if (process.env.VERCEL) return false;
  const proxy = (process.env.API_PROXY_TARGET || "").replace(/\/$/, "");
  // Integration server on :8810 only serves default-data, not dashboard APIs.
  return proxy.endsWith(":8810") || !proxy || !proxy.includes("onrender.com");
}

/** Dashboard API paths that must be mocked locally (never proxied to :8810). */
const OFFLINE_CORE_PATHS = new Set([
  "health",
  "ready",
  "auth/me",
  "auth/login",
  "dashboard/summary",
  "kpis",
  "maintenance",
  "test-limits",
  "events",
  "events/filters",
]);

export function isOfflineCorePath(path: string): boolean {
  if (OFFLINE_CORE_PATHS.has(path)) return true;
  return path.startsWith("wafers/") || path.startsWith("shmoo/");
}

const DEMO_WAFER_ID = "W-DEMO-01";
const DEMO_LOT_ID = "LOT-DEMO";

function offlineDemoWafer(): WaferDetail {
  return {
    wafer_id: DEMO_WAFER_ID,
    lot_id: DEMO_LOT_ID,
    status: "in_test",
    yield_pct: 94.2,
    total_dies: 121,
    tested_dies: 121,
    caption: "Offline demo wafer — sample die map for desktop mode",
    bin_counts: { pass: 114, retest: 3, fail: 2, reclass: 2 },
    pass_count: 114,
    fail_count: 2,
    retest_count: 3,
    reclass_count: 2,
    updated_at: new Date().toISOString(),
  };
}

function offlineDemoDies(): DieOut[] {
  const results: Array<DieOut["result"]> = ["pass", "pass", "pass", "retest", "fail", "reclass"];
  const dies: DieOut[] = [];
  let n = 0;
  for (let row = 0; row < 11; row++) {
    for (let col = 0; col < 11; col++) {
      const dist = Math.hypot(row - 5, col - 5);
      if (dist > 5.2) continue;
      n += 1;
      const result = results[n % results.length] ?? "pass";
      dies.push({
        die_id: `D-${String(n).padStart(3, "0")}`,
        wafer_id: DEMO_WAFER_ID,
        x: col,
        y: row,
        row,
        column: col,
        result,
        bin: result,
      });
    }
  }
  return dies;
}

function offlineDashboardSummary(): DashboardSummary {
  const wafer = offlineDemoWafer();
  return {
    header: {
      lots_in_test: 3,
      test_time_saved_hours: 12.4,
      overall_yield_pct: wafer.yield_pct,
    },
    active_wafer: wafer,
    kpis: offlineKpis().map((k) => ({
      id: k.id,
      name: k.name,
      value: k.value,
      unit: k.unit,
      baseline: k.baseline,
      target: k.target,
      previous_value: k.previous_value,
      improvement: k.improvement,
      trend: k.trend,
      status: k.status,
      timestamp: k.timestamp,
      history: k.history.map((h) => ({ t: h.timestamp, v: h.value })),
    })),
    maintenance: {
      flagged_count: 0,
      model_available: false,
      assets: [],
    },
    test_limits: {
      adjustments_today: 0,
      items: [],
    },
    recent_events: [],
    connection_hint: "Offline desktop — integrated agents run locally",
  };
}

const OFFLINE_USER = {
  user_id: "offline-local",
  username: "local",
  full_name: "Local Operator",
  role: "ADMIN",
  permissions: ["*"],
};

function mockKpi(
  id: string,
  name: string,
  value: number,
  unit: string,
): Kpi {
  const ts = new Date().toISOString();
  return {
    id,
    name,
    value,
    unit,
    baseline: value,
    target: value,
    previous_value: value,
    improvement: 0,
    trend: "flat",
    status: "on_track",
    timestamp: ts,
    history: [{ timestamp: ts, value }],
  };
}

/** Placeholder KPIs so the optimization grid renders in offline desktop mode. */
function offlineKpis(): Kpi[] {
  return [
    mockKpi("retest_reduction", "Retest Reduction", 18.4, "%"),
    mockKpi("m_bist_shmoo", "M-BIST Shmoo ML", 94.2, "%"),
    mockKpi("test_time_reduction", "Test Time Reduction", 39.6, "%"),
    mockKpi("false_failure_reduction", "False Failure Reduction", 12.1, "%"),
    mockKpi("yield_improvement", "Yield Improvement", 2.8, "%"),
    mockKpi("escape_prevention", "Escape Prevention", 91.0, "%"),
    mockKpi("pattern_count_reduction", "Pattern Count Reduction", 8.5, "%"),
  ];
}

/**
 * Serve minimal API responses for the desktop bundle (no wafer-yield backend).
 * Returns null when the path should fall through to the normal proxy.
 */
export function handleOfflineApi(
  req: NextRequest,
  pathSegments: string[],
  options?: { force?: boolean },
): NextResponse | null {
  const path = pathSegments.join("/");
  const force = options?.force === true;
  if (!force && !isOfflineDesktop()) return null;
  if (force && !isOfflineCorePath(path)) return null;

  const method = req.method.toUpperCase();

  if (path === "health" && method === "GET") {
    return NextResponse.json({ status: "ok", database: false, redis: false });
  }

  if (path === "ready" && method === "GET") {
    return NextResponse.json({
      status: "ok",
      database: false,
      redis: false,
      websocket_clients: 0,
    });
  }

  if (path === "auth/me" && method === "GET") {
    return NextResponse.json(OFFLINE_USER);
  }

  if (path === "auth/login" && method === "POST") {
    return NextResponse.json({
      access_token: "offline-desktop",
      token_type: "bearer",
      role: "ADMIN",
      username: "local",
      user_id: "offline-local",
      expires_in_minutes: 60 * 24 * 365,
    });
  }

  if (path === "dashboard/summary" && method === "GET") {
    return NextResponse.json(offlineDashboardSummary());
  }

  if (path === "kpis" && method === "GET") {
    return NextResponse.json({ kpis: offlineKpis() });
  }

  if (path === "maintenance" && method === "GET") {
    return NextResponse.json({
      flagged_count: 0,
      model_available: false,
      assets: [],
    });
  }

  if (path === "test-limits" && method === "GET") {
    return NextResponse.json({ adjustments_today: 0, items: [] });
  }

  if (path === "events" && method === "GET") {
    return NextResponse.json({ total: 0, unacknowledged: 0, items: [] });
  }

  if (path === "events/filters" && method === "GET") {
    return NextResponse.json({
      testers: [],
      sites: [],
      lots: [],
      wafers: [],
      severities: ["INFO", "PASS", "WARN", "ERROR", "CRITICAL"],
      event_types: [],
    });
  }

  if (path.startsWith("wafers/") && method === "GET") {
    const parts = path.split("/");
    const waferId = decodeURIComponent(parts[1] ?? "");
    if (parts.length === 2) {
      if (waferId === DEMO_WAFER_ID) {
        return NextResponse.json(offlineDemoWafer());
      }
      return NextResponse.json({ detail: "Wafer not found" }, { status: 404 });
    }
    if (parts.length === 3 && parts[2] === "dies") {
      if (waferId === DEMO_WAFER_ID) {
        return NextResponse.json(offlineDemoDies());
      }
      return NextResponse.json([]);
    }
    return NextResponse.json({ detail: "Not found" }, { status: 404 });
  }

  if (path.startsWith("shmoo/") && method === "GET") {
    return NextResponse.json({ status: "empty" });
  }

  return NextResponse.json(
    { detail: `Offline desktop: ${method} /api/${path} is not available` },
    { status: 404 },
  );
}
