const CACHE_VERSION = "v1";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function cacheKey(agentId) {
  return `verilumen_cache_${CACHE_VERSION}:${agentId}`;
}

export function readAgentCache(agentId) {
  try {
    const raw = sessionStorage.getItem(cacheKey(agentId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > CACHE_TTL_MS) {
      sessionStorage.removeItem(cacheKey(agentId));
      return null;
    }
    return parsed.payload ?? null;
  } catch {
    return null;
  }
}

export function writeAgentCache(agentId, payload) {
  try {
    sessionStorage.setItem(
      cacheKey(agentId),
      JSON.stringify({ savedAt: Date.now(), payload }),
    );
    window.parent?.postMessage(
      { type: "verilumen-agent-cache", agentId, payload },
      "*",
    );
  } catch {
    /* storage full */
  }
}

export function clearAgentCache(agentId) {
  sessionStorage.removeItem(cacheKey(agentId));
}

export function ackCacheRestore(agentId) {
  window.parent?.postMessage({ type: "verilumen-cache-ack", agentId }, "*");
}
