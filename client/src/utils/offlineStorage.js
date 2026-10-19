/**
 * Smart Examination Management System
 * Offline Storage Module using browser IndexedDB (v2)
 * 
 * Specifically designed for Examination Halls with Mobile Network Jammers:
 * - Pre-caches scheduled exams and examination halls
 * - Caches complete hall student rosters (students, photos, seat numbers, subject)
 * - Updates local rosters in real-time during physical in-hall proctoring
 * - Stores offline verified attendance records in a pending queue
 * - Facilitates 1-click full pre-exam preparation and post-exam synchronization
 */

const DB_NAME = 'SmartExamOfflineDB';
const DB_VERSION = 2;

export const STORES = {
    ROSTERS: 'offline_rosters',
    PENDING_ATTENDANCE: 'pending_attendance',
    EXAMS: 'exams_cache',
    HALLS: 'halls_cache',
    META: 'offline_meta'
};

export function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // 1. Store for student rosters: key is `examId_hallId`
            if (!db.objectStoreNames.contains(STORES.ROSTERS)) {
                db.createObjectStore(STORES.ROSTERS, { keyPath: 'key' });
            }

            // 2. Store for offline marked attendances: key is auto-increment id
            if (!db.objectStoreNames.contains(STORES.PENDING_ATTENDANCE)) {
                const store = db.createObjectStore(STORES.PENDING_ATTENDANCE, { keyPath: 'id', autoIncrement: true });
                store.createIndex('exam_student', ['examId', 'studentId'], { unique: true });
            }

            // 3. Store for caching exam schedules
            if (!db.objectStoreNames.contains(STORES.EXAMS)) {
                db.createObjectStore(STORES.EXAMS, { keyPath: '_id' });
            }

            // 4. Store for caching halls & capacity
            if (!db.objectStoreNames.contains(STORES.HALLS)) {
                db.createObjectStore(STORES.HALLS, { keyPath: '_id' });
            }

            // 5. Store for offline metadata (preparation stamps, invigilator info)
            if (!db.objectStoreNames.contains(STORES.META)) {
                db.createObjectStore(STORES.META, { keyPath: 'key' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Cache scheduled exams in IndexedDB
 */
export async function cacheExamsOffline(exams) {
    if (!Array.isArray(exams) || exams.length === 0) return;
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.EXAMS, 'readwrite');
        const store = tx.objectStore(STORES.EXAMS);
        exams.forEach(exam => store.put(exam));
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
    });
}

/**
 * Get all cached exams from IndexedDB
 */
export async function getCachedExams() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.EXAMS, 'readonly');
        const store = tx.objectStore(STORES.EXAMS);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Cache examination halls in IndexedDB
 */
export async function cacheHallsOffline(halls) {
    if (!Array.isArray(halls) || halls.length === 0) return;
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.HALLS, 'readwrite');
        const store = tx.objectStore(STORES.HALLS);
        halls.forEach(hall => store.put(hall));
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
    });
}

/**
 * Get all cached halls from IndexedDB
 */
export async function getCachedHalls() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.HALLS, 'readonly');
        const store = tx.objectStore(STORES.HALLS);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Cache an exam hall roster offline
 */
export async function cacheHallRosterOffline(examId, hallId, rosterData) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.ROSTERS, 'readwrite');
        const store = tx.objectStore(STORES.ROSTERS);
        const record = {
            key: `${examId}_${hallId}`,
            examId,
            hallId,
            cachedAt: new Date().toISOString(),
            ...rosterData
        };
        const request = store.put(record);
        request.onsuccess = () => resolve(record);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get cached hall roster from IndexedDB
 */
export async function getCachedHallRoster(examId, hallId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.ROSTERS, 'readonly');
        const store = tx.objectStore(STORES.ROSTERS);
        const request = store.get(`${examId}_${hallId}`);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get all cached rosters currently stored in IndexedDB
 */
export async function getAllCachedRosters() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.ROSTERS, 'readonly');
        const store = tx.objectStore(STORES.ROSTERS);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Update candidate status directly in cached roster
 * (keeps the in-hall candidate table and count synchronized during offline proctoring)
 */
export async function updateStudentAttendanceInCachedRoster(examId, hallId, studentId, status, verifiedAt = new Date().toISOString()) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.ROSTERS, 'readwrite');
        const store = tx.objectStore(STORES.ROSTERS);
        const key = `${examId}_${hallId}`;
        const getReq = store.get(key);

        getReq.onsuccess = () => {
            const rosterRecord = getReq.result;
            if (!rosterRecord || !rosterRecord.roster) {
                return resolve(null);
            }

            let found = false;
            let markedPresent = 0;
            let markedAbsent = 0;
            let flagged = 0;
            let pending = 0;

            rosterRecord.roster = rosterRecord.roster.map(item => {
                const sId = item.student?._id || item.student;
                if (sId === studentId || item.student?.PRN === studentId) {
                    found = true;
                    item.status = status;
                    item.verifiedAt = verifiedAt;
                }

                if (item.status === 'Present') markedPresent++;
                else if (item.status === 'Absent') markedAbsent++;
                else if (item.status === 'Malpractice Flagged' || item.status === 'Invalid') flagged++;
                else pending++;

                return item;
            });

            rosterRecord.markedPresent = markedPresent;
            rosterRecord.markedAbsent = markedAbsent;
            rosterRecord.flagged = flagged;
            rosterRecord.pending = pending;

            const putReq = store.put(rosterRecord);
            putReq.onsuccess = () => resolve(rosterRecord);
            putReq.onerror = () => reject(putReq.error);
        };

        getReq.onerror = () => reject(getReq.error);
    });
}

/**
 * Record an attendance mark while in offline mode
 */
export async function saveOfflineAttendance(attendanceRecord) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.PENDING_ATTENDANCE, 'readwrite');
        const store = tx.objectStore(STORES.PENDING_ATTENDANCE);
        const index = store.index('exam_student');
        
        const checkReq = index.get([attendanceRecord.examId, attendanceRecord.studentId]);
        checkReq.onsuccess = () => {
            const existing = checkReq.result;
            const record = {
                ...attendanceRecord,
                recordedAt: new Date().toISOString(),
                synced: false
            };
            if (existing) {
                record.id = existing.id;
            }
            const putReq = store.put(record);
            putReq.onsuccess = () => resolve(record);
            putReq.onerror = () => reject(putReq.error);
        };
        checkReq.onerror = () => reject(checkReq.error);
    });
}

/**
 * Get all unsynced attendance records stored locally
 */
export async function getPendingOfflineAttendances() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.PENDING_ATTENDANCE, 'readonly');
        const store = tx.objectStore(STORES.PENDING_ATTENDANCE);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Clear synced records from IndexedDB
 */
export async function clearSyncedAttendances(recordIds) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.PENDING_ATTENDANCE, 'readwrite');
        const store = tx.objectStore(STORES.PENDING_ATTENDANCE);
        if (recordIds && recordIds.length > 0) {
            recordIds.forEach(id => store.delete(id));
        } else {
            store.clear();
        }
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
    });
}

/**
 * Save offline package metadata (preparation log)
 */
export async function saveOfflinePackageMeta(metadata) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.META, 'readwrite');
        const store = tx.objectStore(STORES.META);
        const record = {
            key: 'active_preparation',
            updatedAt: new Date().toISOString(),
            ...metadata
        };
        const request = store.put(record);
        request.onsuccess = () => resolve(record);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get offline package metadata
 */
export async function getOfflinePackageMeta() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.META, 'readonly');
        const store = tx.objectStore(STORES.META);
        const request = store.get('active_preparation');
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get comprehensive overview stats of offline IndexedDB
 */
export async function getOfflineStorageOverview() {
    try {
        const db = await openDB();
        const [rosters, pending, exams, halls, meta] = await Promise.all([
            getAllCachedRosters(),
            getPendingOfflineAttendances(),
            getCachedExams(),
            getCachedHalls(),
            getOfflinePackageMeta()
        ]);

        let totalStudentsCached = 0;
        rosters.forEach(r => {
            totalStudentsCached += (r.roster?.length || r.totalAllocated || 0);
        });

        let storageEstimate = null;
        if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
            storageEstimate = await navigator.storage.estimate();
        }

        return {
            rostersCount: rosters.length,
            totalStudentsCached,
            pendingCount: pending.length,
            examsCount: exams.length,
            hallsCount: halls.length,
            meta,
            storageEstimate
        };
    } catch (err) {
        console.error('Error in getOfflineStorageOverview:', err);
        return {
            rostersCount: 0,
            totalStudentsCached: 0,
            pendingCount: 0,
            examsCount: 0,
            hallsCount: 0,
            meta: null,
            error: err.message
        };
    }
}

/**
 * 1-Click Complete Pre-Exam Download Bundle
 * Downloads exams, halls, and selected hall rosters for guaranteed jammer resilience
 */
export async function downloadFullExamPackage(api, examId, hallIds, invigilator = null, onProgress = null) {
    if (onProgress) onProgress({ step: 1, text: 'Fetching Exam and Hall Directory from Server...' });
    
    // 1. Fetch & cache exams & halls
    const [eRes, hRes] = await Promise.all([
        api.get('/exams'),
        api.get('/halls')
    ]);

    const examsList = eRes.data || [];
    const hallsList = hRes.data || [];

    await cacheExamsOffline(examsList);
    await cacheHallsOffline(hallsList);

    // 2. Fetch rosters for the selected halls
    const targetHalls = Array.isArray(hallIds) ? hallIds : [hallIds];
    let totalCachedStudents = 0;
    const cachedRosters = [];

    for (let i = 0; i < targetHalls.length; i++) {
        const hId = targetHalls[i];
        if (onProgress) {
            onProgress({ 
                step: 2, 
                text: `Downloading Student Roster for Hall ${i + 1} of ${targetHalls.length}...`,
                current: i + 1,
                total: targetHalls.length
            });
        }
        try {
            const rosterRes = await api.get(`/attendance/hall-roster/${examId}/${hId}`);
            const saved = await cacheHallRosterOffline(examId, hId, rosterRes.data);
            cachedRosters.push(saved);
            totalCachedStudents += (rosterRes.data?.totalAllocated || rosterRes.data?.roster?.length || 0);
        } catch (err) {
            console.warn(`Failed caching roster for hall ${hId}:`, err.message);
        }
    }

    // 3. Save preparation metadata stamp
    const metaRecord = await saveOfflinePackageMeta({
        examId,
        hallIds: targetHalls,
        invigilatorName: invigilator?.name || 'Assigned Invigilator',
        invigilatorId: invigilator?._id,
        examsCount: examsList.length,
        hallsCount: hallsList.length,
        cachedRostersCount: cachedRosters.length,
        totalCachedStudents,
        isPreparedForOffline: true
    });

    if (onProgress) onProgress({ step: 3, text: 'Pre-Exam Offline Package Ready in IndexedDB!' });

    return {
        success: true,
        examsCount: examsList.length,
        hallsCount: hallsList.length,
        rostersCount: cachedRosters.length,
        totalCachedStudents,
        meta: metaRecord
    };
}

/**
 * Clear all offline data from IndexedDB
 */
export async function clearAllOfflineData() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([
            STORES.ROSTERS, 
            STORES.PENDING_ATTENDANCE, 
            STORES.EXAMS, 
            STORES.HALLS, 
            STORES.META
        ], 'readwrite');

        tx.objectStore(STORES.ROSTERS).clear();
        tx.objectStore(STORES.PENDING_ATTENDANCE).clear();
        tx.objectStore(STORES.EXAMS).clear();
        tx.objectStore(STORES.HALLS).clear();
        tx.objectStore(STORES.META).clear();

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
    });
}
