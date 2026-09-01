import {
  DEFAULT_COST_SAVINGS_CONFIG,
  type CostSavingsConfig,
} from "@/api/analysisTypes";

const STORAGE_KEY = "dtl-cost-savings-config";

export function readCostSavingsConfig(): CostSavingsConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_COST_SAVINGS_CONFIG };
    const parsed = JSON.parse(raw) as Partial<CostSavingsConfig>;
    return {
      testerCostPerHour:
        Number(parsed.testerCostPerHour) || DEFAULT_COST_SAVINGS_CONFIG.testerCostPerHour,
    };
  } catch {
    return { ...DEFAULT_COST_SAVINGS_CONFIG };
  }
}

export function writeCostSavingsConfig(config: CostSavingsConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    /* ignore quota / private mode */
  }
}
