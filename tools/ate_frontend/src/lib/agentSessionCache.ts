const CACHE_VERSION = "v1";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function storageKey(agentId: string) {
  return `verilumen_dashboard_cache_${CACHE_VERSION}:${agentId}`;
}

export function readDashboardAgentCache(agentId: string): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(agentId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: number; payload: Record<string, unknown> };
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > CACHE_TTL_MS) {
      localStorage.removeItem(storageKey(agentId));
      return null;
    }
    return parsed.payload ?? null;
  } catch {
    return null;
  }
}

export function writeDashboardAgentCache(agentId: string, payload: Record<string, unknown>) {
  try {
    localStorage.setItem(
      storageKey(agentId),
      JSON.stringify({ savedAt: Date.now(), payload }),
    );
  } catch {
    /* quota */
  }
}
