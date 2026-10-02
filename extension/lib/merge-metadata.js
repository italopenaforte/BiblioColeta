import { blankRecord } from './schema.js';

export function secureScieloUrl(value) {
  if (!value) return '';
  let url;
  try { url = new URL(value); } catch { return value; }
  if (url.protocol === 'http:' && ['www.scielo.br', 'scielo.br'].includes(url.hostname)) {
    url.protocol = 'https:';
  }
  return url.href;
}

export function mergeArticleMetadata(input, metadata, finalUrl = input.url_artigo) {
  const record = blankRecord(input);
  for (const field of ['titulo', 'periodico', 'volume', 'numero', 'resumo', 'idioma', 'url_pdf']) {
    if (metadata[field]) record[field] = String(metadata[field]);
  }
  if (metadata.autores?.length) record.autores = metadata.autores.join('; ');
  if (metadata.palavras_chave?.length) record.palavras_chave = metadata.palavras_chave.join('; ');
  if (metadata.doi) record.doi = String(metadata.doi).replace(/^doi:/i, '');
  const year = String(metadata.data_publicacao || '').match(/\b(?:19|20)\d{2}\b/);
  if (year) record.ano = year[0];
  record.url_artigo = secureScieloUrl(finalUrl);
  record.url_pdf = secureScieloUrl(record.url_pdf);
  record.situacao_metadados = 'coletados';
  return record;
}
