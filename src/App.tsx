import { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { Navigation, type TabType } from './components/Navigation';
import { CaptureTab } from './components/CaptureTab';
import { RunSheetTab } from './components/RunSheetTab';
import type { ConfirmedRecord } from './lib/types';
import { getAllRecords } from './lib/db';

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('capture');
  const [records, setRecords] = useState<ConfirmedRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const handleRecordSealed = (_sealedRecord: ConfirmedRecord) => {
    loadRecords();
  };

  return (
    <div className="min-h-screen bg-[#F7FAFC] text-slate-800 flex flex-col font-sans selection:bg-teal-100 selection:text-teal-900">
      {/* Top Header */}
      <Header />

      {/* Main Container with Desktop Sidebar / Mobile Tab View */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Navigation (Sidebar on desktop, bottom tab bar on mobile) */}
        <Navigation
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          recordCount={records.length}
        />

        {/* Tab Content View */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 w-full max-w-4xl mx-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs font-semibold">Loading offline record store...</p>
            </div>
          ) : activeTab === 'capture' ? (
            <CaptureTab onRecordSealed={handleRecordSealed} />
          ) : (
            <RunSheetTab
              records={records}
              onRefreshRecords={loadRecords}
              onGoToCapture={() => setActiveTab('capture')}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
