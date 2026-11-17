import React from 'react';
import { Mic, ClipboardList, Shield, MonitorDot, Ambulance, Radio } from 'lucide-react';
import type { ViewMode } from '../lib/types';

export type TabType = 'capture' | 'runsheet';

interface NavigationProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  recordCount: number;
  viewMode: ViewMode;
  onSelectViewMode: (mode: ViewMode) => void;
  hasIncomingAlert?: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  recordCount,
  viewMode,
  onSelectViewMode,
  hasIncomingAlert,
}) => {
  const isHospital = viewMode === 'hospital';

  return (
    <>
      {/* Desktop Sidebar (hidden on mobile, visible on md: screens) */}
      <aside
        className={`hidden md:flex flex-col w-64 border-r min-h-[calc(100vh-61px)] p-4 flex-shrink-0 transition-colors ${
          isHospital
            ? 'bg-[#080E1A] border-slate-800 text-slate-100'
            : 'bg-white border-slate-200/90 text-slate-800'
        }`}
      >
        {/* VIEW SELECTOR TOGGLE IN SIDEBAR */}
        <div className="mb-4 pb-4 border-b border-slate-200/60 dark:border-slate-800">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2 font-mono">
            Active System View
          </span>
          <div className="space-y-1.5">
            <button
              id="sidebar-toggle-paramedic"
              onClick={() => onSelectViewMode('paramedic')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-semibold text-xs transition-all ${
                viewMode === 'paramedic'
                  ? 'bg-teal-50 text-teal-900 border border-teal-200 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Ambulance className="w-4 h-4 text-teal-600" />
                <span>Paramedic View</span>
              </div>
              <span className="text-[10px] bg-slate-200/70 text-slate-700 px-1.5 py-0.2 rounded font-mono">
                Field
              </span>
            </button>

            <button
              id="sidebar-toggle-hospital"
              onClick={() => onSelectViewMode('hospital')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-semibold text-xs transition-all relative ${
                viewMode === 'hospital'
                  ? 'bg-slate-900 text-teal-300 border border-slate-700 shadow-sm ring-1 ring-teal-500/50'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <MonitorDot className="w-4 h-4 text-teal-400" />
                <span>Hospital ED View</span>
              </div>
              {hasIncomingAlert ? (
                <span className="bg-amber-500 text-amber-950 text-[10px] font-black px-1.5 py-0.2 rounded-full font-mono animate-pulse">
                  Alert
                </span>
              ) : (
                <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded font-mono">
                  Monitor
                </span>
              )}
            </button>
          </div>
        </div>

        {/* PARAMEDIC TABS (WHEN IN PARAMEDIC VIEW) */}
        {viewMode === 'paramedic' ? (
          <div className="space-y-1.5 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1 font-mono">
              Paramedic Navigation
            </span>
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
                <div className="font-semibold text-slate-900">Capture Note</div>
                <div className="text-xs text-slate-500">Clinical Assistant</div>
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
                  <div className="font-semibold text-slate-900">Verified Run-sheet</div>
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
        ) : (
          /* HOSPITAL ED MONITOR CONTROLS IN SIDEBAR */
          <div className="space-y-3 flex-1 font-mono text-xs text-slate-300">
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2 text-teal-400 font-bold">
                <Radio className="w-4 h-4 animate-pulse" />
                <span>ED Telemetry Active</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Listening to local storage and browser events for incoming confirmed administrations.
              </p>
              <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-800">
                Protocol: HL7 FHIR R4
              </div>
            </div>
          </div>
        )}

        {/* Safety & Protocol Footer in Desktop Sidebar */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <div
            className={`rounded-xl p-3 border ${
              isHospital
                ? 'bg-slate-900/60 border-slate-800 text-slate-400'
                : 'bg-slate-50 border-slate-200/80 text-slate-500'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              <Shield className="w-4 h-4 text-teal-600" />
              Safety Protocol
            </div>
            <p className="text-[11px] leading-relaxed">
              Please review and confirm all highlighted medical fields before saving the record.
            </p>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Tab Bar (fixed at bottom on mobile, hidden on md: screens) */}
      <nav
        aria-label="Mobile Navigation"
        className={`md:hidden fixed bottom-0 left-0 right-0 z-40 pb-safe shadow-[0_-4px_16px_rgba(0,0,0,0.15)] backdrop-blur-md border-t transition-colors ${
          isHospital
            ? 'bg-[#070D18]/95 border-slate-800 text-slate-300'
            : 'bg-white/95 border-slate-200 text-slate-700'
        }`}
      >
        <div className="grid grid-cols-3 max-w-md mx-auto">
          {/* Tab 1: Capture */}
          <button
            id="nav-tab-capture-mobile"
            onClick={() => {
              onSelectViewMode('paramedic');
              onSelectTab('capture');
            }}
            className={`flex flex-col items-center justify-center py-2 px-1 min-h-[56px] transition-colors ${
              viewMode === 'paramedic' && activeTab === 'capture'
                ? 'text-teal-600 font-bold'
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            <div
              className={`p-1.5 rounded-full mb-1 transition-transform ${
                viewMode === 'paramedic' && activeTab === 'capture' ? 'bg-teal-50 scale-110' : ''
              }`}
            >
              <Mic className="w-5 h-5" />
            </div>
            <span className="text-[11px] tracking-tight">Capture</span>
          </button>

          {/* Tab 2: Run-sheet */}
          <button
            id="nav-tab-runsheet-mobile"
            onClick={() => {
              onSelectViewMode('paramedic');
              onSelectTab('runsheet');
            }}
            className={`flex flex-col items-center justify-center py-2 px-1 min-h-[56px] transition-colors relative ${
              viewMode === 'paramedic' && activeTab === 'runsheet'
                ? 'text-teal-600 font-bold'
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            <div
              className={`p-1.5 rounded-full mb-1 transition-transform ${
                viewMode === 'paramedic' && activeTab === 'runsheet' ? 'bg-teal-50 scale-110' : ''
              }`}
            >
              <ClipboardList className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[11px] tracking-tight">Run-sheet</span>
              {recordCount > 0 && (
                <span className="bg-teal-600 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full min-w-[14px] text-center">
                  {recordCount}
                </span>
              )}
            </div>
          </button>

          {/* Tab 3: Hospital ED Monitor */}
          <button
            id="nav-tab-hospital-mobile"
            onClick={() => onSelectViewMode('hospital')}
            className={`flex flex-col items-center justify-center py-2 px-1 min-h-[56px] transition-colors relative ${
              viewMode === 'hospital'
                ? 'text-teal-400 font-bold'
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            <div
              className={`p-1.5 rounded-full mb-1 transition-transform ${
                viewMode === 'hospital' ? 'bg-slate-800 text-teal-400 scale-110 ring-1 ring-teal-500/50' : ''
              }`}
            >
              <MonitorDot className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[11px] tracking-tight">Hospital ED</span>
              {hasIncomingAlert && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              )}
            </div>
          </button>
        </div>
      </nav>
    </>
  );
};
