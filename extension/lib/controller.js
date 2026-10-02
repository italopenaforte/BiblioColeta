import { pageUrl } from './search-url.js';
import { mergeArticleMetadata } from './merge-metadata.js';
import { readableError } from './schema.js';

const MIN_INTERVAL = 1000;

function pause(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Interrompida', 'AbortError'));
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    function abort() { clearTimeout(timer); reject(new DOMException('Interrompida', 'AbortError')); }
    signal.addEventListener('abort', abort, { once: true });
  });
}

export function createController({ browser, store, onProgress }) {
  let signalController = null;
  let activeJobId = null;
  let requestedStatus = 'paused';

  async function publish(job) { onProgress?.(job); return job; }

  async function execute(jobId) {
    if (signalController) throw new Error('Já existe uma coleta nesta aba.');
    const controller = new AbortController();
    signalController = controller;
    activeJobId = jobId;
    requestedStatus = 'paused';
    try {
      if (!navigator.locks?.request) throw new Error('Seu Chrome não oferece o controle necessário para uma coleta única.');
      return await navigator.locks.request('bibliocoleta-coleta', { ifAvailable: true }, async (lock) => {
        if (!lock) throw new Error('Já existe uma coleta em outra aba do BiblioColeta.');
        let tabId;
        try {
          let job = await publish(await store.setJobStatus(jobId, 'running'));
          tabId = await browser.openWorkerTab();
          while (job.phase === 'results' && !controller.signal.aborted) {
            const result = await browser.readSearchPage(tabId, pageUrl(job.normalizedUrl, job.nextPage), controller.signal);
            if (controller.signal.aborted) break;
            if (job.expectedTotal !== null && result.total !== job.expectedTotal) {
              throw new Error('O total da SciELO mudou durante a coleta. Retome uma nova busca para evitar registros faltantes.');
            }
            if (result.total > job.resultCount && result.records.length === 0) throw new Error('Página de resultados sem registros legíveis.');
            if (result.records.length > 50 || job.resultCount + result.records.length > result.total) {
              throw new Error('A página retornou mais registros que o total informado.');
            }
            const ids = new Set();
            for (const record of result.records) {
              if (!record.id_scielo || !record.titulo || ids.has(record.id_scielo)) {
                throw new Error('Registro ausente, incompleto ou duplicado na página.');
              }
              ids.add(record.id_scielo);
            }
            job = await publish(await store.commitResultsPage(jobId, job.nextPage, result.records, result.total));
            if (job.phase === 'results') await pause(MIN_INTERVAL, controller.signal);
          }
          let records = await store.listRecords(jobId);
          while (job.phase === 'articles' && job.nextArticleIndex < records.length && !controller.signal.aborted) {
            const index = job.nextArticleIndex;
            let record = records[index];
            if (!record.url_artigo) {
              record = { ...record, situacao_metadados: 'sem_link' };
            } else {
              try {
                const article = await browser.readArticlePage(tabId, record.url_artigo, controller.signal);
                record = mergeArticleMetadata(record, article.metadata, article.url);
              } catch (error) {
                if (controller.signal.aborted) throw error;
                if (error.code === 'blocked' || error.code === 'transient') throw error;
                record = { ...record, situacao_metadados: `falha: ${String(error.message || error).slice(0, 180)}` };
              }
            }
            if (controller.signal.aborted) break;
            job = await publish(await store.commitArticle(jobId, index, record));
            records[index] = record;
            if (job.nextArticleIndex < records.length) await pause(MIN_INTERVAL, controller.signal);
          }
          if (controller.signal.aborted) return publish(await store.setJobStatus(jobId, requestedStatus));
          return publish(await store.setJobStatus(jobId, 'completed'));
        } finally {
          if (tabId !== undefined) await browser.closeWorkerTab(tabId);
        }
      });
    } catch (error) {
      const status = controller.signal.aborted ? requestedStatus : 'error';
      return publish(await store.setJobStatus(jobId, status,
        status === 'error' ? readableError(error) : null));
    } finally {
      signalController = null;
      activeJobId = null;
    }
  }

  return {
    async start(input) { const job = await store.createJob(input); await publish(job); return execute(job.id); },
    async resume(jobId) { return execute(jobId); },
    pause() { requestedStatus = 'paused'; signalController?.abort(); },
    cancel() { requestedStatus = 'cancelled'; signalController?.abort(); },
    get activeJobId() { return activeJobId; },
  };
}
