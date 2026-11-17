import { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { Navigation, type TabType } from './components/Navigation';
import { CaptureTab } from './components/CaptureTab';
import { RunSheetTab } from './components/RunSheetTab';
import { HospitalDashboard } from './components/HospitalDashboard';
import type { ConfirmedRecord, ViewMode, AmbulanceTelemetryEvent } from './lib/types';
import { getAllRecords } from './lib/db';
import { subscribeToHospitalFeed } from './lib/hospitalFeed';
import { buildFHIRMedicationAdministration } from './lib/fhir';

export function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('paramedic');
  const [activeTab, setActiveTab] = useState<TabType>('capture');
  const [records, setRecords] = useState<ConfirmedRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Hospital ED View incoming alert state: strictly empty on initial mount
  const [incomingAlert, setIncomingAlert] = useState<AmbulanceTelemetryEvent | null>(null);
  const [hasUnreadAlert, setHasUnreadAlert] = useState(false);

  // Clear any stale cached incoming alert on initial application mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('f2r_incoming_ambulance_update');
      } catch {
        // ignore
      }
    }
  }, []);

  // Load records from IndexedDB
  const loadRecords = useCallback(async () => {
    try {
      const data = await getAllRecords();
      setRecords(data);
    } catch (err) {
      console.error('Failed to load records from IndexedDB:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // Subscribe to real-time hospital feed for live telemetry (cross-tab broadcasts)
  useEffect(() => {
    const unsub = subscribeToHospitalFeed((event) => {
      setIncomingAlert(event);
      setHasUnreadAlert(true);
      loadRecords();
    });

    return () => unsub();
  }, [loadRecords]);

  // Manage dark mode class on document.body for Hospital ED View
  useEffect(() => {
    if (viewMode === 'hospital') {
      document.body.classList.add('ed-dark-mode');
      setHasUnreadAlert(false);
    } else {
      document.body.classList.remove('ed-dark-mode');
    }

    return () => {
      document.body.classList.remove('ed-dark-mode');
    };
  }, [viewMode]);

  // When a record is confirmed in Paramedic View:
  const handleRecordSealed = (sealedRecord: ConfirmedRecord) => {
    loadRecords();
    const fhirJson = sealedRecord.fhirResource || buildFHIRMedicationAdministration(sealedRecord);
    const telemetryEvent: AmbulanceTelemetryEvent = {
      id: `telemetry-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      record: sealedRecord,
      fhirJson,
      receivedAt: new Date().toISOString(),
    };
    setIncomingAlert(telemetryEvent);
    setHasUnreadAlert(true);
  };

  // When user clicks "Accept & Reconcile" in Hospital ED View:
  const handleAcknowledgeAlert = () => {
    setIncomingAlert(null);
    setHasUnreadAlert(false);
    loadRecords();
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('f2r_incoming_ambulance_update');
      } catch {
        // ignore
      }
    }
  };

  const isHospital = viewMode === 'hospital';

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
        isHospital
          ? 'bg-[#0B1120] text-slate-100 selection:bg-teal-900 selection:text-teal-100'
          : 'bg-[#F7FAFC] text-slate-800 selection:bg-teal-100 selection:text-teal-900'
      }`}
    >
      {/* Top Header with Brand and View Switcher */}
      <Header
        viewMode={viewMode}
        onSelectViewMode={setViewMode}
        hasIncomingAlert={hasUnreadAlert}
      />

      {/* Main Container */}
      {isHospital ? (
        /* HOSPITAL ED CLINICAL MONITOR VIEW */
        <main className="flex-1 w-full">
          <HospitalDashboard
            onSwitchToParamedic={() => setViewMode('paramedic')}
            incomingAlert={incomingAlert}
            onAcknowledgeAlert={handleAcknowledgeAlert}
          />
        </main>
      ) : (
        /* PARAMEDIC PREHOSPITAL FIELD VIEW */
        <div className="flex-1 flex max-w-7xl w-full mx-auto">
          {/* Navigation (Sidebar on desktop, bottom tab bar on mobile) */}
          <Navigation
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            recordCount={records.length}
            viewMode={viewMode}
            onSelectViewMode={setViewMode}
            hasIncomingAlert={hasUnreadAlert}
          />

          {/* Tab Content View */}
          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 w-full max-w-4xl mx-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-xs font-semibold">Loading offline record store...</p>
              </div>
            ) : activeTab === 'capture' ? (
              <CaptureTab
                onRecordSealed={handleRecordSealed}
                onNavigateToHospital={() => setViewMode('hospital')}
                onNavigateToRunSheet={() => setActiveTab('runsheet')}
              />
            ) : (
              <RunSheetTab
                records={records}
                onRefreshRecords={loadRecords}
                onGoToCapture={() => setActiveTab('capture')}
              />
            )}
          </main>
        </div>
      )}
    </div>
  );
}

export default App;
