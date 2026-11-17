import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  AlertCircle,
  Cpu,
  Radio,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { extractMedicationNER, initNERPipeline, subscribeNERStatus, type NERModelStatus } from '../lib/ner';
import type { ExtractedNERResult, ConfirmedRecord, MedRoute, MedReason, MedUnit } from '../lib/types';
import { checkSafety } from '../lib/safety';
import { calculateRecordHash } from '../lib/chain';
import { saveRecord, getNextPreviousHash, getAllRecords } from '../lib/db';
import { formatTimeHHMM, buildFHIRMedicationAdministration } from '../lib/fhir';
import { DraftClinicalNoteCard } from './DraftClinicalNoteCard';

const EXAMPLE_NOTES = [
  {
    title: 'Emergency Procedure',
    badge: 'Procedure Mode',
    text: 'Started CPR and chest compressions immediately',
  },
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
  onNavigateToHospital?: () => void;
  onNavigateToRunSheet?: () => void;
}

export const CaptureTab: React.FC<CaptureTabProps> = ({
  onRecordSealed,
  onNavigateToHospital,
  onNavigateToRunSheet,
}) => {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);

  // In-Browser Edge AI NER Model status
  const [nerStatus, setNerStatus] = useState<NERModelStatus>('idle');
  const [nerProgress, setNerProgress] = useState(0);
  const [nerMessage, setNerMessage] = useState('Initializing Edge AI...');
  const [isProcessingAI, setIsProcessingAI] = useState(false);

  // Extracted draft record state
  const [extracted, setExtracted] = useState<ExtractedNERResult | null>(null);

  // User-confirmed / modified draft fields
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

  // Initialize In-Browser Transformers.js model and subscribe to cache events
  useEffect(() => {
    const unsub = subscribeNERStatus((status, progress, message) => {
      setNerStatus(status);
      setNerProgress(progress);
      setNerMessage(message);
    });

    initNERPipeline().catch((err) => {
      console.warn('Initial NER pipeline load note:', err);
    });

    return () => unsub();
  }, []);

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
        if (
          event.error === 'network' ||
          event.error === 'not-allowed' ||
          event.error === 'service-not-allowed'
        ) {
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

  // Process typed or dictated note through In-Browser Edge AI NER
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

    setIsProcessingAI(true);
    try {
      const result = await extractMedicationNER(text, new Date());
      setExtracted(result);
      setSealedSuccess(null);

      // Populate draft confirmed state with whatever was successfully extracted
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
        const check = checkSafety(
          result.drug,
          result.dose,
          result.unit,
          records,
          new Date(result.administeredAt)
        );
        setSafetyWarnings(check.warnings);
      } else {
        setSafetyWarnings([]);
      }
    } catch (err) {
      console.error('Error in edge NER extraction:', err);
    } finally {
      setIsProcessingAI(false);
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

  // CLOSED-LOOP VALIDATION: CONFIRM MEDICATION / PROCEDURE ACTION
  const handleConfirmMedication = async (overrideProcedure?: { isProcedure: boolean; procedureName: string }) => {
    const isProc = Boolean(
      overrideProcedure?.isProcedure ||
      extracted?.isProcedure ||
      (!selectedDrug && (extracted?.rawText || inputText))
    );
    const procName = overrideProcedure?.procedureName || extracted?.procedureName || selectedDrug || 'CPR';

    const numDose = parseFloat(selectedDose);

    if (!isProc) {
      if (!selectedDrug || isNaN(numDose) || !selectedUnit || !selectedRoute) return;
    }

    const finalDrugName: string = isProc ? (selectedDrug || procName || 'CPR') : selectedDrug!;
    const finalUnit: MedUnit = isProc ? (selectedUnit || 'mg') : selectedUnit!;
    const finalRoute: MedRoute = isProc ? (selectedRoute || 'IV') : selectedRoute!;
    const finalDose: number = isProc ? (isNaN(numDose) || numDose <= 0 ? 1 : numDose) : numDose;

    setIsSealing(true);
    try {
      const prevHash = await getNextPreviousHash();
      const now = new Date();
      const recordId = `rec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const timestamp = now.getTime();
      const noteText =
        (extracted?.rawText || inputText || '').trim() ||
        (isProc ? `Performed ${procName}` : `Administered ${finalDose} ${finalUnit} ${finalDrugName} via ${finalRoute}`);

      const baseRecord = {
        id: recordId,
        drug: finalDrugName,
        dose: finalDose,
        unit: finalUnit,
        route: finalRoute,
        reason: selectedReason || (isProc ? 'cardiac arrest' : 'pain'),
        isProcedure: isProc,
        procedureName: isProc ? procName : null,
        administeredAt: administeredTime || now.toISOString(),
        capturedAt: extracted ? extracted.capturedAt : now.toISOString(),
        rawText: noteText,
        previousHash: prevHash,
      };

      const hash = await calculateRecordHash(baseRecord);

      // Generate HL7 FHIR R4 MedicationAdministration or Procedure
      const fhirResource = buildFHIRMedicationAdministration({
        ...baseRecord,
        hash,
        timestamp,
        safetyWarnings,
        safetyAcknowledged,
      });

      const sealedRecord: ConfirmedRecord = {
        ...baseRecord,
        hash,
        timestamp,
        safetyWarnings,
        safetyAcknowledged,
        fhirResource,
      };

      // Saves to IndexedDB and triggers real-time broadcast to Hospital ED View
      await saveRecord(sealedRecord);
      onRecordSealed(sealedRecord);

      // Show verified success card
      setSealedSuccess(sealedRecord);
      setExtracted(null);
      setInputText('');
    } catch (err) {
      console.error('Failed to confirm and seal clinical record:', err);
      alert('Error confirming record to local store. Check console for details.');
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
    <div className="space-y-6 pb-28 md:pb-8">
      {/* IN-BROWSER EDGE AI MODEL STATUS BANNER */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm flex-shrink-0 ${
                nerStatus === 'ready'
                  ? 'bg-teal-600'
                  : nerStatus === 'loading'
                  ? 'bg-amber-500 animate-spin'
                  : 'bg-slate-700'
              }`}
            >
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold tracking-tight text-slate-900">
                  Offline Assistant Ready
                </span>
                <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  ✓ Secure & Offline
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {nerMessage || 'Clinical data is processed and stored securely on this device.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {nerStatus === 'loading' && (
              <div className="w-32 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                <div
                  className="bg-teal-600 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${Math.max(10, nerProgress)}%` }}
                />
              </div>
            )}
            <button
              onClick={() => initNERPipeline()}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 text-xs transition-all min-h-[36px] min-w-[36px] flex items-center justify-center"
              title="Refresh / Re-cache Model"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* SEALED SUCCESS NOTIFICATION (MOVED TO VERIFIED RUN-SHEET) */}
      {sealedSuccess && (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-5 sm:p-6 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-700/20">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="text-lg font-semibold text-emerald-950">
                  {sealedSuccess.isProcedure ? 'Clinical Procedure Confirmed & Verified' : 'Medication Confirmed & Verified'}
                </h3>
                <span className="bg-emerald-200 text-emerald-900 text-xs font-semibold px-2 py-0.5 rounded-full">
                  Moved to Verified Run-sheet
                </span>
              </div>
              <p className="text-emerald-800 text-sm mb-3">
                HL7 FHIR R4 {sealedSuccess.isProcedure ? 'Procedure' : 'MedicationAdministration'} record created with secure clinical timeline. Real-time telemetry
                dispatched to Hospital ED View.
              </p>

              {/* Formatted preview */}
              <div className="bg-white/95 border border-emerald-200 rounded-xl p-3.5 mb-4 text-slate-800 font-mono text-xs shadow-inner">
                <div className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-teal-600" />
                  {formatTimeHHMM(sealedSuccess.administeredAt)} ·{' '}
                  {sealedSuccess.isProcedure
                    ? `Procedure: ${sealedSuccess.procedureName || sealedSuccess.drug}`
                    : `${sealedSuccess.drug} ${sealedSuccess.dose} ${sealedSuccess.unit} via ${sealedSuccess.route}`}
                </div>
                <div className="text-slate-600 font-sans">
                  Indication: <span className="font-medium text-slate-800">{sealedSuccess.reason}</span>
                </div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 font-mono">
                  <Clock className="w-3 h-3 text-teal-600" />
                  <span>✓ Secure Sync · HL7 FHIR R4 Ready</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  id="btn-log-another"
                  onClick={handleStartNextRecord}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl text-sm transition-all shadow-md shadow-teal-600/20 active:scale-95 min-h-[44px]"
                >
                  <Sparkles className="w-4 h-4" />
                  Log Next Entry
                </button>

                {onNavigateToHospital && (
                  <button
                    onClick={onNavigateToHospital}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-teal-300 font-semibold rounded-xl text-sm transition-all shadow-sm active:scale-95 border border-slate-700 min-h-[44px]"
                  >
                    <Radio className="w-4 h-4 text-teal-400" />
                    <span>View in Hospital ED Monitor</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}

                {onNavigateToRunSheet && (
                  <button
                    onClick={onNavigateToRunSheet}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-800 font-semibold rounded-xl text-sm transition-all border border-slate-300 shadow-sm min-h-[44px]"
                  >
                    <span>View Verified Run-Sheet</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INPUT SECTION: BIG MIC + TYPED BOX */}
      <section className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-center gap-6">
          {/* Glove-Friendly Mic Button (responsive size) */}
          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            <div className="relative flex items-center justify-center">
              {isListening && (
                <div className="absolute w-24 h-24 rounded-full bg-teal-500/30 animate-mic-pulse pointer-events-none" />
              )}
              <button
                id="mic-button"
                onClick={toggleListening}
                aria-label={isListening ? 'Stop recording voice note' : 'Start recording voice note'}
                className={`relative w-20 h-20 sm:w-22 sm:h-22 rounded-full flex flex-col items-center justify-center transition-all shadow-lg active:scale-95 ${
                  isListening
                    ? 'bg-rose-600 text-white shadow-rose-600/30 ring-4 ring-rose-200'
                    : 'bg-gradient-to-tr from-teal-700 to-teal-500 text-white hover:from-teal-800 hover:to-teal-600 shadow-teal-700/25'
                }`}
              >
                {isListening ? (
                  <MicOff className="w-8 h-8 sm:w-9 sm:h-9 animate-bounce" />
                ) : (
                  <Mic className="w-8 h-8 sm:w-9 sm:h-9" />
                )}
              </button>
            </div>
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              {isListening ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  <span className="text-rose-600 font-bold">Listening on-scene...</span>
                </>
              ) : isSpeechSupported ? (
                'Tap to Speak'
              ) : (
                'Voice Unavailable'
              )}
            </span>
          </div>

          {/* Transcript / Typed Fallback Textbox */}
          <div className="flex-1 w-full space-y-3">
            <div className="relative">
              <label
                htmlFor="scene-note-input"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between"
              >
                <span>On-Scene Voice / Typed Medication Note</span>
                {inputText.length > 0 && (
                  <button
                    onClick={() => setInputText('')}
                    className="text-xs text-slate-400 hover:text-slate-600 font-normal underline"
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
                className="w-full text-slate-900 bg-slate-50/80 border border-slate-300 rounded-xl p-3.5 text-sm sm:text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all placeholder:text-slate-400 font-medium select-text"
              />
            </div>

            {/* Inline Voice Error / Fallback Notice */}
            {speechError && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>{speechError}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
              <span className="text-xs text-slate-500 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-teal-600" />
                Clinical Assistant · 100% Offline
              </span>
              <button
                id="btn-process-note"
                onClick={() => handleProcessNote()}
                disabled={!inputText.trim() || isProcessingAI}
                className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm w-full sm:w-auto min-h-[44px] ${
                  inputText.trim() && !isProcessingAI
                    ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/20 active:scale-95'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <span>{isProcessingAI ? 'Extracting Clinical Data...' : 'Process Note'}</span>
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
                className="flex items-start justify-between gap-2 p-3.5 text-left rounded-xl bg-slate-50 hover:bg-teal-50/70 border border-slate-200 hover:border-teal-300 transition-all group active:scale-[0.99]"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
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

      {/* FEATURE 2: CLOSED-LOOP VALIDATION UI ("DRAFT CLINICAL NOTE" CARD) */}
      {extracted && (
        <DraftClinicalNoteCard
          extracted={extracted}
          selectedDrug={selectedDrug}
          selectedDose={selectedDose}
          selectedUnit={selectedUnit}
          selectedRoute={selectedRoute}
          selectedReason={selectedReason}
          administeredTime={administeredTime}
          safetyWarnings={safetyWarnings}
          safetyAcknowledged={safetyAcknowledged}
          isSealing={isSealing}
          onSelectDrug={setSelectedDrug}
          onSelectDose={setSelectedDose}
          onSelectUnit={setSelectedUnit}
          onSelectRoute={setSelectedRoute}
          onSelectReason={setSelectedReason}
          onSetAdministeredTime={setAdministeredTime}
          onToggleSafetyAcknowledge={setSafetyAcknowledged}
          onConfirmMedication={handleConfirmMedication}
        />
      )}
    </div>
  );
};
