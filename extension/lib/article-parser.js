// This function is injected into SciELO. Keep it self-contained.
export function readArticleDom() {
  const metas = [...document.querySelectorAll('meta[name]')];
  const values = (name) => metas.filter((meta) => meta.name.toLowerCase() === name)
    .map((meta) => meta.content.trim()).filter(Boolean);
  const first = (...names) => names.flatMap(values)[0] || '';
  const metadata = {
    titulo: first('citation_title', 'dc.title'),
    autores: values('citation_author').length ? values('citation_author') : values('dc.creator'),
    periodico: first('citation_journal_title'),
    data_publicacao: first('citation_publication_date', 'citation_date', 'dc.date'),
    volume: first('citation_volume'), numero: first('citation_issue'),
    doi: first('citation_doi'),
    palavras_chave: values('citation_keywords').length ? values('citation_keywords') : values('dc.subject'),
    resumo: first('citation_abstract', 'dc.description'),
    idioma: first('citation_language', 'dc.language'),
    url_pdf: first('citation_pdf_url'),
  };
  if (!metadata.titulo) throw new Error('Metadados do artigo não encontrados.');
  return { url: location.href, metadata };
}
