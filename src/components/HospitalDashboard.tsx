import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Bell,
  BellOff,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Eye,
  FileCode,
  RefreshCw,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import type { ConfirmedRecord, AmbulanceTelemetryEvent } from '../lib/types';
import { formatTimeHHMMSS, exportSingleFHIRJson, buildFHIRMedicationAdministration } from '../lib/fhir';
import {
  subscribeToHospitalFeed,
  acknowledgeEvent,
  createMockAmbulanceTransmission,
} from '../lib/hospitalFeed';
import { getAllRecords, saveRecord } from '../lib/db';

interface HospitalDashboardProps {
  onSwitchToParamedic: () => void;
  incomingAlert?: AmbulanceTelemetryEvent | null;
  onAcknowledgeAlert?: () => void;
}

export const HospitalDashboard: React.FC<HospitalDashboardProps> = ({
  onSwitchToParamedic,
  incomingAlert: initialAlert,
  onAcknowledgeAlert,
}) => {
  // Starts strictly empty unless an incoming alert was passed or simulated
  const [currentAlert, setCurrentAlert] = useState<AmbulanceTelemetryEvent | null>(initialAlert || null);
  const [isFlashing, setIsFlashing] = useState<boolean>(Boolean(initialAlert));
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [showDemoTools, setShowDemoTools] = useState(false);
  const [records, setRecords] = useState<ConfirmedRecord[]>([]);
  const [showRawFHIR, setShowRawFHIR] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [selectedRecordForDetail, setSelectedRecordForDetail] = useState<ConfirmedRecord | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);

  // Play synthetic emergency alert tone (Web Audio API)
  const playAlertSound = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // Two-tone medical monitor chirp (880Hz then 1174Hz)
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.setValueAtTime(1174, now + 0.12);
      gain1.gain.setValueAtTime(0.2, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);
    } catch {
      // Audio policy catch
    }
  };

  // Keep digital clock ticking
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch all existing verified records from local DB
  const refreshRecords = async () => {
    try {
      const data = await getAllRecords();
      setRecords(data);
    } catch (e) {
      console.warn('Failed to fetch records in hospital monitor:', e);
    }
  };

  useEffect(() => {
    refreshRecords();
  }, []);

  // Synchronize with incoming alert passed from Paramedic View
  useEffect(() => {
    if (initialAlert) {
      setCurrentAlert(initialAlert);
      setIsFlashing(true);
    } else {
      setCurrentAlert(null);
      setIsFlashing(false);
    }
  }, [initialAlert]);

  // Subscribe to live hospital telemetry feed (cross-tab broadcasts)
  useEffect(() => {
    const unsubscribe = subscribeToHospitalFeed((event) => {
      setCurrentAlert(event);
      setIsFlashing(true);
      playAlertSound();
      refreshRecords();
    });

    return () => unsubscribe();
  }, [soundEnabled]);

  // Accept & Reconcile: Appends incoming alert to run-sheet stream with "✓ ED Reconciled" badge
  const handleAcceptAndReconcile = async () => {
    if (!currentAlert || !activeAlertRecord) return;
    const reconciledRecord: ConfirmedRecord = {
      ...activeAlertRecord,
      isReconciled: true,
      reconciledAt: new Date().toISOString(),
    };

    // 1. Clear alert from active top area
    acknowledgeEvent(currentAlert.id);
    setCurrentAlert(null);
    setIsFlashing(false);
    onAcknowledgeAlert?.();

    // 2. Persist to DB without duplicate broadcast
    try {
      await saveRecord(reconciledRecord, false);
    } catch (e) {
      console.warn('Failed saving reconciled record to DB:', e);
    }

    // 3. Immediately append/update into run-sheet stream
    setRecords((prev) => {
      const exists = prev.some((r) => r.id === reconciledRecord.id);
      if (exists) {
        return prev.map((r) => (r.id === reconciledRecord.id ? reconciledRecord : r));
      } else {
        return [reconciledRecord, ...prev];
      }
    });
  };

  // Copy FHIR JSON
  const handleCopyFHIR = async (fhirData: any) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(fhirData, null, 2));
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    } catch {
      // ignore
    }
  };

  // Simulate an ambulance transmission
  const handleSimulate = (type: 'seizure' | 'anaphylaxis' | 'cardiac_arrest' | 'cpr') => {
    const event = createMockAmbulanceTransmission(type);
    setCurrentAlert(event);
    setIsFlashing(true);
    playAlertSound();
    refreshRecords();
  };

  const activeAlertRecord = currentAlert?.record;
  const activeAlertFHIR =
    currentAlert?.fhirJson || (activeAlertRecord ? buildFHIRMedicationAdministration(activeAlertRecord) : null);

  return (
    <div className="bg-[#0B1120] text-slate-100 min-h-[calc(100vh-65px)] pb-24 font-sans telemetry-grid select-text">
      {/* CLINICAL MONITOR TOP TELEMETRY BAR */}
      <div className="border-b border-slate-800 bg-[#070D18]/90 backdrop-blur-md sticky top-[61px] z-20 px-4 sm:px-6 py-3 select-text">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10B981]" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold tracking-widest text-emerald-400 uppercase">
                  ED Resuscitation Bay 1 · Inbound Telemetry Link
                </span>
                <span className="bg-emerald-950 text-emerald-300 border border-emerald-700/60 text-[10px] font-mono px-2 py-0.5 rounded">
                  CHANNEL AMB-04 · LIVE
                </span>
              </div>
              <div className="text-xs text-slate-400 font-mono mt-0.5">
                System Time:{' '}
                <span className="text-slate-200 font-bold">{currentTime.toLocaleTimeString()}</span> · Date:{' '}
                <span className="text-slate-200">{currentTime.toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Audio Alarm Toggle */}
            <button
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                if (!soundEnabled) playAlertSound();
              }}
              title={soundEnabled ? 'Emergency Chime Enabled' : 'Emergency Chime Muted'}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition-all border min-h-[38px] ${
                soundEnabled
                  ? 'bg-amber-950/80 text-amber-300 border-amber-600 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              {soundEnabled ? <Bell className="w-3.5 h-3.5 text-amber-400" /> : <BellOff className="w-3.5 h-3.5" />}
              <span>{soundEnabled ? 'Audio: ON' : 'Audio: MUTED'}</span>
            </button>

            {/* Quick Refresh */}
            <button
              onClick={refreshRecords}
              className="p-2 rounded-lg bg-slate-900 text-slate-400 hover:text-white border border-slate-800 transition-all min-h-[38px] min-w-[38px] flex items-center justify-center"
              title="Refresh Telemetry Log"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Collapsible Demo Tools Dropdown (Moved from main screen to header per Requirement 4) */}
            <div className="relative">
              <button
                id="btn-demo-tools-dropdown"
                onClick={() => setShowDemoTools(!showDemoTools)}
                className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition-all border min-h-[38px] bg-slate-900 text-teal-300 border-teal-800/80 hover:bg-teal-950/60"
                title="Simulate Inbound Transmission"
              >
                <Zap className="w-3.5 h-3.5 text-teal-400" />
                <span>Demo Tools ▾</span>
              </button>

              {showDemoTools && (
                <div className="absolute right-0 mt-2 w-64 bg-slate-900/95 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 space-y-1 backdrop-blur-md animate-in fade-in zoom-in-95">
                  <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider px-2 py-1 border-b border-slate-800">
                    Trigger Inbound Telemetry
                  </div>
                  <button
                    id="simulate-cpr-btn"
                    onClick={() => {
                      handleSimulate('cpr');
                      setShowDemoTools(false);
                    }}
                    className="w-full text-left px-2.5 py-2 text-xs font-mono font-semibold rounded-lg hover:bg-cyan-950 text-cyan-300 border border-transparent hover:border-cyan-800/60 transition-all flex items-center gap-2"
                  >
                    <Activity className="w-3.5 h-3.5 text-cyan-400" />
                    Simulate CPR (Procedure)
                  </button>
                  <button
                    id="simulate-midazolam-btn"
                    onClick={() => {
                      handleSimulate('seizure');
                      setShowDemoTools(false);
                    }}
                    className="w-full text-left px-2.5 py-2 text-xs font-mono font-semibold rounded-lg hover:bg-teal-950 text-teal-300 border border-transparent hover:border-teal-800/60 transition-all flex items-center gap-2"
                  >
                    <Zap className="w-3.5 h-3.5 text-teal-400" />
                    Simulate Midazolam (Seizure)
                  </button>
                  <button
                    id="simulate-anaphylaxis-btn"
                    onClick={() => {
                      handleSimulate('anaphylaxis');
                      setShowDemoTools(false);
                    }}
                    className="w-full text-left px-2.5 py-2 text-xs font-mono font-semibold rounded-lg hover:bg-amber-950 text-amber-300 border border-transparent hover:border-amber-800/60 transition-all flex items-center gap-2"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    Simulate Anaphylaxis Epi
                  </button>
                  <button
                    id="simulate-cardiac-btn"
                    onClick={() => {
                      handleSimulate('cardiac_arrest');
                      setShowDemoTools(false);
                    }}
                    className="w-full text-left px-2.5 py-2 text-xs font-mono font-semibold rounded-lg hover:bg-rose-950 text-rose-300 border border-transparent hover:border-rose-800/60 transition-all flex items-center gap-2"
                  >
                    <Zap className="w-3.5 h-3.5 text-rose-400" />
                    Simulate Cardiac Arrest
                  </button>
                </div>
              )}
            </div>

            {/* Tiny quick-access outline buttons on wide screens */}
            <div className="hidden xl:flex items-center gap-1.5">
              <button
                onClick={() => handleSimulate('cpr')}
                className="px-2 py-1 text-[11px] font-mono text-cyan-400/90 hover:text-cyan-200 border border-cyan-800/60 hover:bg-cyan-950/40 rounded transition-all min-h-[34px]"
                title="Quick trigger CPR transmission"
              >
                +CPR
              </button>
              <button
                onClick={() => handleSimulate('seizure')}
                className="px-2 py-1 text-[11px] font-mono text-teal-400/90 hover:text-teal-200 border border-teal-800/60 hover:bg-teal-950/40 rounded transition-all min-h-[34px]"
                title="Quick trigger Midazolam transmission"
              >
                +Midazolam
              </button>
              <button
                onClick={() => handleSimulate('anaphylaxis')}
                className="px-2 py-1 text-[11px] font-mono text-amber-400/90 hover:text-amber-200 border border-amber-800/60 hover:bg-amber-950/40 rounded transition-all min-h-[34px]"
                title="Quick trigger Epi transmission"
              >
                +Epi
              </button>
            </div>

            {/* Switch to Paramedic View */}
            <button
              onClick={onSwitchToParamedic}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white shadow-md shadow-teal-900/40 transition-all flex items-center gap-1.5 min-h-[38px]"
            >
              <span>Paramedic Field View</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 select-text">
        {/* FLASHING "INCOMING AMBULANCE UPDATE" CARD - ONLY RENDERS ON SIMULATION OR PARAMEDIC SUBMISSION */}
        {currentAlert && activeAlertRecord ? (
          <section
            id="incoming-ambulance-card"
            className={`rounded-2xl transition-all duration-300 overflow-hidden relative select-text ${
              isFlashing
                ? 'bg-gradient-to-br from-amber-950/40 via-slate-900 to-[#0A101D] border-2 animate-hospital-beacon'
                : 'bg-slate-900/90 border border-slate-700/80 shadow-xl'
            }`}
          >
            {/* Top emergency flashing banner */}
            <div
              className={`px-5 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b select-text ${
                isFlashing
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-200'
                  : 'bg-slate-800/60 border-slate-700 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2.5 flex-wrap select-text">
                <span
                  className={`w-3 h-3 rounded-full ${
                    isFlashing ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'
                  }`}
                />
                <div className="flex items-center gap-2 select-text">
                  <ShieldAlert className={`w-5 h-5 ${isFlashing ? 'text-amber-400 animate-bounce' : 'text-teal-400'}`} />
                  <h2 className="text-sm sm:text-base font-bold tracking-wider uppercase font-mono select-text">
                    {isFlashing ? '🚨 INCOMING AMBULANCE UPDATE' : 'Ambulance Transmission Received'}
                  </h2>
                </div>
                {isFlashing && (
                  <span className="bg-amber-400 text-amber-950 font-black text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-mono animate-flash-text">
                    CRITICAL HANDOVER
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-slate-300 select-text">
                  Received:{' '}
                  <span className="text-amber-300 font-bold select-text">
                    {formatTimeHHMMSS(currentAlert.receivedAt)}
                  </span>
                </span>
                {/* DUAL-HANDOVER FEATURE: ACCEPT & RECONCILE BUTTON */}
                <button
                  id="btn-accept-reconcile"
                  onClick={handleAcceptAndReconcile}
                  className="px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 text-xs font-black font-mono uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-teal-500/30 active:scale-95 flex items-center gap-1.5 min-h-[38px] ring-2 ring-emerald-400/50 cursor-pointer"
                  title="Dual-Handshake: Accept and reconcile alert with hospital ED stream"
                >
                  <CheckCircle2 className="w-4 h-4 text-slate-950 stroke-[3]" />
                  <span>ACCEPT & RECONCILE</span>
                </button>
              </div>
            </div>

            {/* Structured Telemetry Body */}
            <div className="p-5 sm:p-6 space-y-5 select-text">
              {/* Unit & Metadata Strip (HLC Ordering, No Hash) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/70 border border-slate-800 rounded-xl p-4 font-mono text-xs select-text">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Unit Call Sign</span>
                  <span className="text-teal-400 font-bold text-sm select-text">MEDIC-04 (ALS Crew)</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Administered Time</span>
                  <span className="text-slate-200 font-bold text-sm select-text">
                    {formatTimeHHMMSS(activeAlertRecord.administeredAt)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">ETA to Trauma Bay</span>
                  <span className="text-amber-400 font-bold text-sm select-text">~4 MINS (INBOUND)</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Event Ordering</span>
                  <span className="text-emerald-400 font-bold text-sm flex items-center gap-1 select-text">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    ✓ Secure Sync
                  </span>
                </div>
              </div>

              {/* High-Contrast Clinical Telemetry Readings */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 select-text">
                {activeAlertRecord.isProcedure ? (
                  <>
                    {/* Clinical Procedure Tile */}
                    <div className="bg-cyan-950/30 border-2 border-cyan-500/50 rounded-xl p-4 shadow-[0_0_20px_rgba(6,182,212,0.15)] select-text">
                      <div className="flex items-center justify-between text-xs font-mono text-cyan-300 uppercase mb-1">
                        <span>1. Clinical Procedure</span>
                        <span className="bg-cyan-900/80 text-cyan-300 text-[10px] px-1.5 py-0.5 rounded font-bold">
                          SNOMED CT
                        </span>
                      </div>
                      <div className="text-2xl sm:text-3xl font-black text-cyan-300 font-sans tracking-tight select-text">
                        {activeAlertRecord.procedureName || activeAlertRecord.drug}
                      </div>
                      <div className="text-xs text-cyan-400/80 font-mono mt-1">
                        High-acuity prehospital intervention
                      </div>
                    </div>

                    {/* Status Tile */}
                    <div className="bg-emerald-950/30 border-2 border-emerald-500/50 rounded-xl p-4 shadow-[0_0_20px_rgba(16,185,129,0.15)] select-text">
                      <div className="flex items-center justify-between text-xs font-mono text-emerald-300 uppercase mb-1">
                        <span>2. Intervention Status</span>
                        <span className="bg-emerald-900/80 text-emerald-300 text-[10px] px-1.5 py-0.5 rounded font-bold">
                          Verified
                        </span>
                      </div>
                      <div className="text-2xl sm:text-3xl font-black text-emerald-300 font-mono tracking-tight select-text">
                        ACTIVE · UNBLOCKED
                      </div>
                      <div className="text-xs text-emerald-400/80 font-mono mt-1">
                        Immediate resuscitation in progress
                      </div>
                    </div>

                    {/* Indication Tile */}
                    <div className="bg-purple-950/30 border-2 border-purple-500/50 rounded-xl p-4 shadow-[0_0_20px_rgba(168,85,247,0.15)] select-text">
                      <div className="flex items-center justify-between text-xs font-mono text-purple-300 uppercase mb-1">
                        <span>3. Clinical Indication</span>
                        <span className="bg-purple-900/80 text-purple-300 text-[10px] px-1.5 py-0.5 rounded font-bold">
                          Protocol Match
                        </span>
                      </div>
                      <div className="text-xl sm:text-2xl font-black text-purple-300 font-sans capitalize select-text">
                        {activeAlertRecord.reason || 'Cardiac Arrest'}
                      </div>
                      <div className="text-xs text-purple-400 font-mono mt-1">
                        Protocol: Advanced Resuscitation
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Medication / Drug */}
                    <div className="bg-teal-950/30 border-2 border-teal-500/50 rounded-xl p-4 shadow-[0_0_20px_rgba(20,184,166,0.15)] select-text">
                      <div className="flex items-center justify-between text-xs font-mono text-teal-300 uppercase mb-1">
                        <span>1. Medication (Drug)</span>
                        <span className="bg-teal-900/80 text-teal-300 text-[10px] px-1.5 py-0.5 rounded font-bold">
                          RxNorm
                        </span>
                      </div>
                      <div className="text-2xl sm:text-3xl font-black text-teal-300 font-sans tracking-tight select-text">
                        {activeAlertRecord.drug}
                      </div>
                      <div className="text-xs text-teal-400/80 font-mono mt-1">
                        Standard prehospital formulation
                      </div>
                    </div>

                    {/* Dose & Unit */}
                    <div className="bg-sky-950/30 border-2 border-sky-500/50 rounded-xl p-4 shadow-[0_0_20px_rgba(14,165,233,0.15)] select-text">
                      <div className="flex items-center justify-between text-xs font-mono text-sky-300 uppercase mb-1">
                        <span>2. Administered Dose</span>
                        <span className="bg-sky-900/80 text-sky-300 text-[10px] px-1.5 py-0.5 rounded font-bold">
                          Confirmed
                        </span>
                      </div>
                      <div className="text-2xl sm:text-3xl font-black text-sky-300 font-mono tracking-tight select-text">
                        {activeAlertRecord.dose}{' '}
                        <span className="text-lg text-sky-400 font-sans font-bold select-text">{activeAlertRecord.unit}</span>
                      </div>
                      <div className="text-xs text-sky-400/80 font-mono mt-1">
                        Single administration verified
                      </div>
                    </div>

                    {/* Route & Reason */}
                    <div className="bg-purple-950/30 border-2 border-purple-500/50 rounded-xl p-4 shadow-[0_0_20px_rgba(168,85,247,0.15)] select-text">
                      <div className="flex items-center justify-between text-xs font-mono text-purple-300 uppercase mb-1">
                        <span>3. Route & Indication</span>
                        <span className="bg-purple-900/80 text-purple-300 text-[10px] px-1.5 py-0.5 rounded font-bold">
                          Protocol Match
                        </span>
                      </div>
                      <div className="text-xl sm:text-2xl font-black text-purple-300 font-sans capitalize select-text">
                        {activeAlertRecord.route}
                      </div>
                      <div className="text-xs text-purple-400 font-mono mt-1 capitalize select-text">
                        Indication: <span className="font-bold text-white select-text">{activeAlertRecord.reason}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Accurate Dynamic Paramedic Note Rendering with Standard Text Selection */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 select-text">
                <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-1.5 select-text">
                  Original Paramedic Note (Scene Dictation):
                </span>
                <p className="text-sm font-sans italic text-slate-100 select-text leading-relaxed cursor-text selection:bg-teal-700 selection:text-white">
                  "{activeAlertRecord.rawText || (activeAlertRecord.isProcedure ? `Procedure: ${activeAlertRecord.procedureName || activeAlertRecord.drug}` : `Administered ${activeAlertRecord.dose} ${activeAlertRecord.unit} ${activeAlertRecord.drug} via ${activeAlertRecord.route} for ${activeAlertRecord.reason}`)}"
                </p>
                <div className="text-xs font-mono text-slate-500 mt-2 select-text">
                  Event Reference: <span className="text-teal-400 font-semibold select-text">{activeAlertRecord.id}</span>
                </div>
              </div>

              {/* HL7 FHIR R4 STRUCTURED DATA SECTION */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950 select-text">
                <div className="bg-slate-900/90 px-4 py-2.5 flex items-center justify-between border-b border-slate-800 flex-wrap gap-2 select-text">
                  <div className="flex items-center gap-2 select-text">
                    <FileCode className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider select-text">
                      HL7 FHIR R4 · {activeAlertRecord.isProcedure ? 'Procedure' : 'MedicationAdministration'} Resource
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowRawFHIR(!showRawFHIR)}
                      className="px-2.5 py-1 text-xs font-mono text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-all flex items-center gap-1 min-h-[32px]"
                    >
                      <Eye className="w-3 h-3 text-teal-400" />
                      Toggle Data View
                    </button>
                    <button
                      onClick={() => handleCopyFHIR(activeAlertFHIR)}
                      className="px-2.5 py-1 text-xs font-mono text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-all flex items-center gap-1 min-h-[32px]"
                    >
                      <Copy className="w-3 h-3 text-teal-400" />
                      {copiedToast ? 'Copied!' : 'Copy FHIR'}
                    </button>
                    <button
                      onClick={() => exportSingleFHIRJson(activeAlertRecord)}
                      className="px-2.5 py-1 text-xs font-mono text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-all flex items-center gap-1 min-h-[32px]"
                    >
                      <Download className="w-3 h-3 text-teal-400" />
                      Download
                    </button>
                  </div>
                </div>

                {showRawFHIR && (
                  <div className="p-4 overflow-x-auto max-h-80 text-xs font-mono text-emerald-300 bg-[#060A12] border-t border-slate-800/80 select-text">
                    <pre className="select-text">{JSON.stringify(activeAlertFHIR, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : (
          /* Empty State while waiting for ambulance updates */
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 sm:p-12 text-center space-y-4 select-text">
            <div className="w-16 h-16 mx-auto rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-teal-400 animate-pulse">
              <Activity className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-200 font-mono uppercase tracking-wider select-text">
                Monitoring Inbound Paramedic Telemetry
              </h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto mt-1 select-text">
                Channel AMB-04 online and monitoring. Whenever a medication or procedure is confirmed in the
                Paramedic Field View (or via Demo Tools in the top bar), this resuscitation bay monitor will instantly flash and render the structured FHIR data.
              </p>
            </div>
            <div className="pt-1 flex items-center justify-center gap-2">
              <span className="inline-flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Radio Link Online · Awaiting Transmission
              </span>
            </div>
          </div>
        )}

        {/* VERIFIED MEDICATION LOG / INCOMING FEED */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4 select-text">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3 select-text">
            <div>
              <h3 className="text-base font-semibold text-slate-100 font-mono uppercase tracking-wider flex items-center gap-2 select-text">
                <span>Inbound Paramedic Run-Sheet Stream</span>
                <span className="text-xs bg-slate-800 text-teal-300 font-mono px-2 py-0.5 rounded-full border border-slate-700">
                  {records.length} Verified
                </span>
              </h3>
              <p className="text-sm text-slate-400 mt-0.5 select-text">
                Chronological list of all on-scene administrations confirmed by paramedics with secure clinical event ordering.
              </p>
            </div>
          </div>

          {records.length === 0 ? (
            <div className="text-center py-8 text-slate-500 font-mono text-xs select-text">
              No verified records logged in the local offline database yet.
            </div>
          ) : (
            <div className="space-y-3 select-text">
              {records.map((rec) => {
                const isSelected = selectedRecordForDetail?.id === rec.id;
                return (
                  <div
                    key={rec.id}
                    className={`bg-slate-950/80 border rounded-xl p-4 transition-all select-text ${
                      isSelected
                        ? 'border-teal-500 ring-1 ring-teal-500/40 bg-teal-950/20'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 select-text">
                      <div className="flex items-start sm:items-center gap-3 select-text">
                        <div className="w-9 h-9 rounded-lg bg-teal-950 border border-teal-800 text-teal-300 flex items-center justify-center font-mono font-bold text-xs flex-shrink-0 select-text">
                          {formatTimeHHMMSS(rec.administeredAt).slice(0, 5)}
                        </div>
                        <div className="select-text">
                          <div className="flex items-center gap-2 flex-wrap select-text">
                            <span className="text-base font-semibold text-slate-100 font-sans select-text">
                              {rec.isProcedure ? (rec.procedureName || rec.drug) : rec.drug}
                            </span>
                            {rec.isProcedure ? (
                              <span className="text-xs font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded select-text">
                                PROCEDURE
                              </span>
                            ) : (
                              <>
                                <span className="text-xs font-mono font-bold bg-sky-950 text-sky-300 border border-sky-800 px-2 py-0.5 rounded select-text">
                                  {rec.dose} {rec.unit}
                                </span>
                                <span className="text-xs font-mono font-semibold bg-purple-950 text-purple-300 border border-purple-800 px-2 py-0.5 rounded select-text">
                                  {rec.route}
                                </span>
                              </>
                            )}
                            <span className="text-xs text-slate-400 capitalize select-text">
                              Indication: <strong className="text-slate-200 select-text">{rec.reason}</strong>
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 italic mt-0.5 font-sans line-clamp-1 select-text">
                            "{rec.rawText}"
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded flex items-center gap-1 select-text">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          ✓ Secure Sync
                        </span>
                        {/* DUAL-HANDOVER FEATURE: ✓ ED Reconciled Badge */}
                        {rec.isReconciled && (
                          <span className="text-[10px] font-mono text-teal-300 bg-teal-950 border border-teal-600 px-2 py-0.5 rounded flex items-center gap-1 select-text shadow-sm font-semibold animate-in fade-in">
                            ✓ ED Reconciled
                          </span>
                        )}
                        <button
                          onClick={() => setSelectedRecordForDetail(isSelected ? null : rec)}
                          className="px-2.5 py-1 text-xs font-mono text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-all min-h-[32px]"
                        >
                          {isSelected ? 'Close' : 'View Data'}
                        </button>
                      </div>
                    </div>

                    {/* Inline FHIR inspection drawer */}
                    {isSelected && (
                      <div className="mt-3 pt-3 border-t border-slate-800 text-xs font-mono space-y-2 select-text">
                        <div className="flex items-center justify-between text-slate-400 select-text">
                          <span>Clinical Data Record:</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleCopyFHIR(buildFHIRMedicationAdministration(rec))}
                              className="text-teal-400 hover:underline flex items-center gap-1 min-h-[28px]"
                            >
                              <Copy className="w-3 h-3" /> Copy
                            </button>
                            <button
                              onClick={() => exportSingleFHIRJson(rec)}
                              className="text-teal-400 hover:underline flex items-center gap-1 min-h-[28px]"
                            >
                              <Download className="w-3 h-3" /> Download
                            </button>
                          </div>
                        </div>
                        <div className="bg-[#05080E] p-3 rounded-lg border border-slate-800/80 text-emerald-300 overflow-x-auto max-h-60 select-text">
                          <pre className="select-text">{JSON.stringify(buildFHIRMedicationAdministration(rec), null, 2)}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
