import test from 'node:test';
import assert from 'node:assert/strict';
import { createController } from '../../extension/lib/controller.js';

Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { locks: { async request(name, options, callback) { return callback({ name }); } } },
});

function fakeStore() {
  const records = [];
  let job;
  return {
    get job() { return job; },
    get records() { return records; },
    async createJob(input) { job = { ...input, id: 'job', status: 'paused', phase: 'results', nextPage: 1, nextArticleIndex: 0, expectedTotal: null, resultCount: 0, processedCount: 0, enrichedCount: 0, failedCount: 0 }; return job; },
    async setJobStatus(id, status, error) { job = { ...job, status, lastError: error }; return job; },
    async commitResultsPage(id, page, batch, total) { assert.equal(page, job.nextPage); records.push(...batch); job = { ...job, expectedTotal: total, resultCount: records.length, nextPage: page + 1, phase: records.length === total ? 'articles' : 'results' }; return job; },
    async listRecords() { return records; },
    async commitArticle(id, index, record) { records[index] = record; job = { ...job, nextArticleIndex: index + 1, processedCount: index + 1, enrichedCount: job.enrichedCount + (record.situacao_metadados === 'coletados' ? 1 : 0), failedCount: job.failedCount + (record.situacao_metadados.startsWith('falha:') ? 1 : 0) }; return job; },
  };
}

test('zero resultados legítimo conclui sem visitar artigos', async () => {
  const store = fakeStore();
  const browser = { async openWorkerTab() { return 1; }, async readSearchPage() { return { total: 0, records: [] }; }, async closeWorkerTab() {} };
  const controller = createController({ store, browser });
  await controller.start({ normalizedUrl: 'https://search.scielo.org/?q=x' });
  assert.equal(store.job.status, 'completed');
  assert.equal(store.job.resultCount, 0);
});

test('registro duplicado na página interrompe a coleta', async () => {
  const store = fakeStore();
  const record = { id_scielo: '1', titulo: 'Um' };
  const browser = { async openWorkerTab() { return 1; }, async readSearchPage() { return { total: 2, records: [record, record] }; }, async closeWorkerTab() {} };
  const controller = createController({ store, browser });
  await controller.start({ normalizedUrl: 'https://search.scielo.org/?q=x' });
  assert.equal(store.job.status, 'error');
  assert.equal(store.job.resultCount, 0);
});

test('falha isolada de artigo preserva o registro e conclui', async () => {
  const store = fakeStore();
  const browser = {
    async openWorkerTab() { return 1; },
    async readSearchPage() { return { total: 1, records: [{ id_scielo: '1', titulo: 'Um', url_artigo: 'https://www.scielo.br/j/x/a/1/' }] }; },
    async readArticlePage() { throw new Error('artigo indisponível'); },
    async closeWorkerTab() {},
  };
  const controller = createController({ store, browser });
  await controller.start({ normalizedUrl: 'https://search.scielo.org/?q=x' });
  assert.equal(store.job.status, 'completed');
  assert.equal(store.job.failedCount, 1);
  assert.match(store.records[0].situacao_metadados, /^falha:/);
});

test('pausa durante leitura não confirma uma página nem deixa job rodando', async () => {
  const store = fakeStore();
  let controller;
  const browser = {
    async openWorkerTab() { return 1; },
    async readSearchPage() {
      controller.pause();
      return { total: 1, records: [{ id_scielo: '1', titulo: 'Um' }] };
    },
    async closeWorkerTab() {},
  };
  controller = createController({ store, browser });
  await controller.start({ normalizedUrl: 'https://search.scielo.org/?q=x' });
  assert.equal(store.job.status, 'paused');
  assert.equal(store.job.resultCount, 0);
});
