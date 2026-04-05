const DB_NAME = 'nova_media_db';
const DB_VERSION = 1;
const STORE_NAME = 'videos';

interface StoredVideoBlob {
  id: string;
  blob: Blob;
  name: string;
  type: string;
  lastModified: number;
  size: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

const isIndexedDbAvailable = () => typeof indexedDB !== 'undefined';

const openDatabase = (): Promise<IDBDatabase> => {
  if (!isIndexedDbAvailable()) {
    return Promise.reject(new Error('IndexedDB is not available in this environment.'));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB.'));
    });
  }

  return dbPromise;
};

const runRequest = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });

export const putMediaFile = async (id: string, file: File): Promise<void> => {
  const db = await openDatabase();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  const payload: StoredVideoBlob = {
    id,
    blob: file,
    name: file.name,
    type: file.type,
    lastModified: file.lastModified,
    size: file.size,
  };

  await runRequest(store.put(payload));
};

export const getMediaBlob = async (id: string): Promise<Blob | null> => {
  const db = await openDatabase();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const result = await runRequest(store.get(id));

  if (!result) {
    return null;
  }

  if (result instanceof Blob) {
    return result;
  }

  if (typeof result === 'object' && result !== null && 'blob' in result) {
    const maybeRecord = result as Partial<StoredVideoBlob>;
    return maybeRecord.blob instanceof Blob ? maybeRecord.blob : null;
  }

  return null;
};

export const deleteMediaBlob = async (id: string): Promise<void> => {
  const db = await openDatabase();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  await runRequest(store.delete(id));
};
