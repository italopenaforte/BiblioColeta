const FIELDS = new Set(['subject', 'ti', 'ab', 'kw']);

export function validateSearchUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Cole uma URL completa da busca da SciELO.'); }
  if (url.protocol !== 'https:' || url.hostname !== 'search.scielo.org' || url.username || url.password) {
    throw new Error('Use uma URL HTTPS de search.scielo.org.');
  }
  if (!url.searchParams.get('q')?.trim()) throw new Error('A URL não contém uma consulta (q).');
  return url;
}

export function buildSearchUrl({ terms, field = 'subject' }) {
  if (!FIELDS.has(field)) throw new Error('Escolha um campo válido.');
  if (!terms?.trim()) throw new Error('Digite os termos da busca.');
  const url = new URL('https://search.scielo.org/');
  url.searchParams.set('q', `${field}:("${terms.trim()}")`);
  url.searchParams.set('lang', 'pt');
  url.searchParams.append('filter[in][]', 'scl');
  return url.href;
}

export function normalizeBrazilUrl(value) {
  const url = validateSearchUrl(value);
  url.searchParams.delete('filter[in][]');
  url.searchParams.delete('filter[in]');
  url.searchParams.append('filter[in][]', 'scl');
  return url.href;
}

export function pageUrl(value, page, perPage = 50) {
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(perPage) || perPage < 1 || perPage > 50) {
    throw new Error('Página ou quantidade de registros inválida.');
  }
  const url = validateSearchUrl(value);
  for (const key of ['page', 'from', 'count', 'output']) url.searchParams.delete(key);
  url.searchParams.set('count', String(perPage));
  url.searchParams.set('page', String(page));
  url.searchParams.set('from', String((page - 1) * perPage + 1));
  url.searchParams.set('output', 'site');
  return url.href;
}

export function validateSearchDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw new Error('Informe uma data válida.');
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('Informe uma data válida.');
  }
  return value;
}

export function searchName(url) {
  const q = validateSearchUrl(url).searchParams.get('q').trim();
  const match = q.match(/^[a-z_]+:\((.*)\)$/i);
  return (match ? match[1] : q).replace(/^["“”]+|["“”]+$/g, '').trim() || 'busca';
}
