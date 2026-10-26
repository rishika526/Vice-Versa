import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Pencil,
  Info,
} from 'lucide-react';
import { extractNote } from '../lib/extract';
import type { ExtractedRecord, ConfirmedRecord, MedRoute, MedReason, MedUnit } from '../lib/types';
import { checkSafety } from '../lib/safety';
import { calculateRecordHash } from '../lib/chain';
import { saveRecord, getNextPreviousHash, getAllRecords } from '../lib/db';
import { formatTimeHHMM } from '../lib/fhir';

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

const EXAMPLE_NOTES = [
  {
    title: 'Complete Record',
    badge: 'Complete',
    text: 'Gave two milligrams midazolam IV push just now for active seizure',
  },
  {
    title: 'Missing Route',
    badge: 'Needs Route',
    text: 'Gave 0.5 milligrams epinephrine for anaphylaxis',
  },
  {
    title: 'Missing Dose & Unit',
    badge: 'Needs Dose',
    text: 'Gave midazolam IV for seizure five minutes ago',
  },
  {
    title: 'Missing Dose (Explicit Time)',
    badge: 'Needs Dose',
    text: 'Gave morphine IM at 1:44 for pain',
  },
];

interface CaptureTabProps {
  onRecordSealed: (record: ConfirmedRecord) => void;
}

export const CaptureTab: React.FC<CaptureTabProps> = ({ onRecordSealed }) => {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);

  // Extracted record state
  const [extracted, setExtracted] = useState<ExtractedRecord | null>(null);

  // User-confirmed / modified fields
  const [selectedDrug, setSelectedDrug] = useState<string | null>(null);
  const [selectedDose, setSelectedDose] = useState<string>('');
  const [selectedUnit, setSelectedUnit] = useState<MedUnit | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<MedRoute | null>(null);
  const [selectedReason, setSelectedReason] = useState<MedReason | null>(null);
  const [administeredTime, setAdministeredTime] = useState<string>('');

  // Safety & override
  const [safetyWarnings, setSafetyWarnings] = useState<string[]>([]);
  const [safetyAcknowledged, setSafetyAcknowledged] = useState(false);

  // Sealing state
  const [isSealing, setIsSealing] = useState(false);
  const [sealedSuccess, setSealedSuccess] = useState<ConfirmedRecord | null>(null);

  // Web Speech recognition reference
  const recognitionRef = useRef<any>(null);

  // Check speech recognition support
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSpeechSupported(false);
      setSpeechError("Voice isn't available right now, type your note instead");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setInputText(currentTranscript);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'network' || event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setSpeechError("Voice isn't available right now, type your note instead");
        } else if (event.error !== 'no-speech') {
          setSpeechError(`Voice notice: ${event.error}. You can type your note instead.`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } catch (err) {
      console.warn('Speech recognition initialization error:', err);
      setIsSpeechSupported(false);
      setSpeechError("Voice isn't available right now, type your note instead");
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setSpeechError("Voice isn't available right now, type your note instead");
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    } else {
      setSpeechError(null);
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.warn('Start voice error:', err);
        setSpeechError("Voice isn't available right now, type your note instead");
        setIsListening(false);
      }
    }
  };

  // Process typed or dictated note through local rule extractor
  const handleProcessNote = async (textToProcess?: string) => {
    const text = (textToProcess !== undefined ? textToProcess : inputText).trim();
    if (!text) return;

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    }

    const result = extractNote(text, new Date());
    setExtracted(result);
    setSealedSuccess(null);

    // Populate confirmed state with whatever was successfully extracted
    setSelectedDrug(result.drug);
    setSelectedDose(result.dose !== null ? String(result.dose) : '');
    setSelectedUnit(result.unit);
    setSelectedRoute(result.route);
    setSelectedReason(result.reason);
    setAdministeredTime(result.administeredAt);
    setSafetyAcknowledged(false);

    // Run safety checks if drug and dose are ready
    if (result.drug && result.dose !== null && result.unit) {
      const records = await getAllRecords();
      const check = checkSafety(result.drug, result.dose, result.unit, records, new Date(result.administeredAt));
      setSafetyWarnings(check.warnings);
    } else {
      setSafetyWarnings([]);
    }
  };

  // Re-check safety whenever drug, dose, or unit changes
  useEffect(() => {
    if (!selectedDrug || !selectedDose || !selectedUnit) {
      setSafetyWarnings([]);
      return;
    }

    const numDose = parseFloat(selectedDose);
    if (isNaN(numDose) || numDose <= 0) {
      setSafetyWarnings([]);
      return;
    }

    let isMounted = true;
    getAllRecords().then((records) => {
      if (!isMounted) return;
      const adminDate = administeredTime ? new Date(administeredTime) : new Date();
      const check = checkSafety(selectedDrug, numDose, selectedUnit, records, adminDate);
      setSafetyWarnings(check.warnings);
    });

    return () => {
      isMounted = false;
    };
  }, [selectedDrug, selectedDose, selectedUnit, administeredTime]);

  // Determine missing fields
  const missingDrug = !selectedDrug;
  const numDose = parseFloat(selectedDose);
  const missingDose = isNaN(numDose) || numDose <= 0;
  const missingUnit = !selectedUnit;
  const missingRoute = !selectedRoute;
  const missingReason = !selectedReason;

  const missingFieldsList: string[] = [];
  if (missingDrug) missingFieldsList.push('Medication');
  if (missingDose) missingFieldsList.push('Dose');
  if (missingUnit) missingFieldsList.push('Unit');
  if (missingRoute) missingFieldsList.push('Route');
  if (missingReason) missingFieldsList.push('Indication');

  const hasMissingFields = missingFieldsList.length > 0;
  const hasUnacknowledgedWarning = safetyWarnings.length > 0 && !safetyAcknowledged;
  const canSeal = !hasMissingFields && !hasUnacknowledgedWarning && !isSealing;

  // Seal Record to IndexedDB with SHA-256 hash chain
  const handleSealRecord = async () => {
    if (!canSeal || !selectedDrug || !selectedUnit || !selectedRoute || !selectedReason) return;

    setIsSealing(true);
    try {
      const prevHash = await getNextPreviousHash();
      const now = new Date();
      const recordId = `rec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const timestamp = now.getTime();

      const baseRecord = {
        id: recordId,
        drug: selectedDrug,
        dose: parseFloat(selectedDose),
        unit: selectedUnit,
        route: selectedRoute,
        reason: selectedReason,
        administeredAt: administeredTime || now.toISOString(),
        capturedAt: extracted ? extracted.capturedAt : now.toISOString(),
        rawText: extracted ? extracted.rawText : inputText,
        previousHash: prevHash,
      };

      const hash = await calculateRecordHash(baseRecord);

      const sealedRecord: ConfirmedRecord = {
        ...baseRecord,
        hash,
        timestamp,
        safetyWarnings,
        safetyAcknowledged,
      };

      await saveRecord(sealedRecord);
      onRecordSealed(sealedRecord);

      // Show success state
      setSealedSuccess(sealedRecord);
      setExtracted(null);
      setInputText('');
    } catch (err) {
      console.error('Failed to seal record:', err);
      alert('Error sealing record to local IndexedDB. Check console for details.');
    } finally {
      setIsSealing(false);
    }
  };

  const handleStartNextRecord = () => {
    setSealedSuccess(null);
    setExtracted(null);
    setInputText('');
    setSelectedDrug(null);
    setSelectedDose('');
    setSelectedUnit(null);
    setSelectedRoute(null);
    setSelectedReason(null);
    setSafetyWarnings([]);
    setSafetyAcknowledged(false);
  };

  return (
    <div className="space-y-6 pb-24 md:pb-8">
      {/* SUCCESS STATE CARD */}
      {sealedSuccess && (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-6 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-700/20">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-bold text-emerald-950">
                  Record Sealed & Cryptographically Linked
                </h3>
                <span className="bg-emerald-200 text-emerald-900 text-xs font-semibold px-2 py-0.5 rounded-full">
                  SHA-256 Intact
                </span>
              </div>
              <p className="text-emerald-800 text-sm mb-3">
                Successfully recorded to local IndexedDB and tamper-evident audit chain.
              </p>

              {/* Formatted run-sheet entry preview */}
              <div className="bg-white/90 border border-emerald-200 rounded-xl p-3.5 mb-4 text-slate-800 font-mono text-xs shadow-inner">
                <div className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-teal-600" />
                  {formatTimeHHMM(sealedSuccess.administeredAt)} · {sealedSuccess.drug} {sealedSuccess.dose} {sealedSuccess.unit} {sealedSuccess.route}
                </div>
                <div className="text-slate-600">
                  Indication: <span className="font-sans font-medium text-slate-800">{sealedSuccess.reason}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1 truncate">
                  Hash: <span className="text-teal-700 font-bold">{sealedSuccess.hash.slice(0, 16)}...</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  id="btn-log-another"
                  onClick={handleStartNextRecord}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl text-sm transition-all shadow-md shadow-teal-600/20 active:scale-95"
                >
                  <Sparkles className="w-4 h-4" />
                  Log Next Medication
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INPUT SECTION: BIG MIC + TYPED BOX */}
      <section className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-center gap-6">
          {/* Big Glove-Friendly Mic Button (84px diameter) */}
          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            <div className="relative flex items-center justify-center">
              {/* Outer pulsing ring while listening */}
              {isListening && (
                <div className="absolute w-24 h-24 rounded-full bg-teal-500/30 animate-mic-pulse pointer-events-none" />
              )}
              <button
                id="mic-button"
                onClick={toggleListening}
                aria-label={isListening ? 'Stop recording voice note' : 'Start recording voice note'}
                className={`relative w-20 h-20 sm:w-22 sm:h-22 rounded-full flex flex-col items-center justify-center transition-all shadow-lg active:scale-95 select-none ${
                  isListening
                    ? 'bg-rose-600 text-white shadow-rose-600/30 ring-4 ring-rose-200'
                    : 'bg-gradient-to-tr from-teal-700 to-teal-500 text-white hover:from-teal-800 hover:to-teal-600 shadow-teal-700/25'
                }`}
              >
                {isListening ? (
                  <MicOff className="w-9 h-9 animate-bounce" />
                ) : (
                  <Mic className="w-9 h-9" />
                )}
              </button>
            </div>
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              {isListening ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  <span className="text-rose-600 font-bold">Listening on-scene...</span>
                </>
              ) : (
                isSpeechSupported ? 'Tap to Speak (72px+)' : 'Voice Unavailable'
              )}
            </span>
          </div>

          {/* Transcript / Typed Fallback Textbox */}
          <div className="flex-1 w-full space-y-3">
            <div className="relative">
              <label htmlFor="scene-note-input" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>On-Scene Voice / Typed Medication Note</span>
                {inputText.length > 0 && (
                  <button
                    onClick={() => setInputText('')}
                    className="text-[11px] text-slate-400 hover:text-slate-600 font-normal underline"
                  >
                    Clear text
                  </button>
                )}
              </label>
              <textarea
                id="scene-note-input"
                rows={3}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder='Speak into mic or type e.g. "Gave two milligrams midazolam IV push just now for active seizure"'
                className="w-full text-slate-900 bg-slate-50/80 border border-slate-300 rounded-xl p-3.5 text-sm sm:text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all placeholder:text-slate-400 font-medium"
              />
            </div>

            {/* Inline Voice Error / Fallback Notice */}
            {speechError && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>{speechError}</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-xs text-slate-500">
                Rule-based local parser · 100% offline
              </span>
              <button
                id="btn-process-note"
                onClick={() => handleProcessNote()}
                disabled={!inputText.trim()}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm ${
                  inputText.trim()
                    ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/20 active:scale-95'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <span>Process Note</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* DEMO / EXAMPLE CHIPS */}
        <div className="mt-6 pt-5 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase tracking-wider mb-2.5">
            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            <span>Try an Example Note (One-Tap Demo)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {EXAMPLE_NOTES.map((ex, index) => (
              <button
                key={index}
                id={`example-chip-${index}`}
                onClick={() => {
                  setInputText(ex.text);
                  handleProcessNote(ex.text);
                }}
                className="flex items-start justify-between gap-2 p-3 text-left rounded-xl bg-slate-50 hover:bg-teal-50/70 border border-slate-200 hover:border-teal-300 transition-all group active:scale-[0.99]"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs font-bold text-slate-800 group-hover:text-teal-900">
                      {ex.title}
                    </span>
                    <span className="text-[10px] font-semibold bg-white border border-slate-200 px-1.5 py-0.2 rounded text-slate-600">
                      {ex.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 italic line-clamp-1 group-hover:text-slate-700">
                    "{ex.text}"
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 flex-shrink-0 mt-1 transition-transform group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* STRUCTURED RESULT CARD & MISSING-DATA FLOW */}
      {extracted && (
        <section
          id="structured-review-card"
          className="bg-white rounded-2xl border-2 border-slate-200/90 shadow-sm overflow-hidden animate-in fade-in duration-200"
        >
          {/* Card Header with Status */}
          <div className="bg-slate-50/80 px-5 sm:px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Structured Record Review</span>
                <span className="text-xs font-normal text-slate-500">
                  (Capture Timestamp: {formatTimeHHMM(extracted.capturedAt)})
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Verify extracted values. Active paramedic confirmation is mandatory for all empty or ambiguous fields.
              </p>
            </div>

            {hasMissingFields ? (
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-300 text-amber-800 text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>{missingFieldsList.length} field{missingFieldsList.length > 1 ? 's' : ''} still need confirmation</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>All required fields confirmed</span>
              </div>
            )}
          </div>

          <div className="p-5 sm:p-6 space-y-6">
            {/* Original transcript snippet */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-slate-600">
                <span className="font-bold text-slate-700">Raw Note:</span> "{extracted.rawText}"
              </div>
            </div>

            {/* FIELD 1: MEDICATION (DRUG) */}
            <div className={`p-4 rounded-xl border transition-all ${
              missingDrug
                ? 'bg-amber-50/60 border-amber-300 ring-1 ring-amber-300/50'
                : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    1. Medication (Drug)
                  </span>
                  {missingDrug ? (
                    <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Not stated
                    </span>
                  ) : (
                    <span className="bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-teal-600" />
                      Extracted
                    </span>
                  )}
                </div>
                {missingDrug && (
                  <span className="text-xs font-semibold text-amber-700">
                    Needs your confirmation
                  </span>
                )}
              </div>

              {selectedDrug ? (
                <div className="flex items-center justify-between bg-teal-50/50 border border-teal-200 rounded-lg p-3">
                  <span className="text-base font-bold text-teal-950 font-sans">
                    {selectedDrug}
                  </span>
                  <button
                    onClick={() => setSelectedDrug(null)}
                    className="text-xs text-teal-700 hover:text-teal-900 font-semibold underline flex items-center gap-1"
                  >
                    <Pencil className="w-3 h-3" />
                    Change
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-amber-800 mb-2">
                    Select the medication administered:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_DRUGS.map((drug) => (
                      <button
                        key={drug}
                        onClick={() => setSelectedDrug(drug)}
                        className="px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-300 hover:border-teal-500 hover:bg-teal-50 text-slate-800 transition-all active:scale-95 shadow-sm min-h-[38px]"
                      >
                        {drug}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* FIELD 2: DOSE & UNIT */}
            <div className={`p-4 rounded-xl border transition-all ${
              missingDose || missingUnit
                ? 'bg-amber-50/60 border-amber-300 ring-1 ring-amber-300/50'
                : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    2. Dose & Unit
                  </span>
                  {missingDose || missingUnit ? (
                    <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Not stated
                    </span>
                  ) : (
                    <span className="bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-teal-600" />
                      Extracted
                    </span>
                  )}
                </div>
                {(missingDose || missingUnit) && (
                  <span className="text-xs font-semibold text-amber-700">
                    Needs your confirmation
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  {/* Dose input */}
                  <div className="flex-1">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Amount (Numeric)
                    </label>
                    <input
                      id="input-confirm-dose"
                      type="number"
                      step="any"
                      min="0"
                      value={selectedDose}
                      onChange={(e) => setSelectedDose(e.target.value)}
                      placeholder="e.g. 2, 0.5, 500"
                      className="w-full text-base font-semibold px-3 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                  </div>

                  {/* Unit chips */}
                  <div className="flex-1">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Unit (One-tap choice)
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {UNIT_OPTIONS.map((u) => (
                        <button
                          key={u}
                          id={`unit-chip-${u}`}
                          type="button"
                          onClick={() => setSelectedUnit(u)}
                          className={`py-2.5 text-xs font-bold rounded-lg border transition-all text-center min-h-[44px] ${
                            selectedUnit === u
                              ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Quick Dose Presets */}
                {(missingDose || !selectedDose) && (
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 mr-2">
                      Common Amounts:
                    </span>
                    <div className="inline-flex flex-wrap gap-1.5 mt-1">
                      {['0.3', '0.5', '1', '2', '4', '5', '10', '50', '100', '500'].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setSelectedDose(val)}
                          className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-teal-100 text-slate-700 hover:text-teal-900 rounded font-medium border border-slate-200"
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* FIELD 3: ROUTE OF ADMINISTRATION */}
            <div className={`p-4 rounded-xl border transition-all ${
              missingRoute
                ? 'bg-amber-50/60 border-amber-300 ring-1 ring-amber-300/50'
                : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    3. Route
                  </span>
                  {missingRoute ? (
                    <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Not stated
                    </span>
                  ) : (
                    <span className="bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-teal-600" />
                      Extracted: {selectedRoute}
                    </span>
                  )}
                </div>
                {missingRoute && (
                  <span className="text-xs font-semibold text-amber-700">
                    Needs your confirmation
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {ROUTE_OPTIONS.map((route) => {
                  const isSelected = selectedRoute === route;
                  return (
                    <button
                      key={route}
                      id={`route-chip-${route.toLowerCase().replace(/\s+/g, '-')}`}
                      type="button"
                      onClick={() => setSelectedRoute(route)}
                      className={`p-3 text-xs sm:text-sm font-bold rounded-xl border transition-all min-h-[48px] flex items-center justify-center text-center ${
                        isSelected
                          ? 'bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-600/20 ring-2 ring-teal-300'
                          : 'bg-white text-slate-800 border-slate-300 hover:border-teal-400 hover:bg-teal-50/40'
                      }`}
                    >
                      {route}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* FIELD 4: CLINICAL INDICATION / REASON */}
            <div className={`p-4 rounded-xl border transition-all ${
              missingReason
                ? 'bg-amber-50/60 border-amber-300 ring-1 ring-amber-300/50'
                : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    4. Indication / Clinical Reason
                  </span>
                  {missingReason ? (
                    <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Not stated
                    </span>
                  ) : (
                    <span className="bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-teal-600" />
                      Extracted: {selectedReason}
                    </span>
                  )}
                </div>
                {missingReason && (
                  <span className="text-xs font-semibold text-amber-700">
                    Needs your confirmation
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {REASON_OPTIONS.map((reason) => {
                  const isSelected = selectedReason === reason;
                  return (
                    <button
                      key={reason}
                      id={`reason-chip-${reason.replace(/\s+/g, '-')}`}
                      type="button"
                      onClick={() => setSelectedReason(reason)}
                      className={`p-2.5 text-xs font-semibold rounded-xl border capitalize transition-all min-h-[46px] flex items-center justify-center text-center ${
                        isSelected
                          ? 'bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-600/20 ring-2 ring-teal-300'
                          : 'bg-white text-slate-800 border-slate-300 hover:border-teal-400 hover:bg-teal-50/40'
                      }`}
                    >
                      {reason}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* FIELD 5: ADMINISTRATION TIMESTAMP */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-teal-600" />
                  5. Time of Administration
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {extracted.timeType === 'just_now' && 'Detected: "just now"'}
                  {extracted.timeType === 'relative' && 'Relative time parsed'}
                  {extracted.timeType === 'explicit' && 'Clock time parsed'}
                  {extracted.timeType === 'default_now' && 'Current scene time'}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 rounded-lg p-3 border border-slate-200">
                <div className="text-sm font-semibold text-slate-900">
                  {formatTimeHHMM(administeredTime)} · <span className="font-mono text-xs text-slate-500">{administeredTime}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAdministeredTime(new Date().toISOString())}
                    className="px-2.5 py-1 text-xs bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-300 font-medium"
                  >
                    Set to Now
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(Date.now() - 5 * 60000);
                      setAdministeredTime(d.toISOString());
                    }}
                    className="px-2.5 py-1 text-xs bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-300 font-medium"
                  >
                    -5 min
                  </button>
                </div>
              </div>
            </div>

            {/* SAFETY CHECK WARNING BANNER */}
            {safetyWarnings.length > 0 && (
              <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-rose-950">
                      Clinical Safety Warning Detected
                    </h4>
                    <div className="space-y-1 mt-1 text-xs text-rose-800">
                      {safetyWarnings.map((warn, i) => (
                        <p key={i} className="font-medium">
                          • {warn}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-rose-200/80 flex items-center gap-3">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      id="checkbox-safety-acknowledge"
                      type="checkbox"
                      checked={safetyAcknowledged}
                      onChange={(e) => setSafetyAcknowledged(e.target.checked)}
                      className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                    />
                    <span className="text-xs font-bold text-slate-800">
                      I acknowledge this safety alert and confirm prehospital medical order.
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* SEAL RECORD BUTTON & VALIDATION STATUS */}
            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div>
                {hasMissingFields ? (
                  <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>
                      {missingFieldsList.length} field{missingFieldsList.length > 1 ? 's' : ''} still need your input ({missingFieldsList.join(', ')})
                    </span>
                  </p>
                ) : hasUnacknowledgedWarning ? (
                  <p className="text-xs font-semibold text-rose-700 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Safety alert must be acknowledged before sealing</span>
                  </p>
                ) : (
                  <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Ready to seal: SHA-256 hash will be generated & chained</span>
                  </p>
                )}
              </div>

              <button
                id="btn-seal-record"
                onClick={handleSealRecord}
                disabled={!canSeal}
                className={`min-h-[52px] px-8 py-3.5 rounded-xl font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 ${
                  canSeal
                    ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-700/25 active:scale-95 cursor-pointer ring-2 ring-teal-400/50'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                }`}
              >
                <ShieldCheck className="w-5 h-5" />
                <span>{isSealing ? 'Computing Hash & Sealing...' : 'Seal Record'}</span>
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
