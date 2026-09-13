import { RecordedTrack, NoteName, ScaleType } from '../types';

const DB_NAME = 'VocalKeyRecordingsDB';
const DB_VERSION = 1;
const STORE_NAME = 'recordings';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      return reject(new Error('IndexedDB no está disponible en este navegador.'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

interface StoredTrackRecord {
  id: string;
  name: string;
  createdAt: number;
  durationSeconds: number;
  blob: Blob;
  keyRoot?: NoteName;
  scaleType?: ScaleType;
  strength?: number;
  retuneSpeedMs?: number;
  sizeBytes: number;
}

export async function getAllRecordings(): Promise<RecordedTrack[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const records: StoredTrackRecord[] = request.result || [];
        // Orden descendente (más recientes primero)
        records.sort((a, b) => b.createdAt - a.createdAt);

        const tracks: RecordedTrack[] = records.map((rec) => ({
          ...rec,
          url: URL.createObjectURL(rec.blob),
        }));
        resolve(tracks);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.warn('Error fetching recordings from IndexedDB:', err);
    return [];
  }
}

export async function saveRecording(data: {
  name?: string;
  durationSeconds: number;
  blob: Blob;
  keyRoot?: NoteName;
  scaleType?: ScaleType;
  strength?: number;
  retuneSpeedMs?: number;
}): Promise<RecordedTrack> {
  const db = await openDB();
  const id = `take_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = Date.now();
  const dateStr = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const finalName = data.name?.trim() || `Toma Vocal ${dateStr}`;

  const record: StoredTrackRecord = {
    id,
    name: finalName,
    createdAt: now,
    durationSeconds: data.durationSeconds,
    blob: data.blob,
    keyRoot: data.keyRoot,
    scaleType: data.scaleType,
    strength: data.strength,
    retuneSpeedMs: data.retuneSpeedMs,
    sizeBytes: data.blob.size,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(record);

    request.onsuccess = () => {
      resolve({
        ...record,
        url: URL.createObjectURL(record.blob),
      });
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function deleteRecording(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function updateRecordingName(id: string, newName: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const record = getRequest.result;
      if (!record) {
        return resolve();
      }
      record.name = newName;
      const updateRequest = store.put(record);
      updateRequest.onsuccess = () => resolve();
      updateRequest.onerror = () => reject(updateRequest.error);
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

export async function clearAllRecordings(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
