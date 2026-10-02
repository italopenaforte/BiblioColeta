import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchUrl, normalizeBrazilUrl, pageUrl, validateSearchDate, validateSearchUrl } from '../../extension/lib/search-url.js';

test('preserva filtros repetidos, mas restringe a coleção ao Brasil', () => {
  const source = 'https://search.scielo.org/?q=saude&filter%5Bin%5D%5B%5D=arg&filter%5Bin%5D%5B%5D=col&filter%5Bla%5D%5B%5D=pt&filter%5Bla%5D%5B%5D=en';
  const url = new URL(normalizeBrazilUrl(source));
  assert.deepEqual(url.searchParams.getAll('filter[in][]'), ['scl']);
  assert.deepEqual(url.searchParams.getAll('filter[la][]'), ['pt', 'en']);
  assert.equal(new URL(pageUrl(url.href, 2)).searchParams.get('from'), '51');
});

test('recusa URLs fora da SciELO e data inexistente', () => {
  for (const url of ['https://search.scielo.org.evil.test/?q=x', 'http://search.scielo.org/?q=x', 'https://search.scielo.org/?q=', 'https://user:pass@search.scielo.org/?q=x']) {
    assert.throws(() => validateSearchUrl(url));
  }
  assert.throws(() => validateSearchDate('2026-02-31'));
  assert.equal(validateSearchDate('2026-10-02'), '2026-10-02');
});

test('monta consulta com acentos e campo escolhido', () => {
  const url = new URL(buildSearchUrl({ terms: 'ciência aberta', field: 'ti' }));
  assert.equal(url.searchParams.get('q'), 'ti:("ciência aberta")');
  assert.deepEqual(url.searchParams.getAll('filter[in][]'), ['scl']);
});
