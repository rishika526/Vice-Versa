import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Pencil,
  ShieldAlert,
  ArrowRight,
  ShieldCheck,
  Cpu,
} from 'lucide-react';
import type { ExtractedNERResult, MedRoute, MedReason, MedUnit } from '../lib/types';
import { formatTimeHHMM } from '../lib/fhir';

const COMMON_PROCEDURES = [
  'CPR (Cardiopulmonary Resuscitation)',
  'Defibrillation / Shock',
  'Endotracheal Intubation',
  'Bag Valve Mask (BVM) Ventilation',
  'Tourniquet Application',
  'Transcutaneous Pacing',
  'Synchronized Cardioversion',
  'Needle Decompression',
];

const ROUTE_OPTIONS: MedRoute[] = [
  'IV push',
  'IV',
  'IM',
  'IO',
  'oral',
  'sublingual',
  'intranasal',
  'nebulised',
];

const REASON_OPTIONS: MedReason[] = [
  'seizure',
  'cardiac arrest',
  'anaphylaxis',
  'pain',
  'overdose',
  'low sugar',
  'chest pain',
  'breathing difficulty',
];

const COMMON_DRUGS = [
  'Midazolam',
  'Epinephrine',
  'Morphine',
  'Fentanyl',
  'Naloxone',
  'Aspirin',
  'Atropine',
  'Ondansetron',
  'Salbutamol',
  'Diazepam',
  'Ketamine',
  'Dextrose (D50)',
  'Normal Saline',
];

const UNIT_OPTIONS: MedUnit[] = ['mg', 'mcg', 'ml', 'g'];

interface DraftClinicalNoteCardProps {
  extracted: ExtractedNERResult;
  selectedDrug: string | null;
  selectedDose: string;
  selectedUnit: MedUnit | null;
  selectedRoute: MedRoute | null;
  selectedReason: MedReason | null;
  administeredTime: string;
  safetyWarnings: string[];
  safetyAcknowledged: boolean;
  isSealing: boolean;
  onSelectDrug: (drug: string | null) => void;
  onSelectDose: (dose: string) => void;
  onSelectUnit: (unit: MedUnit) => void;
  onSelectRoute: (route: MedRoute) => void;
  onSelectReason: (reason: MedReason) => void;
  onSetAdministeredTime: (iso: string) => void;
  onToggleSafetyAcknowledge: (val: boolean) => void;
  onConfirmMedication: (procedureOverride?: { isProcedure: boolean; procedureName: string }) => void;
}

export const DraftClinicalNoteCard: React.FC<DraftClinicalNoteCardProps> = ({
  extracted,
  selectedDrug,
  selectedDose,
  selectedUnit,
  selectedRoute,
  selectedReason,
  administeredTime,
  safetyWarnings,
  safetyAcknowledged,
  isSealing,
  onSelectDrug,
  onSelectDose,
  onSelectUnit,
  onSelectRoute,
  onSelectReason,
  onSetAdministeredTime,
  onToggleSafetyAcknowledge,
  onConfirmMedication,
}) => {
  // Requirement: "If the NLP detects a procedure, or if no Drug is found but text is present (like "CPR"), toggle the Draft Note into "Procedure Mode"."
  const [isProcedureMode, setIsProcedureMode] = useState<boolean>(() => {
    return Boolean(extracted.isProcedure || !extracted.drug);
  });

  const [selectedProcedureName, setSelectedProcedureName] = useState<string>(() => {
    return extracted.procedureName || 'CPR (Cardiopulmonary Resuscitation)';
  });

  useEffect(() => {
    const isProc = Boolean(extracted.isProcedure || !extracted.drug);
    setIsProcedureMode(isProc);
    if (extracted.procedureName) {
      setSelectedProcedureName(extracted.procedureName);
    }
  }, [extracted]);

  const missingDrug = !selectedDrug;
  const numDose = parseFloat(selectedDose);
  const missingDose = isNaN(numDose) || numDose <= 0;
  const missingUnit = !selectedUnit;
  const missingRoute = !selectedRoute;

  const missingFieldsList: string[] = [];
  if (!isProcedureMode) {
    if (missingDrug) missingFieldsList.push('Drug');
    if (missingDose) missingFieldsList.push('Dose');
    if (missingUnit) missingFieldsList.push('Unit');
    if (missingRoute) missingFieldsList.push('Route');
  }

  const hasMissingFields = !isProcedureMode && missingFieldsList.length > 0;
  const hasUnacknowledgedWarning = safetyWarnings.length > 0 && !safetyAcknowledged;
  const canConfirm = !hasMissingFields && !hasUnacknowledgedWarning && !isSealing;

  return (
    <section
      id="draft-clinical-note-card"
      className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden animate-in fade-in duration-200 transition-all select-text"
    >
      {/* CARD HEADER: DRAFT CLINICAL NOTE STATUS & AI METADATA */}
      <div className="bg-gradient-to-r from-slate-50 to-teal-50/40 px-5 sm:px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-lg font-semibold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Draft Clinical Note</span>
            </h2>
            <span
              className={`text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full tracking-wider shadow-sm border ${
                isProcedureMode
                  ? 'bg-cyan-100 text-cyan-950 border-cyan-300'
                  : 'bg-amber-100 text-amber-900 border-amber-300'
              }`}
            >
              {isProcedureMode ? '⚡ Procedure Mode Active' : 'Pending Paramedic Confirmation'}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {isProcedureMode
              ? 'Emergency Procedure Mode: Clinical intervention detected. Confirm immediately to seal into audit timeline.'
              : 'Safety Protocol: Please review and confirm all highlighted medical fields before saving the record.'}
          </p>
        </div>

        {/* AI Engine & Mode Switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsProcedureMode(!isProcedureMode)}
            className={`px-3 py-1 rounded-full text-xs font-bold border transition-all shadow-sm ${
              isProcedureMode
                ? 'bg-cyan-50 hover:bg-cyan-100 text-cyan-900 border-cyan-300'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
            }`}
          >
            {isProcedureMode ? '⚡ Procedure Mode' : '💊 Medication Mode'}
          </button>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white border border-teal-200 text-teal-800 shadow-sm">
            <Cpu className="w-3.5 h-3.5 text-teal-600" />
            <span>Clinical Assistant</span>
            <span className="text-[10px] bg-teal-100 text-teal-900 font-bold px-1.5 py-0.2 rounded-full">
              {Math.round(extracted.confidence.overall * 100)}% Conf
            </span>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-5 select-text">
        {/* INLINE TOKENIZED PREVIEW WITH HIGHLIGHTED TAGS */}
        <div className="bg-slate-50/90 rounded-xl p-4 border border-slate-200 space-y-2 select-text">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600 uppercase tracking-wider">
            <span>Clinical Text with Extracted Entity Tokens</span>
            <span className="text-xs font-normal text-slate-500">
              Captured: {formatTimeHHMM(extracted.capturedAt)}
            </span>
          </div>

          <div className="text-sm sm:text-base leading-relaxed font-sans text-slate-800 bg-white p-3.5 rounded-lg border border-slate-200/80 shadow-inner select-text">
            {extracted.tokens.map((token, idx) => {
              if (token.tag === 'PROCEDURE') {
                return (
                  <mark
                    key={idx}
                    className="bg-cyan-100 text-cyan-950 font-bold px-1.5 py-0.5 rounded border border-cyan-400 mx-0.5 shadow-sm inline-block select-text"
                    title={`Procedure Entity (Confidence: ${Math.round(token.confidence * 100)}%)`}
                  >
                    {token.text}
                    <span className="text-[9px] font-mono text-cyan-800 ml-1 uppercase">PROCEDURE</span>
                  </mark>
                );
              }
              if (token.tag === 'DRUG') {
                return (
                  <mark
                    key={idx}
                    className="bg-teal-100 text-teal-950 font-bold px-1.5 py-0.5 rounded border border-teal-300 mx-0.5 shadow-sm inline-block select-text"
                    title={`Drug Entity (Confidence: ${Math.round(token.confidence * 100)}%)`}
                  >
                    {token.text}
                    <span className="text-[9px] font-mono text-teal-800 ml-1 uppercase">DRUG</span>
                  </mark>
                );
              }
              if (token.tag === 'DOSE') {
                return (
                  <mark
                    key={idx}
                    className="bg-sky-100 text-sky-950 font-bold px-1.5 py-0.5 rounded border border-sky-300 mx-0.5 shadow-sm inline-block select-text"
                    title={`Dose Entity (Confidence: ${Math.round(token.confidence * 100)}%)`}
                  >
                    {token.text}
                    <span className="text-[9px] font-mono text-sky-800 ml-1 uppercase">DOSE</span>
                  </mark>
                );
              }
              if (token.tag === 'ROUTE') {
                return (
                  <mark
                    key={idx}
                    className="bg-purple-100 text-purple-950 font-bold px-1.5 py-0.5 rounded border border-purple-300 mx-0.5 shadow-sm inline-block select-text"
                    title={`Route Entity (Confidence: ${Math.round(token.confidence * 100)}%)`}
                  >
                    {token.text}
                    <span className="text-[9px] font-mono text-purple-800 ml-1 uppercase">ROUTE</span>
                  </mark>
                );
              }
              if (token.tag === 'REASON') {
                return (
                  <mark
                    key={idx}
                    className="bg-indigo-100 text-indigo-950 font-medium px-1.5 py-0.5 rounded border border-indigo-200 mx-0.5 inline-block select-text"
                  >
                    {token.text}
                    <span className="text-[9px] font-mono text-indigo-800 ml-1 uppercase">INDICATION</span>
                  </mark>
                );
              }
              if (token.tag === 'TIME') {
                return (
                  <mark
                    key={idx}
                    className="bg-slate-200/80 text-slate-800 font-mono text-xs px-1.5 py-0.5 rounded mx-0.5 inline-block select-text"
                  >
                    {token.text}
                  </mark>
                );
              }
              return <span key={idx} className="select-text">{token.text}</span>;
            })}
          </div>

          {/* Color Legend */}
          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-cyan-200 border border-cyan-400" />
              <strong className="text-cyan-900">Procedure Tag</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-teal-200 border border-teal-400" />
              <strong className="text-teal-900">Drug Tag</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-sky-200 border border-sky-400" />
              <strong className="text-sky-900">Dose Tag</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-purple-200 border border-purple-400" />
              <strong className="text-purple-900">Route Tag</strong>
            </span>
          </div>
        </div>

        {/* 3 DISTINCT ENTITY REVIEW TILES (OR PROCEDURE TILE) */}
        <div className="space-y-4">
          {isProcedureMode ? (
            /* EMERGENCY CLINICAL PROCEDURE TILE */
            <div
              id="draft-entity-procedure"
              className="p-5 rounded-2xl border-2 border-cyan-400 bg-cyan-50/40 shadow-sm space-y-4 select-text animate-in fade-in"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-950 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-cyan-700 animate-pulse" />
                    Clinical Emergency Intervention / Procedure
                  </span>
                  <span className="bg-cyan-200 text-cyan-950 border border-cyan-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                    Procedure Mode Active
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsProcedureMode(false)}
                  className="text-xs text-slate-600 hover:text-slate-900 underline font-medium"
                >
                  Switch to Medication Mode
                </button>
              </div>

              <div className="bg-white border-2 border-cyan-300 rounded-xl p-4 shadow-sm select-text flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-cyan-600 text-white flex items-center justify-center font-black text-lg shadow-sm flex-shrink-0">
                    CPR
                  </div>
                  <div>
                    <span className="text-lg font-black text-slate-900 font-sans block leading-tight select-text">
                      {selectedProcedureName}
                    </span>
                    <span className="text-xs text-cyan-800 font-mono select-text">
                      SNOMED CT: 89666000 · Prehospital Resuscitation Protocol
                    </span>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-3 py-1 rounded-lg">
                  Action Validated · Unblocked ✓
                </span>
              </div>

              {/* One-tap Procedure Selector Chips */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-cyan-950 block">
                  Select Procedure or Intervention:
                </span>
                <div className="flex flex-wrap gap-2">
                  {COMMON_PROCEDURES.map((proc) => {
                    const isSelected = selectedProcedureName === proc;
                    return (
                      <button
                        key={proc}
                        type="button"
                        onClick={() => setSelectedProcedureName(proc)}
                        className={`px-3 py-2 text-xs font-bold rounded-xl border-2 transition-all min-h-[38px] ${
                          isSelected
                            ? 'bg-cyan-700 text-white border-cyan-700 shadow-sm'
                            : 'bg-white text-slate-800 border-slate-300 hover:border-cyan-400 hover:bg-cyan-50'
                        }`}
                      >
                        {proc}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* TILE 1: DRUG (MEDICATION) - TEAL TAG */}
              <div
                id="draft-entity-drug"
                className={`p-4 sm:p-5 rounded-2xl border-2 transition-all ${
                  missingDrug
                    ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-300/40'
                    : 'bg-teal-50/30 border-teal-300 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-teal-950 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />
                      1. Drug (Medication)
                    </span>
                    {missingDrug ? (
                      <span className="bg-amber-200 text-amber-950 border border-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                        ⚠️ Not Stated in Note
                      </span>
                    ) : (
                      <span className="bg-teal-100 text-teal-900 border border-teal-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-teal-600" />
                        AI Extracted
                      </span>
                    )}
                  </div>

                  {missingDrug ? (
                    <span className="text-xs font-bold text-amber-800">
                      Amber Warning: Paramedic Selection Mandatory
                    </span>
                  ) : (
                    <button
                      onClick={() => onSelectDrug(null)}
                      className="text-xs text-teal-700 hover:text-teal-900 font-bold underline flex items-center gap-1 min-h-[32px]"
                    >
                      <Pencil className="w-3 h-3" />
                      Change Medication
                    </button>
                  )}
                </div>

                {selectedDrug ? (
                  <div className="flex items-center justify-between bg-white border-2 border-teal-300 rounded-xl p-3.5 shadow-sm select-text">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
                        Rx
                      </div>
                      <div>
                        <span className="text-base sm:text-lg font-bold text-teal-950 font-sans block leading-tight select-text">
                          {selectedDrug}
                        </span>
                        <span className="text-xs text-teal-700 font-mono select-text">
                          RxNorm Standard Prehospital Formulation
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                      Confirmed ✓
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2 mt-2">
                    <div className="p-3 bg-amber-100/70 border border-amber-300 rounded-xl text-amber-950 text-xs font-medium flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <span>
                        No medication could be extracted from the note. Tap the medication administered:
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {COMMON_DRUGS.map((drug) => (
                        <button
                          key={drug}
                          id={`btn-select-drug-${drug.toLowerCase().replace(/\s+/g, '-')}`}
                          onClick={() => onSelectDrug(drug)}
                          className="px-3.5 py-2 text-xs font-bold rounded-xl bg-white border border-slate-300 hover:border-teal-500 hover:bg-teal-50 text-slate-800 transition-all active:scale-95 shadow-sm min-h-[40px]"
                        >
                          {drug}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* TILE 2: DOSE & UNIT - ELECTRIC BLUE / SKY TAG */}
              <div
                id="draft-entity-dose"
                className={`p-4 sm:p-5 rounded-2xl border-2 transition-all ${
                  missingDose || missingUnit
                    ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-300/40'
                    : 'bg-sky-50/30 border-sky-300 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-sky-950 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-600" />
                      2. Dose & Unit
                    </span>
                    {missingDose || missingUnit ? (
                      <span className="bg-amber-200 text-amber-950 border border-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                        ⚠️ {missingDose ? 'Dose Missing' : 'Unit Missing'}
                      </span>
                    ) : (
                      <span className="bg-sky-100 text-sky-900 border border-sky-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-sky-600" />
                        AI Extracted: {selectedDose} {selectedUnit}
                      </span>
                    )}
                  </div>

                  {(missingDose || missingUnit) && (
                    <span className="text-xs font-bold text-amber-800">
                      Amber Warning: Amount & Unit Required
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    {/* Numeric dose input */}
                    <div className="flex-1">
                      <label htmlFor="input-dose-field" className="block text-xs font-bold text-slate-700 mb-1">
                        Amount (Numeric)
                      </label>
                      <input
                        id="input-dose-field"
                        type="number"
                        step="any"
                        min="0"
                        value={selectedDose}
                        onChange={(e) => onSelectDose(e.target.value)}
                        placeholder="e.g. 2, 0.5, 500"
                        className="w-full text-base font-bold px-3.5 py-2.5 bg-white border-2 border-slate-300 focus:border-sky-500 rounded-xl focus:ring-2 focus:ring-sky-200 focus:outline-none transition-all select-text"
                      />
                    </div>

                    {/* Unit chips */}
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Unit (One-tap choice)
                      </label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {UNIT_OPTIONS.map((u) => {
                          const isSelected = selectedUnit === u;
                          return (
                            <button
                              key={u}
                              id={`unit-button-${u}`}
                              type="button"
                              onClick={() => onSelectUnit(u)}
                              className={`py-2.5 text-xs font-bold rounded-xl border-2 transition-all text-center min-h-[46px] ${
                                isSelected
                                  ? 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-600/20'
                                  : 'bg-white text-slate-700 border-slate-300 hover:bg-sky-50'
                              }`}
                            >
                              {u}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Quick Amount presets if empty or missing */}
                  {(missingDose || !selectedDose) && (
                    <div className="bg-amber-100/60 border border-amber-300 p-2.5 rounded-xl">
                      <span className="text-xs font-bold text-amber-900 block mb-1">
                        One-Tap Quick Amounts:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {['0.3', '0.5', '1', '2', '4', '5', '10', '50', '100', '500'].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => onSelectDose(val)}
                            className="px-2.5 py-1 text-xs font-bold bg-white hover:bg-sky-100 text-slate-800 hover:text-sky-900 rounded-lg border border-slate-300 shadow-sm min-h-[36px]"
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* TILE 3: ROUTE OF ADMINISTRATION - PURPLE TAG */}
              <div
                id="draft-entity-route"
                className={`p-4 sm:p-5 rounded-2xl border-2 transition-all ${
                  missingRoute
                    ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-300/40'
                    : 'bg-purple-50/30 border-purple-300 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-950 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                      3. Route of Administration
                    </span>
                    {missingRoute ? (
                      <span className="bg-amber-200 text-amber-950 border border-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                        ⚠️ Route Not Stated
                      </span>
                    ) : (
                      <span className="bg-purple-100 text-purple-900 border border-purple-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-purple-600" />
                        AI Extracted: {selectedRoute}
                      </span>
                    )}
                  </div>

                  {missingRoute && (
                    <span className="text-xs font-bold text-amber-800">
                      Amber Warning: Select Administration Route
                    </span>
                  )}
                </div>

                {missingRoute && (
                  <div className="p-3 mb-2.5 bg-amber-100/70 border border-amber-300 rounded-xl text-amber-950 text-xs font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>
                      Route was not identified in the clinical dictation. Active paramedic choice is mandatory:
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {ROUTE_OPTIONS.map((route) => {
                    const isSelected = selectedRoute === route;
                    return (
                      <button
                        key={route}
                        id={`route-chip-${route.toLowerCase().replace(/\s+/g, '-')}`}
                        type="button"
                        onClick={() => onSelectRoute(route)}
                        className={`p-3 text-xs sm:text-sm font-bold rounded-xl border-2 transition-all min-h-[48px] flex items-center justify-center text-center ${
                          isSelected
                            ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/25 ring-2 ring-purple-300'
                            : 'bg-white text-slate-800 border-slate-300 hover:border-purple-400 hover:bg-purple-50/50'
                        }`}
                      >
                        {route}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* TILE 4: CLINICAL INDICATION / REASON */}
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/90 bg-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                4. Clinical Indication / Reason
              </span>
              {selectedReason && (
                <span className="text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
                  Extracted: {selectedReason}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {REASON_OPTIONS.map((reason) => {
                const isSelected = selectedReason === reason;
                return (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => onSelectReason(reason)}
                    className={`p-2.5 text-xs font-semibold rounded-xl border capitalize transition-all min-h-[44px] flex items-center justify-center text-center ${
                      isSelected
                        ? 'bg-teal-700 text-white border-teal-700 shadow-sm'
                        : 'bg-white text-slate-800 border-slate-300 hover:bg-teal-50/50'
                    }`}
                  >
                    {reason}
                  </button>
                );
              })}
            </div>
          </div>

          {/* TILE 5: ADMINISTRATION TIME */}
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/90 bg-white select-text">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-teal-600" />
                5. Administration Timestamp
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {extracted.timeType === 'just_now' && 'Detected: "just now"'}
                {extracted.timeType === 'relative' && 'Relative time parsed'}
                {extracted.timeType === 'explicit' && 'Clock time parsed'}
                {extracted.timeType === 'default_now' && 'Current scene time'}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 rounded-lg p-3 border border-slate-200 select-text">
              <div className="text-sm font-semibold text-slate-900 select-text">
                {formatTimeHHMM(administeredTime)} ·{' '}
                <span className="font-mono text-xs text-slate-500 select-text">{administeredTime}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSetAdministeredTime(new Date().toISOString())}
                  className="px-2.5 py-1 text-xs bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-300 font-medium min-h-[36px]"
                >
                  Set to Now
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(Date.now() - 5 * 60000);
                    onSetAdministeredTime(d.toISOString());
                  }}
                  className="px-2.5 py-1 text-xs bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-300 font-medium min-h-[36px]"
                >
                  -5 min
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* CLINICAL SAFETY WARNINGS (OVERDOSE / DUPLICATE ALERT) */}
        {safetyWarnings.length > 0 && (
          <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 sm:p-5 space-y-3 animate-in fade-in select-text">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-6 h-6 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-bold text-rose-950 uppercase tracking-wide">
                  Clinical Safety Warning Detected
                </h4>
                <div className="space-y-1 mt-1.5 text-xs text-rose-900">
                  {safetyWarnings.map((warn, i) => (
                    <p key={i} className="font-semibold select-text">
                      • {warn}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-rose-200 flex items-center gap-3">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  id="checkbox-safety-acknowledge"
                  type="checkbox"
                  checked={safetyAcknowledged}
                  onChange={(e) => onToggleSafetyAcknowledge(e.target.checked)}
                  className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                />
                <span className="text-xs font-bold text-rose-950">
                  I acknowledge this clinical safety warning and confirm medical order.
                </span>
              </label>
            </div>
          </div>
        )}

        {/* OVERALL AMBER WARNING BANNER (IF FIELDS MISSING - HIDDEN IN PROCEDURE MODE) */}
        {hasMissingFields && !isProcedureMode && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-center gap-3 shadow-sm animate-pulse select-text">
            <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-950">
                Amber Clinical Warning: Draft Order Incomplete
              </h4>
              <p className="text-xs text-amber-800 mt-0.5 select-text">
                The following required field{missingFieldsList.length > 1 ? 's are' : ' is'} missing:{' '}
                <strong className="underline select-text">{missingFieldsList.join(', ')}</strong>. Tap the choices above to resolve before confirming.
              </p>
            </div>
          </div>
        )}

        {/* CLOSED-LOOP VALIDATION ACTION FOOTER: LARGE HIGH-CONTRAST "CONFIRM MEDICATION" / "CONFIRM PROCEDURE" BUTTON */}
        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="space-y-1">
            {isProcedureMode ? (
              <p className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Procedure Mode active: Ready to verify. Clinical Record will be generated.</span>
              </p>
            ) : !hasMissingFields && !hasUnacknowledgedWarning ? (
              <p className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Ready to verify: All fields validated. Clinical Record will be generated.</span>
              </p>
            ) : hasUnacknowledgedWarning ? (
              <p className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Acknowledge safety alert above before confirming order.</span>
              </p>
            ) : (
              <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Resolve amber warnings above to enable confirmation.</span>
              </p>
            )}
            <p className="text-xs text-slate-500">
              Secure clinical timeline preserved.
            </p>
          </div>

          {/* LARGE, HIGH-CONTRAST CONFIRM BUTTON (SWITCHES DYNAMICALLY TO 'CONFIRM PROCEDURE' WHEN IN PROCEDURE MODE) */}
          <button
            id="btn-confirm-medication"
            onClick={() => {
              if (isProcedureMode) {
                onConfirmMedication({
                  isProcedure: true,
                  procedureName: selectedProcedureName,
                });
              } else {
                onConfirmMedication();
              }
            }}
            disabled={!canConfirm}
            className={`min-h-[58px] px-8 py-4 rounded-2xl font-bold text-base uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-3 ${
              canConfirm
                ? 'bg-teal-700 hover:bg-teal-600 text-white shadow-teal-900/30 ring-4 ring-teal-400/40 cursor-pointer active:scale-95'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed border-2 border-slate-300 shadow-none'
            }`}
          >
            <ShieldCheck className="w-6 h-6" />
            <span>
              {isSealing
                ? isProcedureMode ? 'Confirming Procedure...' : 'Generating FHIR & Confirming...'
                : isProcedureMode
                ? 'CONFIRM PROCEDURE'
                : hasMissingFields
                ? `Confirm Medication (${missingFieldsList.join(', ')} Missing)`
                : 'Confirm Medication'}
            </span>
            {canConfirm && <ArrowRight className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </section>
  );
};
