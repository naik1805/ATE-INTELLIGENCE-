import React from 'react';
import { Target, Zap, Clock, ShieldAlert, Cpu } from 'lucide-react';
import { SessionSummary } from '../types';

interface KpiCardsProps {
  summary: SessionSummary;
}

export const KpiCards: React.FC<KpiCardsProps> = ({ summary }) => {
  const cards = [
    {
      title: 'DIES PROCESSED',
      value: summary.dies_processed.toString(),
      unit: 'dies',
      subtitle: 'Session Total',
      icon: Cpu,
      color: 'text-sky-600 dark:text-sky-400',
      bgColor: 'bg-sky-100 dark:bg-sky-500/10'
    },
    {
      title: 'TOP-1 ACCURACY',
      value: summary.top1_accuracy_percent,
      subtitle: 'Matches Optimal Ground-Truth',
      icon: Target,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-100 dark:bg-emerald-500/10'
    },
    {
      title: 'RETEST CYCLES AVOIDED',
      value: summary.retest_cycles_avoided.toString(),
      unit: 'passes',
      subtitle: 'Versus Fixed Sequential Try-Order',
      icon: Zap,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-100 dark:bg-amber-500/10'
    },
    {
      title: 'CUMULATIVE TIME SAVED',
      value: `${summary.cumulative_time_saved_ms.toFixed(1)}`,
      unit: 'ms',
      subtitle: 'Compute & Test Time Saved',
      icon: Clock,
      color: 'text-cyan-600 dark:text-cyan-400',
      bgColor: 'bg-cyan-100 dark:bg-cyan-500/10'
    },
    {
      title: 'FEASIBILITY MISS RATE',
      value: `${(summary.feasibility_miss_rate * 100).toFixed(1)}%`,
      subtitle: summary.fallback_count === 0 ? '0 Fallbacks Triggered' : `${summary.fallback_count} Fallbacks Triggered`,
      icon: ShieldAlert,
      color: summary.fallback_count === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
      bgColor: summary.fallback_count === 0 ? 'bg-emerald-100 dark:bg-emerald-500/10' : 'bg-rose-100 dark:bg-rose-500/10'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className="bg-white dark:bg-[#12162A] border border-slate-200 dark:border-[#233044] rounded-lg p-4 flex flex-col justify-between hover:border-slate-400 dark:hover:border-slate-600 transition-colors shadow-sm dark:shadow-none"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                {card.title}
              </span>
              <div className={`p-1.5 rounded-md ${card.bgColor} ${card.color}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-3 flex items-baseline space-x-1 font-mono">
              <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight tabular-nums">
                {card.value}
              </span>
              {card.unit && <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">{card.unit}</span>}
            </div>

            <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center space-x-1">
              <span>{card.subtitle}</span>
            </p>
          </div>
        );
      })}
    </div>
  );
};
