// IndexedDB storage wrapper for persistent data storage
// Migrates from sessionStorage and provides larger storage capacity

const DB_NAME = 'ecutek-log-viewer';
const DB_VERSION = 1;

let db = null;

/**
 * Initialize IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
function initDB(){
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)){
      reject(new Error('IndexedDB not supported'));
      return;
    }
    
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Logs store - raw CSV files
      if (!db.objectStoreNames.contains('logs')){
        const logsStore = db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
        logsStore.createIndex('timestamp', 'timestamp', { unique: false });
        logsStore.createIndex('name', 'name', { unique: false });
      }
      
      // Parsed store - parsed data structures
      if (!db.objectStoreNames.contains('parsed')){
        const parsedStore = db.createObjectStore('parsed', { keyPath: 'logId' });
        parsedStore.createIndex('logId', 'logId', { unique: true });
      }
      
      // Recent files store
      if (!db.objectStoreNames.contains('recent')){
        const recentStore = db.createObjectStore('recent', { keyPath: 'id', autoIncrement: true });
        recentStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      
      // Settings store
      if (!db.objectStoreNames.contains('settings')){
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
  });
}

/**
 * Get database instance (initialize if needed)
 * @returns {Promise<IDBDatabase>}
 */
async function getDB(){
  if (db) return db;
  return await initDB();
}

/**
 * Store raw CSV log
 * @param {string} text - CSV text content
 * @param {string} name - File name
 * @param {number} size - File size in bytes
 * @returns {Promise<number>} Log ID
 */
export async function storeLog(text, name, size){
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['logs'], 'readwrite');
    const store = transaction.objectStore('logs');
    const request = store.add({
      text,
      name: name || 'untitled.csv',
      size: size || text.length,
      timestamp: Date.now()
    });
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get log by ID
 * @param {number} id - Log ID
 * @returns {Promise<Object>} Log object
 */
export async function getLog(id){
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['logs'], 'readonly');
    const store = transaction.objectStore('logs');
    const request = store.get(id);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get most recent log
 * @returns {Promise<Object|null>} Most recent log or null
 */
export async function getRecentLog(){
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['logs'], 'readonly');
    const store = transaction.objectStore('logs');
    const index = store.index('timestamp');
    const request = index.openCursor(null, 'prev');
    
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      resolve(cursor ? cursor.value : null);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Store parsed data structure
 * @param {number} logId - Associated log ID
 * @param {Object} parsed - Parsed data (headers, cols, timeIdx)
 * @returns {Promise}
 */
export async function storeParsed(logId, parsed){
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['parsed'], 'readwrite');
    const store = transaction.objectStore('parsed');
    const request = store.put({
      logId,
      ...parsed,
      timestamp: Date.now()
    });
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get parsed data by log ID
 * @param {number} logId - Log ID
 * @returns {Promise<Object|null>} Parsed data or null
 */
export async function getParsed(logId){
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['parsed'], 'readonly');
    const store = transaction.objectStore('parsed');
    const request = store.get(logId);
    
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Add to recent files list
 * @param {string} name - File name
 * @param {number} size - File size
 * @param {number} logId - Log ID
 * @returns {Promise}
 */
export async function addToRecent(name, size, logId){
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['recent'], 'readwrite');
    const store = transaction.objectStore('recent');
    const request = store.add({
      name,
      size,
      logId,
      timestamp: Date.now()
    });
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get recent files list
 * @param {number} limit - Maximum number of files to return
 * @returns {Promise<Array>} Array of recent files
 */
export async function getRecentFiles(limit = 10){
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['recent'], 'readonly');
    const store = transaction.objectStore('recent');
    const index = store.index('timestamp');
    const request = index.openCursor(null, 'prev');
    const files = [];
    
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor && files.length < limit){
        files.push(cursor.value);
        cursor.continue();
      } else {
        resolve(files);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Store setting
 * @param {string} key - Setting key
 * @param {*} value - Setting value
 * @returns {Promise}
 */
export async function setSetting(key, value){
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['settings'], 'readwrite');
    const store = transaction.objectStore('settings');
    const request = store.put({ key, value, timestamp: Date.now() });
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get setting
 * @param {string} key - Setting key
 * @param {*} defaultValue - Default value if not found
 * @returns {Promise<*>} Setting value
 */
export async function getSetting(key, defaultValue = null){
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['settings'], 'readonly');
    const store = transaction.objectStore('settings');
    const request = store.get(key);
    
    request.onsuccess = () => {
      const result = request.result;
      resolve(result ? result.value : defaultValue);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Migrate data from sessionStorage to IndexedDB
 * @returns {Promise}
 */
export async function migrateFromSessionStorage(){
  try {
    const csvText = sessionStorage.getItem('csvText');
    const csvName = sessionStorage.getItem('csvName');
    const csvSize = sessionStorage.getItem('csvSize');
    
    if (csvText && csvName){
      const logId = await storeLog(csvText, csvName, Number(csvSize) || csvText.length);
      await addToRecent(csvName, Number(csvSize) || csvText.length, logId);
      
      // Clear sessionStorage after migration
      sessionStorage.removeItem('csvText');
      sessionStorage.removeItem('csvName');
      sessionStorage.removeItem('csvSize');
      
      return { migrated: true, logId };
    }
    
    return { migrated: false };
  } catch (error){
    console.warn('Migration from sessionStorage failed:', error);
    return { migrated: false, error: error.message };
  }
}

/**
 * Clear all stored data (for testing/debugging)
 * @returns {Promise}
 */
export async function clearAll(){
  const database = await getDB();
  const stores = ['logs', 'parsed', 'recent', 'settings'];
  
  return Promise.all(stores.map(storeName => {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }));
}
