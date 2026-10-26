import React from 'react';
import { Wifi, WifiOff, ShieldCheck, Activity } from 'lucide-react';
import { useNetworkStatus } from '../lib/useNetworkStatus';

export const Header: React.FC = () => {
  const { isOnline } = useNetworkStatus();

  return (
    <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-sm backdrop-blur-md bg-white/95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center text-white shadow-md shadow-teal-700/20 flex-shrink-0">
            <Activity className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold tracking-tight text-slate-900 font-sans">
                F2R
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-teal-50 text-teal-700 border border-teal-200 px-1.5 py-0.5 rounded-md">
                Field-to-Record
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium hidden sm:block">
              Speak once. Get a safe, timestamped record.
            </p>
          </div>
        </div>

        {/* Offline Status Pill & Tamper Seal Badge */}
        <div className="flex items-center gap-2.5">
          <div
            id="status-pill"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              isOnline
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 shadow-sm shadow-emerald-500/10'
                : 'bg-amber-50 text-amber-800 border-amber-300 shadow-sm shadow-amber-500/10'
            }`}
            title={isOnline ? 'Online with offline service worker precached' : 'Device is running offline'}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            {isOnline ? (
              <span className="flex items-center gap-1">
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                Offline-ready
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                Offline mode
              </span>
            )}
          </div>

          <div className="hidden md:flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
            SHA-256 Audit Chain
          </div>
        </div>
      </div>
    </header>
  );
};
