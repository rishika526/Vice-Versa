import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ConfirmedRecord } from './types';
import { GENESIS_HASH } from './chain';

interface F2RDatabase extends DBSchema {
  records: {
    key: string;
    value: ConfirmedRecord;
    indexes: {
      'by-timestamp': number;
    };
  };
}

const DB_NAME = 'f2r-paramedic-db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<F2RDatabase>> | null = null;

function getDB(): Promise<IDBPDatabase<F2RDatabase>> {
  if (!dbPromise) {
    dbPromise = openDB<F2RDatabase>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('records')) {
          const store = db.createObjectStore('records', { keyPath: 'id' });
          store.createIndex('by-timestamp', 'timestamp');
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Returns all records sorted newest first.
 */
export async function getAllRecords(): Promise<ConfirmedRecord[]> {
  const db = await getDB();
  const records = await db.getAllFromIndex('records', 'by-timestamp');
  // Return descending (newest first)
  return records.reverse();
}

/**
 * Returns the most recently added record to link previousHash, or null.
 */
export async function getLatestRecord(): Promise<ConfirmedRecord | null> {
  const db = await getDB();
  const tx = db.transaction('records', 'readonly');
  const index = tx.store.index('by-timestamp');
  let cursor = await index.openCursor(null, 'prev');
  if (cursor) {
    return cursor.value;
  }
  return null;
}

/**
 * Saves a sealed record into IndexedDB.
 */
export async function saveRecord(record: ConfirmedRecord): Promise<void> {
  const db = await getDB();
  await db.put('records', record);
}

/**
 * Clears all records (for testing/reset).
 */
export async function clearAllRecords(): Promise<void> {
  const db = await getDB();
  await db.clear('records');
}

/**
 * Helper to get the previous hash needed to seal a new record.
 */
export async function getNextPreviousHash(): Promise<string> {
  const latest = await getLatestRecord();
  return latest ? latest.hash : GENESIS_HASH;
}
