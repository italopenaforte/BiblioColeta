import { FIELDS } from './schema.js';

function cell(value) {
  let text = String(value ?? '');
  if (/^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function buildCsv(records) {
  return '\uFEFF' + [FIELDS.join(','), ...records.map((record) => FIELDS.map((field) => cell(record[field])).join(','))].join('\r\n') + '\r\n';
}

export function buildSearchReport(job, version) {
  const complete = job.status === 'completed';
  const [year, month, day] = job.searchDate.split('-');
  return {
    base: 'SciELO', colecao: 'Brasil (scl)',
    url_original: job.sourceUrl,
    consulta: new URL(job.normalizedUrl).searchParams.get('q'),
    url_consultada: job.normalizedUrl,
    data_busca_informada: `${day}/${month}/${year}`,
    coleta_em: job.updatedAt,
    resultados_encontrados: job.expectedTotal,
    resultados_coletados: job.resultCount,
    metadados_detalhados: job.enrichedCount,
    falhas_metadados: job.failedCount,
    completa: complete,
    versao_extensao: version,
    motivo_interrupcao: complete ? null : job.lastError?.message || job.status,
  };
}
