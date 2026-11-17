import type { ConfirmedRecord, AmbulanceTelemetryEvent } from './types';
import { buildFHIRMedicationAdministration } from './fhir';

const BROADCAST_CHANNEL_NAME = 'f2r_hospital_ed_feed';
const STORAGE_KEY_LAST_UPDATE = 'f2r_incoming_ambulance_update';
const STORAGE_KEY_ED_ACKNOWLEDGED = 'f2r_ed_acknowledged_ids';

let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  } catch (e) {
    console.warn('BroadcastChannel not supported in this context', e);
  }
}

/**
 * Broadcasts a confirmed medication from the Paramedic View to the ED Hospital View.
 * Triggers BroadcastChannel, window CustomEvent, and localStorage event across tabs.
 */
export function broadcastConfirmedMedication(record: ConfirmedRecord): AmbulanceTelemetryEvent {
  const fhirJson = record.fhirResource || buildFHIRMedicationAdministration(record);
  const event: AmbulanceTelemetryEvent = {
    id: `telemetry-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: Date.now(),
    record,
    fhirJson,
    receivedAt: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_LAST_UPDATE, JSON.stringify(event));
    } catch (e) {
      console.warn('Failed to persist to localStorage:', e);
    }

    try {
      window.dispatchEvent(new CustomEvent('f2r:incoming_ambulance', { detail: event }));
    } catch {
      // ignore
    }

    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({ type: 'INCOMING_AMBULANCE_UPDATE', event });
      } catch (e) {
        console.warn('Failed to post to BroadcastChannel:', e);
      }
    }
  }

  return event;
}

/**
 * Gets the most recent ambulance transmission from localStorage (if any).
 */
export function getLastAmbulanceUpdate(): AmbulanceTelemetryEvent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LAST_UPDATE);
    if (!raw) return null;
    return JSON.parse(raw) as AmbulanceTelemetryEvent;
  } catch {
    return null;
  }
}

let inMemoryAcknowledged: string[] = [];

/**
 * Checks if a telemetry event has already been acknowledged by the ED triage physician.
 */
export function isEventAcknowledged(id: string): boolean {
  if (inMemoryAcknowledged.includes(id)) return true;
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ED_ACKNOWLEDGED);
    if (!raw) return false;
    const ids: string[] = JSON.parse(raw);
    return ids.includes(id);
  } catch {
    return false;
  }
}

/**
 * Marks a telemetry event as acknowledged by the ED physician (silencing the flashing card).
 */
export function acknowledgeEvent(id: string): void {
  if (!inMemoryAcknowledged.includes(id)) {
    inMemoryAcknowledged.push(id);
  }
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    // Clear active alert from local storage so it does not reappear on view toggling
    localStorage.removeItem(STORAGE_KEY_LAST_UPDATE);
    const raw = localStorage.getItem(STORAGE_KEY_ED_ACKNOWLEDGED);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    if (!ids.includes(id)) {
      ids.push(id);
      localStorage.setItem(STORAGE_KEY_ED_ACKNOWLEDGED, JSON.stringify(ids.slice(-50)));
    }
    window.dispatchEvent(new CustomEvent('f2r:event_acknowledged', { detail: { id } }));
  } catch {
    // ignore
  }
}

/**
 * Clears any active alert from local storage.
 */
export function clearActiveAmbulanceUpdate(): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY_LAST_UPDATE);
  } catch {
    // ignore
  }
}

/**
 * Subscribes to incoming ambulance transmissions.
 * Works seamlessly within the same tab, across tabs, and on storage events.
 */
export function subscribeToHospitalFeed(onUpdate: (event: AmbulanceTelemetryEvent) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleCustomEvent = (e: Event) => {
    const custom = e as CustomEvent<AmbulanceTelemetryEvent>;
    if (custom.detail) {
      onUpdate(custom.detail);
    }
  };

  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY_LAST_UPDATE && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue) as AmbulanceTelemetryEvent;
        onUpdate(parsed);
      } catch {
        // ignore
      }
    }
  };

  const handleBroadcastMessage = (e: MessageEvent) => {
    if (e.data && e.data.type === 'INCOMING_AMBULANCE_UPDATE' && e.data.event) {
      onUpdate(e.data.event);
    }
  };

  window.addEventListener('f2r:incoming_ambulance', handleCustomEvent);
  window.addEventListener('storage', handleStorageEvent);

  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', handleBroadcastMessage);
  }

  return () => {
    window.removeEventListener('f2r:incoming_ambulance', handleCustomEvent);
    window.removeEventListener('storage', handleStorageEvent);
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', handleBroadcastMessage);
    }
  };
}

/**
 * Generates a simulated prehospital transmission for testing the Hospital ED Monitor.
 */
export function createMockAmbulanceTransmission(scenario: 'seizure' | 'anaphylaxis' | 'cardiac_arrest' | 'cpr' = 'seizure'): AmbulanceTelemetryEvent {
  const now = new Date();
  const scenarios: Record<string, Partial<ConfirmedRecord>> = {
    seizure: {
      drug: 'Midazolam',
      dose: 2,
      unit: 'mg',
      route: 'IV push',
      reason: 'seizure',
      rawText: 'Gave two milligrams midazolam IV push just now for active seizure',
    },
    anaphylaxis: {
      drug: 'Epinephrine',
      dose: 0.5,
      unit: 'mg',
      route: 'IM',
      reason: 'anaphylaxis',
      rawText: 'Administered 0.5 mg Epinephrine IM for severe anaphylaxis with airway stridor',
    },
    cardiac_arrest: {
      drug: 'Epinephrine',
      dose: 1,
      unit: 'mg',
      route: 'IV push',
      reason: 'cardiac arrest',
      rawText: 'Administered one milligram Epinephrine IV push cycle 2 of cardiac arrest',
    },
    cpr: {
      isProcedure: true,
      procedureName: 'CPR (Cardiopulmonary Resuscitation)',
      drug: 'CPR (Compressions)',
      dose: 1,
      unit: 'mg',
      route: 'IV',
      reason: 'cardiac arrest',
      rawText: 'Started immediate CPR chest compressions for unwitnessed cardiac arrest',
    },
  };

  const data = scenarios[scenario];
  const rec: ConfirmedRecord = {
    id: `sim-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    drug: data.drug || 'Midazolam',
    dose: data.dose || 2,
    unit: data.unit || 'mg',
    route: data.route || 'IV push',
    reason: data.reason || 'seizure',
    isProcedure: data.isProcedure,
    procedureName: data.procedureName,
    administeredAt: now.toISOString(),
    capturedAt: now.toISOString(),
    rawText: data.rawText || '',
    previousHash: '0'.repeat(64),
    hash: Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
    timestamp: now.getTime(),
    safetyWarnings: [],
    safetyAcknowledged: false,
  };

  return broadcastConfirmedMedication(rec);
}
