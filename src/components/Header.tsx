import React from 'react';
import { Wifi, WifiOff, Clock, Activity, Ambulance, MonitorDot } from 'lucide-react';
import { useNetworkStatus } from '../lib/useNetworkStatus';
import type { ViewMode } from '../lib/types';

interface HeaderProps {
  viewMode: ViewMode;
  onSelectViewMode: (mode: ViewMode) => void;
  hasIncomingAlert?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  viewMode,
  onSelectViewMode,
  hasIncomingAlert,
}) => {
  const { isOnline } = useNetworkStatus();
  const isHospital = viewMode === 'hospital';

  return (
    <header
      className={`border-b sticky top-0 z-30 transition-colors duration-200 ${
        isHospital
          ? 'bg-[#070D18]/95 border-slate-800 text-slate-100 backdrop-blur-md'
          : 'bg-white/95 border-slate-200/80 text-slate-900 shadow-sm backdrop-blur-md'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex items-center justify-between gap-3">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-white shadow-md flex-shrink-0 ${
              isHospital
                ? 'bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 shadow-teal-500/10'
                : 'bg-gradient-to-br from-teal-600 to-teal-700 shadow-teal-700/20'
            }`}
          >
            <Activity className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5] text-teal-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`text-lg sm:text-xl font-extrabold tracking-tight font-sans ${
                  isHospital ? 'text-white' : 'text-slate-900'
                }`}
              >
                F2R
              </span>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                  isHospital
                    ? 'bg-slate-800 text-teal-300 border border-slate-700'
                    : 'bg-teal-50 text-teal-700 border border-teal-200'
                }`}
              >
                {isHospital ? 'ED Clinical Monitor' : 'Field-to-Record'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium hidden md:block">
              {isHospital
                ? 'Real-Time Prehospital Telemetry & Inbound Medication Tracker'
                : 'Speak once. Get a safe, timestamped record.'}
            </p>
          </div>
        </div>

        {/* CENTER VIEW SWITCHER: PARAMEDIC VIEW VS HOSPITAL ED VIEW */}
        <div className="flex items-center">
          <div
            id="view-mode-toggle"
            className={`flex items-center p-1 rounded-xl border transition-all ${
              isHospital
                ? 'bg-slate-900 border-slate-700'
                : 'bg-slate-100 border-slate-200'
            }`}
          >
            {/* Paramedic View Tab */}
            <button
              id="toggle-view-paramedic"
              onClick={() => onSelectViewMode('paramedic')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'paramedic'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : isHospital
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Ambulance className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Paramedic View</span>
              <span className="sm:hidden">Medic</span>
            </button>

            {/* Hospital ED View Tab */}
            <button
              id="toggle-view-hospital"
              onClick={() => onSelectViewMode('hospital')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 relative ${
                viewMode === 'hospital'
                  ? 'bg-slate-950 text-teal-300 shadow-sm ring-1 ring-teal-500/50'
                  : isHospital
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MonitorDot className="w-3.5 h-3.5 text-teal-400" />
              <span className="hidden sm:inline">Hospital ED View</span>
              <span className="sm:hidden">Hospital ED</span>
              {hasIncomingAlert && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping absolute -top-0.5 -right-0.5" />
              )}
            </button>
          </div>
        </div>

        {/* Offline Status Pill & HLC Sync Active Badge */}
        <div className="flex items-center gap-2">
          <div
            id="status-pill"
            className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold border transition-all ${
              isHospital
                ? isOnline
                  ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800'
                  : 'bg-amber-950/70 text-amber-300 border-amber-800'
                : isOnline
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 shadow-sm shadow-emerald-500/10'
                : 'bg-amber-50 text-amber-800 border-amber-300 shadow-sm shadow-amber-500/10'
            }`}
            title={
              isOnline
                ? 'Online with offline service worker precached'
                : 'Device is running in 100% offline mode'
            }
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            {isOnline ? (
              <span className="flex items-center gap-1">
                <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                <span className="hidden sm:inline">Offline-ready</span>
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <WifiOff className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden sm:inline">Offline mode</span>
              </span>
            )}
          </div>

          {/* Top Navigation Badge: ✓ Secure Sync */}
          <div
            id="hlc-sync-badge"
            className={`hidden sm:flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-full border transition-all ${
              isHospital
                ? 'bg-slate-900 border-slate-800 text-teal-400'
                : 'bg-teal-50/70 border-teal-200 text-teal-800'
            }`}
            title="Secure clinical synchronization active"
          >
            <Clock className="w-3.5 h-3.5 text-teal-600" />
            <span className="font-semibold">✓ Secure Sync</span>
          </div>
        </div>
      </div>
    </header>
  );
};
