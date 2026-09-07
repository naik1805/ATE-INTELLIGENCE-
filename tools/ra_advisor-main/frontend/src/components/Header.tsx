import React from 'react';
import { Cpu, Terminal, Sun, Moon } from 'lucide-react';

interface HeaderProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  theme,
  onToggleTheme
}) => {
  return (
    <header className="h-14 border-b border-slate-200 dark:border-[#233044] bg-white dark:bg-[#0B0D12] px-6 flex items-center justify-between sticky top-0 z-50 transition-colors">
      {/* Left branding */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-md bg-sky-100 dark:bg-sky-950 border border-sky-300 dark:border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white">RA ADVISOR</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#12162A] text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-[#233044]">
                v1.0-PROD
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 tracking-wide">
              MBIST / BISR Redundancy Analysis AI Decision Support
            </p>
          </div>
        </div>

        <div className="h-4 w-[1px] bg-slate-300 dark:bg-[#233044] hidden md:block" />

        <div className="hidden md:flex items-center space-x-2 text-xs font-mono text-slate-600 dark:text-slate-400">
          <Terminal className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
          <span>ATE Software Layer: Inline Inference Engine</span>
        </div>
      </div>

      {/* Right theme switcher */}
      <div className="flex items-center space-x-4 text-xs font-mono">
        {/* Theme Toggle Button */}
        <button
          onClick={onToggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          className="p-1.5 rounded-md border border-slate-300 dark:border-[#233044] bg-slate-100 dark:bg-[#12162A] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#1B2038] transition-all flex items-center space-x-1.5"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span className="text-[11px] font-sans font-medium hidden sm:inline">Light</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-sky-600" />
              <span className="text-[11px] font-sans font-medium hidden sm:inline">Dark</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
