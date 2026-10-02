// This function is injected into SciELO. Keep it self-contained.
export function readSearchDom() {
  const body = document.body?.innerText || '';
  const visible = body.match(/^Resultados:[ \t]*([\d][\d .]*)[ \t]*$/m);
  const header = body.match(/\(([\d][\d\s.,]*)\)\s*(?:\n|$)/);
  const number = (visible || header)?.[1];
  if (!number || !/\d/.test(number)) throw new Error('Não foi possível ler o total na página de resultados.');
  const total = Number(number.replace(/\D/g, ''));
  if (!Number.isSafeInteger(total)) throw new Error('Total de resultados inválido.');
  const items = [...document.querySelectorAll('div.item[id]')];
  if (total > 0 && !items.length) throw new Error('A página não contém registros legíveis.');
  const records = items.map((item) => {
    const text = (selector) => item.querySelector(selector)?.textContent?.trim() || '';
    const sourceValue = (labels) => {
      const label = [...item.querySelectorAll('.line.source small')]
        .find((node) => labels.includes(node.textContent.trim().toLowerCase()));
      return label?.nextElementSibling?.textContent?.trim() || '';
    };
    const pdfs = [...item.querySelectorAll('a[href*="script=sci_pdf"]')];
    const pdf = pdfs.find((a) => /[?&]tlng=pt(?:&|$)/.test(a.href)) || pdfs[0];
    const article = item.querySelector('a[href*="script=sci_arttext"]');
    const source = text('.line.source');
    const year = source.match(/\b(?:19|20)\d{2}\b/);
    return {
      id_scielo: item.querySelector('input.my_selection')?.value || item.id,
      titulo: text('strong.title'),
      autores: [...item.querySelectorAll('.line.authors a.author')]
        .map((a) => a.textContent.trim()).join('; '),
      ano: year?.[0] || '',
      periodico: text('.line.source .dropdown-toggle'),
      volume: sourceValue(['volume']),
      numero: sourceValue(['nº', 'n°', 'n.', 'número', 'number']),
      doi: text('.DOIResults').replace(/^https?:\/\/doi.org\//, ''),
      palavras_chave: '', resumo: '', idioma: '',
      url_artigo: article?.href || '', url_pdf: pdf?.href || '',
      situacao_metadados: 'pendente', triagem: '', motivo_exclusao: '', observacoes: '',
    };
  });
  return { url: location.href, total, records };
}
