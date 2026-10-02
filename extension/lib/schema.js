export const FIELDS = Object.freeze([
  'id_scielo', 'titulo', 'autores', 'ano', 'periodico', 'volume', 'numero',
  'doi', 'palavras_chave', 'resumo', 'idioma', 'url_artigo', 'url_pdf',
  'situacao_metadados', 'triagem', 'motivo_exclusao', 'observacoes',
]);

export function blankRecord(input = {}) {
  return Object.fromEntries(FIELDS.map((field) => [field, String(input[field] ?? '')]));
}

export function readableError(error, url = '') {
  return {
    code: error?.code || 'error',
    message: String(error?.message || error || 'Erro desconhecido').slice(0, 500),
    url,
    retryable: Boolean(error?.retryable),
  };
}
