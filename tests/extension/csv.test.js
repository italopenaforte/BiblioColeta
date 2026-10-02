import test from 'node:test';
import assert from 'node:assert/strict';
import { FIELDS, blankRecord } from '../../extension/lib/schema.js';
import { buildCsv, buildSearchReport } from '../../extension/lib/csv.js';

test('CSV mantém colunas, UTF-8 BOM, CRLF e escapa fórmulas', () => {
  const record = blankRecord({ id_scielo: 'id1', titulo: '=1+1', resumo: 'Linha 1, "citação"\nLinha 2' });
  const csv = buildCsv([record]);
  assert.ok(csv.startsWith('\uFEFF' + FIELDS.join(',') + '\r\n'));
  assert.ok(csv.includes('"\'=1+1"'));
  assert.ok(csv.includes('"Linha 1, ""citação""\nLinha 2"'));
  assert.ok(csv.endsWith('\r\n'));
  assert.equal(buildCsv([]).split('\r\n').length, 2);
});

test('relatório parcial não se apresenta como concluído', () => {
  const job = { status: 'paused', searchDate: '2026-10-02', sourceUrl: 'https://search.scielo.org/?q=x', normalizedUrl: 'https://search.scielo.org/?q=x', updatedAt: '2026-10-02T00:00:00Z', expectedTotal: 5, resultCount: 2, enrichedCount: 1, failedCount: 0, lastError: null };
  const report = buildSearchReport(job, '0.1.0');
  assert.equal(report.completa, false);
  assert.equal(report.data_busca_informada, '02/10/2026');
});
