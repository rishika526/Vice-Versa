import React from 'react';
import { Mic, ClipboardList, Shield } from 'lucide-react';

export type TabType = 'capture' | 'runsheet';

interface NavigationProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  recordCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  recordCount,
}) => {
  return (
    <>
      {/* Desktop Sidebar (hidden on mobile, visible on md: screens) */}
      <aside className="hidden md:flex flex-col w-64 border-r border-slate-200/90 bg-white min-h-[calc(100vh-61px)] p-4 flex-shrink-0">
        <div className="space-y-1.5 flex-1">
          <button
            id="nav-tab-capture-desktop"
            onClick={() => onSelectTab('capture')}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-medium text-sm transition-all text-left ${
              activeTab === 'capture'
                ? 'bg-teal-50 text-teal-800 font-semibold border border-teal-200 shadow-sm shadow-teal-700/5'
                : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
            }`}
          >
            <div
              className={`p-2 rounded-lg ${
                activeTab === 'capture'
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-slate-900">Capture</div>
              <div className="text-xs text-slate-500">Voice or text note</div>
            </div>
          </button>

          <button
            id="nav-tab-runsheet-desktop"
            onClick={() => onSelectTab('runsheet')}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl font-medium text-sm transition-all text-left ${
              activeTab === 'runsheet'
                ? 'bg-teal-50 text-teal-800 font-semibold border border-teal-200 shadow-sm shadow-teal-700/5'
                : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg ${
                  activeTab === 'runsheet'
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                <ClipboardList className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-slate-900">Run-sheet</div>
                <div className="text-xs text-slate-500">Audit timeline</div>
              </div>
            </div>
            {recordCount > 0 && (
              <span className="bg-teal-100 text-teal-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-teal-300">
                {recordCount}
              </span>
            )}
          </button>
        </div>

        {/* Safety & Protocol Footer in Desktop Sidebar */}
        <div className="pt-4 border-t border-slate-100">
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
              <Shield className="w-4 h-4 text-teal-600" />
              Prehospital Protocol
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              No auto-fills. All ambiguous fields require active paramedic confirmation before sealing.
            </p>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Tab Bar (fixed at bottom on mobile, hidden on md: screens) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe shadow-[0_-4px_16px_rgba(0,0,0,0.05)]"
      >
        <div className="grid grid-cols-2 max-w-md mx-auto">
          <button
            id="nav-tab-capture-mobile"
            onClick={() => onSelectTab('capture')}
            className={`flex flex-col items-center justify-center py-2.5 px-3 min-h-[56px] transition-colors ${
              activeTab === 'capture'
                ? 'text-teal-700 font-bold'
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            <div
              className={`p-1.5 rounded-full mb-1 transition-transform ${
                activeTab === 'capture' ? 'bg-teal-50 scale-110' : ''
              }`}
            >
              <Mic className="w-5 h-5" />
            </div>
            <span className="text-xs tracking-tight">Capture</span>
          </button>

          <button
            id="nav-tab-runsheet-mobile"
            onClick={() => onSelectTab('runsheet')}
            className={`flex flex-col items-center justify-center py-2.5 px-3 min-h-[56px] transition-colors relative ${
              activeTab === 'runsheet'
                ? 'text-teal-700 font-bold'
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            <div
              className={`p-1.5 rounded-full mb-1 transition-transform ${
                activeTab === 'runsheet' ? 'bg-teal-50 scale-110' : ''
              }`}
            >
              <ClipboardList className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs tracking-tight">Run-sheet</span>
              {recordCount > 0 && (
                <span className="bg-teal-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-[16px] text-center">
                  {recordCount}
                </span>
              )}
            </div>
          </button>
        </div>
      </nav>
    </>
  );
};
