/**
 * Maps an existing dashboard KPI id to the integrated agent that produces it,
 * so the Optimization Parameters cards can open that agent's detail view.
 * KPI ids with no locally integrated agent are absent and stay non-clickable.
 */
export const AGENT_KPI_LINKS: Record<string, string> = {
  retest_reduction: "retest_reduction",
  m_bist_shmoo: "shmoo_ml",
  test_time_reduction: "test_time_opt",
};

export function getAgentIdForKpi(kpiId: string): string | undefined {
  return AGENT_KPI_LINKS[kpiId];
}
