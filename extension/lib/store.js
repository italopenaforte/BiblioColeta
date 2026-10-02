import { blankRecord } from './schema.js';

const DB_NAME = 'bibliocoleta';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('jobs', { keyPath: 'id' });
      const records = db.createObjectStore('records', { keyPath: ['jobId', 'id_scielo'] });
      records.createIndex('jobId', 'jobId');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transaction(names, mode, action) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(names, mode);
      let result;
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error || new Error('Falha ao salvar a coleta.'));
      tx.onabort = () => reject(tx.error || new Error('Falha ao salvar a coleta.'));
      try { action(tx, (value) => { result = value; }); } catch (error) { tx.abort(); reject(error); }
    });
  } finally {
    db.close();
  }
}

export function createJob(input) {
  const now = new Date().toISOString();
  const job = {
    schemaVersion: 1, id: crypto.randomUUID(), status: 'paused', phase: 'results',
    sourceUrl: input.sourceUrl, normalizedUrl: input.normalizedUrl,
    searchDate: input.searchDate, startedAt: now, updatedAt: now,
    expectedTotal: null, nextPage: 1, nextArticleIndex: 0,
    resultCount: 0, processedCount: 0, enrichedCount: 0, failedCount: 0,
    lastError: null,
  };
  return transaction(['jobs'], 'readwrite', (tx, set) => {
    tx.objectStore('jobs').add(job);
    set(job);
  });
}

export function getJob(id) {
  return transaction(['jobs'], 'readonly', (tx, set) => {
    tx.objectStore('jobs').get(id).onsuccess = (event) => set(event.target.result || null);
  });
}

export function getLatestJob() {
  return transaction(['jobs'], 'readonly', (tx, set) => {
    tx.objectStore('jobs').getAll().onsuccess = (event) => {
      const jobs = event.target.result;
      set(jobs.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] || null);
    };
  });
}

export function listJobs() {
  return transaction(['jobs'], 'readonly', (tx, set) => {
    tx.objectStore('jobs').getAll().onsuccess = (event) => {
      set(event.target.result.sort((a, b) => b.startedAt.localeCompare(a.startedAt)));
    };
  });
}

export function listRecords(id) {
  return transaction(['records'], 'readonly', (tx, set) => {
    tx.objectStore('records').index('jobId').getAll(id).onsuccess = (event) => {
      set(event.target.result.sort((a, b) => a.position - b.position)
        .map(({ jobId, position, ...record }) => record));
    };
  });
}

export function commitResultsPage(id, expectedPage, batch, total) {
  return transaction(['jobs', 'records'], 'readwrite', (tx, set) => {
    const jobs = tx.objectStore('jobs');
    const records = tx.objectStore('records');
    jobs.get(id).onsuccess = (event) => {
      const job = event.target.result;
      if (!job || job.nextPage !== expectedPage || job.phase !== 'results') {
        tx.abort(); return;
      }
      for (const [offset, raw] of batch.entries()) {
        const record = blankRecord(raw);
        records.add({ ...record, jobId: id, position: job.resultCount + offset });
      }
      job.expectedTotal = total;
      job.resultCount += batch.length;
      job.nextPage += 1;
      if (job.resultCount === total) job.phase = 'articles';
      job.updatedAt = new Date().toISOString();
      jobs.put(job);
      set(job);
    };
  });
}

export function commitArticle(id, expectedIndex, record) {
  return transaction(['jobs', 'records'], 'readwrite', (tx, set) => {
    const jobs = tx.objectStore('jobs');
    const records = tx.objectStore('records');
    jobs.get(id).onsuccess = (event) => {
      const job = event.target.result;
      if (!job || job.phase !== 'articles' || job.nextArticleIndex !== expectedIndex) {
        tx.abort(); return;
      }
      const saved = blankRecord(record);
      records.get([id, saved.id_scielo]).onsuccess = (found) => {
        if (!found.target.result || found.target.result.position !== expectedIndex) {
          tx.abort(); return;
        }
        records.put({ ...saved, jobId: id, position: expectedIndex });
        job.nextArticleIndex += 1;
        job.processedCount += 1;
        if (saved.situacao_metadados === 'coletados') job.enrichedCount += 1;
        if (saved.situacao_metadados.startsWith('falha:')) job.failedCount += 1;
        job.updatedAt = new Date().toISOString();
        jobs.put(job);
        set(job);
      };
    };
  });
}

export function setJobStatus(id, status, error = null) {
  return transaction(['jobs'], 'readwrite', (tx, set) => {
    const jobs = tx.objectStore('jobs');
    jobs.get(id).onsuccess = (event) => {
      const job = event.target.result;
      if (!job) { tx.abort(); return; }
      job.status = status;
      job.lastError = error;
      job.updatedAt = new Date().toISOString();
      jobs.put(job);
      set(job);
    };
  });
}

export function deleteJob(id) {
  return transaction(['jobs', 'records'], 'readwrite', (tx) => {
    tx.objectStore('jobs').delete(id);
    const records = tx.objectStore('records');
    records.index('jobId').openCursor(IDBKeyRange.only(id)).onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) { cursor.delete(); cursor.continue(); }
    };
  });
}
