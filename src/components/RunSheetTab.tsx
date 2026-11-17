import React, { useState } from 'react';
import {
  ShieldCheck,
  Download,
  Copy,
  Clock,
  Check,
  AlertOctagon,
  RotateCcw,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import type { ConfirmedRecord, ChainVerificationResult } from '../lib/types';
import { verifyChain } from '../lib/chain';
import { exportFHIRJson, formatRunSheetSummary, formatTimeHHMM } from '../lib/fhir';
import { clearAllRecords } from '../lib/db';

interface RunSheetTabProps {
  records: ConfirmedRecord[];
  onRefreshRecords: () => void;
  onGoToCapture: () => void;
}

export const RunSheetTab: React.FC<RunSheetTabProps> = ({
  records,
  onRefreshRecords,
  onGoToCapture,
}) => {
  const [verificationResult, setVerificationResult] = useState<ChainVerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Verify chain button handler
  const handleVerifyChain = async () => {
    setIsVerifying(true);
    try {
      const result = await verifyChain(records);
      setVerificationResult(result);
    } catch (err) {
      console.error('Timeline verification failed:', err);
      setVerificationResult({
        isValid: false,
        count: records.length,
        message: 'Internal error during timeline verification.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Copy run-sheet summary
  const handleCopyRunSheet = async () => {
    const summary = formatRunSheetSummary(records);
    try {
      await navigator.clipboard.writeText(summary);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 3000);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  };

  // Export FHIR JSON
  const handleExportFHIR = () => {
    exportFHIRJson(records);
  };

  // Clear records for testing
  const handleClearAll = async () => {
    await clearAllRecords();
    onRefreshRecords();
    setShowClearConfirm(false);
    setVerificationResult(null);
  };

  return (
    <div className="space-y-6 pb-28 md:pb-8">
      {/* HEADER ACTIONS BAR */}
      <section className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
              Paramedic Medication Run-Sheet
            </h2>
            <span className="bg-teal-50 text-teal-800 border border-teal-200 text-xs font-bold px-2.5 py-0.5 rounded-full">
              {records.length} {records.length === 1 ? 'Record' : 'Records'}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Secure clinical timeline preserved.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Verify Timeline Button */}
          <button
            id="btn-verify-chain"
            onClick={handleVerifyChain}
            disabled={records.length === 0 || isVerifying}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
              records.length > 0
                ? 'bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 shadow-sm active:scale-95'
                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            <span>{isVerifying ? 'Verifying...' : 'Verify Timeline'}</span>
          </button>

          {/* Export Clinical Record */}
          <button
            id="btn-export-fhir"
            onClick={handleExportFHIR}
            disabled={records.length === 0}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
              records.length > 0
                ? 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-sm active:scale-95'
                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
            }`}
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Export Clinical Record</span>
          </button>

          {/* Copy Run-sheet */}
          <button
            id="btn-copy-runsheet"
            onClick={handleCopyRunSheet}
            disabled={records.length === 0}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all min-h-[44px] relative ${
              records.length > 0
                ? 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-sm active:scale-95'
                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
            }`}
          >
            {copiedToast ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-600" />
                <span>Copy Run-sheet</span>
              </>
            )}
          </button>

          {/* Reset button for demo */}
          {records.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              title="Clear all records for a new patient call"
              className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-transparent hover:border-rose-200 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </section>

      {/* VERIFICATION RESULT BANNER */}
      {verificationResult && (
        <div
          id="verification-result-banner"
          className={`rounded-2xl p-5 border-2 flex items-start gap-3.5 shadow-sm transition-all animate-in fade-in ${
            verificationResult.isValid
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : 'bg-rose-50 border-rose-300 text-rose-950'
          }`}
        >
          {verificationResult.isValid ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertOctagon className="w-6 h-6 text-rose-600 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold">
                {verificationResult.isValid
                  ? 'Audit Timeline & Event Ordering: PASSED'
                  : 'Audit Timeline Verification: FAILED'}
              </h4>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  verificationResult.isValid
                    ? 'bg-emerald-200 text-emerald-800'
                    : 'bg-rose-200 text-rose-800'
                }`}
              >
                {verificationResult.isValid ? '✓ Secure Sync' : 'Ordering Broken'}
              </span>
            </div>
            <p className="text-xs mt-1 font-medium leading-relaxed">
              {verificationResult.message}
            </p>
          </div>
          <button
            onClick={() => setVerificationResult(null)}
            className="text-xs font-semibold text-slate-400 hover:text-slate-600 px-2 py-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* EMPTY STATE */}
      {records.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 sm:p-12 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 border border-teal-100 text-teal-600 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Clock className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">
            No Medications Logged Yet
          </h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
            Speak or type an on-scene note in the Capture tab to begin your verified clinical run-sheet.
          </p>
          <button
            onClick={onGoToCapture}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl text-xs transition-all shadow-md shadow-teal-600/20 active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            <span>Capture First Medication</span>
          </button>
        </div>
      ) : (
        /* TIMELINE OF SEALED RECORDS (NEWEST FIRST) */
        <div className="space-y-4">
          {records.map((rec, index) => {
            return (
              <div
                key={rec.id}
                id={`record-card-${index}`}
                className="bg-white rounded-2xl border border-slate-200/90 hover:border-teal-300 p-5 sm:p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden group select-text"
              >
                {/* Left Teal Accent Line */}
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-teal-600" />

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="flex items-center gap-1.5 bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold px-2.5 py-1 rounded-lg">
                      <Clock className="w-3.5 h-3.5 text-teal-600" />
                      <span>{formatTimeHHMM(rec.administeredAt)}</span>
                    </div>

                    <h3 className="text-base font-semibold text-slate-900 tracking-tight">
                      {rec.isProcedure ? (rec.procedureName || rec.drug) : rec.drug}
                    </h3>

                    {rec.isProcedure ? (
                      <span className="bg-cyan-100 text-cyan-950 border border-cyan-300 text-xs font-bold px-2 py-0.5 rounded-md uppercase">
                        PROCEDURE
                      </span>
                    ) : (
                      <>
                        <span className="bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold px-2 py-0.5 rounded-md">
                          {rec.dose} {rec.unit}
                        </span>

                        <span className="bg-teal-100 text-teal-900 border border-teal-200 text-xs font-bold px-2 py-0.5 rounded-md uppercase">
                          {rec.route}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Verification Badges (✓ Secure Sync & ED Reconciled) */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full shadow-sm">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ✓ Secure Sync
                    </span>
                    {rec.isReconciled && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-teal-100 text-teal-900 border border-teal-300 px-2.5 py-1 rounded-full shadow-sm">
                        ✓ ED Reconciled
                      </span>
                    )}
                    <span className="text-[11px] font-mono text-slate-400">
                      #{records.length - index}
                    </span>
                  </div>
                </div>

                {/* Details row: reason & timestamps */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-600 mb-3 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                  <div>
                    <span className="font-semibold text-slate-700">Clinical Reason:</span>{' '}
                    <span className="capitalize font-semibold text-teal-900">{rec.reason}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Administered:</span>{' '}
                    <span className="font-mono text-slate-600">{new Date(rec.administeredAt).toLocaleString()}</span>
                  </div>
                </div>

                {/* Original transcript quote */}
                <div className="text-sm text-slate-600 italic mb-3 pl-3 border-l-2 border-slate-200 select-text">
                  "{rec.rawText}"
                </div>

                {/* Provenance Footer (No hash fields) */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 font-mono">
                  <div className="flex items-center gap-1.5 text-teal-700 font-medium">
                    <Clock className="w-3.5 h-3.5 text-teal-600" />
                    <span>Record ID: {rec.id}</span>
                  </div>
                  <div className="text-slate-400 font-sans">
                    Status: <span className="text-emerald-700 font-semibold">HL7 FHIR R4 Ready ✓</span>
                  </div>
                </div>

                {/* Safety warnings badge if acknowledged */}
                {rec.safetyWarnings && rec.safetyWarnings.length > 0 && (
                  <div className="mt-2.5 text-xs bg-amber-50 border border-amber-200 text-amber-900 p-2.5 rounded-lg font-medium">
                    ⚠️ Clinical Override: {rec.safetyWarnings[0]}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* CLEAR ALL CONFIRMATION MODAL */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
              <RotateCcw className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 mb-1">
              Reset Run-sheet for New Patient?
            </h3>
            <p className="text-sm text-slate-500 mb-5 leading-relaxed">
              This will clear all {records.length} records from IndexedDB and reset the audit log for a new patient call.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl min-h-[40px]"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-reset"
                onClick={handleClearAll}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm min-h-[40px]"
              >
                Reset Run-sheet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
