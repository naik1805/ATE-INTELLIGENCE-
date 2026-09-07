/**
 * Unified agent integration config.
 *
 * Maps agent_id -> { base_url, kpi_endpoint, status_endpoint } for the
 * KPI wrapper sidecars. Every base URL is overridable via a NEXT_PUBLIC_ env
 * var; the literal process.env references below are required for Next.js to
 * inline them at build time.
 *
 * No env var currently exists for any of these in the repo -- there is no
 * .env file in ate_frontend and no agent defines one -- so the fallbacks are
 * the inferred loopback ports assigned to the wrappers. `envVar` and
 * `usingFallback` are exposed so the UI can flag that rather than hide it.
 */

const RAW = {
  shmoo_ml: {
    name: "M-BIST Shmoo ML",
    envVar: "NEXT_PUBLIC_AGENT_SHMOO_ML_URL",
    url: process.env.NEXT_PUBLIC_AGENT_SHMOO_ML_URL,
    fallback: "http://127.0.0.1:8801",
    uiUrl: process.env.NEXT_PUBLIC_AGENT_SHMOO_ML_UI_URL,
    uiFallback: "http://127.0.0.1:5000",
    apiUrl: process.env.NEXT_PUBLIC_AGENT_SHMOO_ML_API_URL,
    apiFallback: "http://127.0.0.1:5000",
  },
  test_time_opt: {
    name: "ATE Test Time Optimization",
    envVar: "NEXT_PUBLIC_AGENT_TEST_TIME_OPT_URL",
    url: process.env.NEXT_PUBLIC_AGENT_TEST_TIME_OPT_URL,
    fallback: "http://127.0.0.1:8802",
    uiUrl: process.env.NEXT_PUBLIC_AGENT_TEST_TIME_OPT_UI_URL,
    uiFallback: "http://127.0.0.1:5173",
    apiUrl: process.env.NEXT_PUBLIC_AGENT_TEST_TIME_OPT_API_URL,
    apiFallback: "http://127.0.0.1:8787",
  },
  dtl: {
    name: "Dynamic Test Limits",
    envVar: "NEXT_PUBLIC_AGENT_DTL_URL",
    url: process.env.NEXT_PUBLIC_AGENT_DTL_URL,
    fallback: "http://127.0.0.1:8803",
    uiUrl: process.env.NEXT_PUBLIC_AGENT_DTL_UI_URL,
    uiFallback: "http://127.0.0.1:5174/three-month",
    apiUrl: process.env.NEXT_PUBLIC_AGENT_DTL_API_URL,
    apiFallback: "http://127.0.0.1:8010/api/v1",
  },
  retest_reduction: {
    name: "Retest Benefit Prediction",
    envVar: "NEXT_PUBLIC_AGENT_RETEST_REDUCTION_URL",
    url: process.env.NEXT_PUBLIC_AGENT_RETEST_REDUCTION_URL,
    fallback: "http://127.0.0.1:8804",
    uiUrl: process.env.NEXT_PUBLIC_AGENT_RETEST_REDUCTION_UI_URL,
    uiFallback: "http://127.0.0.1:5175",
    apiUrl: process.env.NEXT_PUBLIC_AGENT_RETEST_REDUCTION_API_URL,
    apiFallback: "http://127.0.0.1:8020",
  },
  ra_advisor: {
    name: "RA Advisor",
    envVar: "NEXT_PUBLIC_AGENT_RA_ADVISOR_URL",
    url: process.env.NEXT_PUBLIC_AGENT_RA_ADVISOR_URL,
    fallback: "http://127.0.0.1:8805",
    uiUrl: process.env.NEXT_PUBLIC_AGENT_RA_ADVISOR_UI_URL,
    uiFallback: "http://127.0.0.1:8030",
    apiUrl: process.env.NEXT_PUBLIC_AGENT_RA_ADVISOR_API_URL,
    apiFallback: "http://127.0.0.1:8030",
  },
};

export const AGENTS = Object.fromEntries(
  Object.entries(RAW).map(([id, cfg]) => {
    const baseUrl = (cfg.url || cfg.fallback).replace(/\/$/, "");
    return [
      id,
      {
        agent_id: id,
        name: cfg.name,
        base_url: baseUrl,
        kpi_endpoint: `${baseUrl}/api/agents/${id}/kpis`,
        status_endpoint: `${baseUrl}/api/agents/${id}/status`,
        ui_url: (cfg.uiUrl || cfg.uiFallback).replace(/\/$/, ""),
        api_url: (cfg.apiUrl || cfg.apiFallback).replace(/\/$/, ""),
        env_var: cfg.envVar,
        using_fallback: !cfg.url,
      },
    ];
  }),
);

export const AGENT_IDS = Object.keys(RAW);

export function getAgentConfig(agentId) {
  return AGENTS[agentId] ?? null;
}

/** Polling cadence for agent KPI cards, in milliseconds. */
export const AGENT_POLL_INTERVAL_MS = 7000;

/** Default dataset API (served by Next at /api/default-data, or integration server on 8810). */
export const DEFAULT_DATA_URL = (
  process.env.NEXT_PUBLIC_DEFAULT_DATA_URL || "http://127.0.0.1:3000/api/default-data"
).replace(/\/$/, "");

export function getAgentUiUrl(agentId, autoload = true) {
  const cfg = getAgentConfig(agentId);
  if (!cfg) return null;
  if (!autoload) return cfg.ui_url;
  const join = cfg.ui_url.includes("?") ? "&" : "?";
  return `${cfg.ui_url}${join}autoload=1`;
}
