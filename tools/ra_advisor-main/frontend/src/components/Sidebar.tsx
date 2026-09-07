import React from 'react';
import { LayoutDashboard, Grid3X3, BrainCircuit, Clock, BarChart3, Settings } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: 'overview', label: 'Overview & KPIs', icon: LayoutDashboard },
    { id: 'bitmap', label: 'Fail Bitmap Analysis', icon: Grid3X3 },
    { id: 'inference', label: 'AI & Feasibility Engine', icon: BrainCircuit },
    { id: 'timing', label: 'Timing Breakdown', icon: Clock },
    { id: 'benchmark', label: 'Batch Session Benchmark', icon: BarChart3 },
  ];

  return (
    <aside className="w-60 border-r border-[#233044] bg-[#0B0D12] text-slate-100 flex flex-col justify-between p-4 min-h-[calc(100vh-3.5rem)] select-none">
      <div className="space-y-6">
        <div>
          <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase px-2">
            Navigation
          </span>
          <nav className="mt-2 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-[#12162A] text-sky-400 border-l-2 border-sky-400 font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#12162A]/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-sky-400' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div>
          <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase px-2">
            System Config
          </span>
          <div className="mt-2 px-3 py-3 rounded-md bg-[#12162A]/60 border border-[#233044] text-[11px] font-mono space-y-2 text-slate-400">
            <div className="flex justify-between">
              <span>Array Size:</span>
              <span className="text-slate-200 font-bold">16 x 32</span>
            </div>
            <div className="flex justify-between">
              <span>Spare Budget:</span>
              <span className="text-slate-200 font-bold">4r / 4c / 1b</span>
            </div>
            <div className="flex justify-between">
              <span>ECC Limit:</span>
              <span className="text-slate-200 font-bold">≤ 2 bits</span>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-[#233044]">
        <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-400 px-2">
          <Settings className="w-3.5 h-3.5" />
          <span>DFT / ATE Environment</span>
        </div>
      </div>
    </aside>
  );
};
