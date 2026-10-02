#!/usr/bin/env python3
"""Reproduz uma busca da SciELO e salva metadados para triagem manual."""

from __future__ import annotations

import argparse
import csv
from datetime import datetime
import json
from pathlib import Path
import re
import sys
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse


COUNT_RE = re.compile(r"\((\d[\d\s.,]*)\)\s*$")
VISIBLE_COUNT_RE = re.compile(r"(?m)^Resultados:[ \t]*([\d][\d .]*)[ \t]*$")
BRAZIL_FILTER = ("filter[in][]", "scl")
FIELDS = [
    "id_scielo", "titulo", "autores", "ano", "periodico", "volume", "numero",
    "doi", "palavras_chave", "resumo", "idioma", "url_artigo", "url_pdf",
    "situacao_metadados",
    "triagem", "motivo_exclusao", "observacoes",
]


class BuscaIncompleta(Exception):
    pass


def validate_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname != "search.scielo.org":
        raise ValueError("Use uma URL HTTPS de search.scielo.org.")
    params = dict(parse_qsl(parsed.query, keep_blank_values=True))
    if not params.get("q", "").strip():
        raise ValueError("A URL precisa conter o parâmetro q da busca original.")
    return url


def query_url(query: str) -> str:
    if not query.strip():
        raise ValueError("--consulta não pode estar vazia.")
    return "https://search.scielo.org/?" + urlencode([("q", query), ("lang", "pt"), BRAZIL_FILTER])


def brazil_url(url: str) -> str:
    parsed = urlparse(validate_url(url))
    params = [(key, value) for key, value in parse_qsl(parsed.query, keep_blank_values=True)
              if key not in {"filter[in][]", "filter[in]"}]
    params.append(BRAZIL_FILTER)
    return urlunparse(parsed._replace(query=urlencode(params)))


def secure_scielo_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme == "http" and parsed.hostname in {"www.scielo.br", "scielo.br"}:
        return urlunparse(parsed._replace(scheme="https"))
    return url


def folder_for_query(url: str) -> str:
    query = dict(parse_qsl(urlparse(validate_url(url)).query, keep_blank_values=True))["q"].strip()
    match = re.fullmatch(r"[a-z_]+:\((.*)\)", query, flags=re.IGNORECASE)
    if match:
        query = match.group(1).strip()
    query = query.strip('"“”')
    name = re.sub(r'[\\/:*?"<>|\x00-\x1f]', " ", query)
    name = re.sub(r"\s+", " ", name).strip(" .")[:100].strip(" .")
    return name or "busca"


def output_folder(url: str, selected: Path | None) -> Path:
    return selected if selected is not None else Path(__file__).resolve().parent / "artigos" / folder_for_query(url)


def page_url(url: str, page: int, per_page: int = 50) -> str:
    parsed = urlparse(validate_url(url))
    params = [(k, v) for k, v in parse_qsl(parsed.query, keep_blank_values=True)
              if k not in {"page", "from", "count", "output"}]
    params.extend([("count", str(per_page)), ("page", str(page)),
                   ("from", str((page - 1) * per_page + 1)), ("output", "site")])
    return urlunparse(parsed._replace(query=urlencode(params)))


def parse_total(text: str) -> int:
    match = VISIBLE_COUNT_RE.search(text) or COUNT_RE.search(text.strip())
    if not match:
        raise BuscaIncompleta("Não foi possível ler o total no cabeçalho da SciELO.")
    return int(re.sub(r"\D", "", match.group(1)))


def extract_records(page) -> list[dict[str, str]]:
    return page.locator("div.item[id]").evaluate_all("""items => items.map(item => {
      const text = selector => item.querySelector(selector)?.textContent?.trim() || '';
      const sourceValue = labels => {
        const label = [...item.querySelectorAll('.line.source small')]
          .find(node => labels.includes(node.textContent.trim().toLowerCase()));
        return label?.nextElementSibling?.textContent?.trim() || '';
      };
      const pdfs = [...item.querySelectorAll('a[href*="script=sci_pdf"]')];
      const pdf = pdfs.find(a => /[?&]tlng=pt(?:&|$)/.test(a.href)) || pdfs[0];
      const article = item.querySelector('a[href*="script=sci_arttext"]');
      const source = text('.line.source');
      const year = source.match(/\\b(?:19|20)\\d{2}\\b/);
      return {
        id_scielo: item.querySelector('input.my_selection')?.value || item.id,
        titulo: text('strong.title'),
        autores: [...item.querySelectorAll('.line.authors a.author')].map(a => a.textContent.trim()).join('; '),
        periodico: text('.line.source .dropdown-toggle'),
        ano: year ? year[0] : '',
        volume: sourceValue(['volume']),
        numero: sourceValue(['nº', 'n°', 'n.', 'número', 'number']),
        doi: text('.DOIResults').replace(/^https?:\\/\\/doi.org\\//, ''),
        url_artigo: article?.href || '',
        url_pdf: pdf?.href || ''
      };
    })""")


def collect(page, url: str) -> tuple[list[dict[str, str]], int]:
    records = []
    seen = set()
    page_number = 1
    first_total = None
    while first_total is None or len(records) < first_total:
        target = page_url(url, page_number)
        response = page.goto(target, wait_until="domcontentloaded", timeout=60000)
        if response is None or response.status >= 400:
            raise BuscaIncompleta(f"A SciELO não abriu a página {page_number} ({response.status if response else 'sem resposta'}).")
        total = parse_total(page.locator("body").inner_text())
        if first_total is None:
            first_total = total
            print(f"Resultados encontrados: {total}")
        elif total != first_total:
            raise BuscaIncompleta("O total da SciELO mudou durante a coleta. Repita a busca para evitar registros faltantes.")
        if total == 0:
            break
        batch = extract_records(page)
        if not batch:
            raise BuscaIncompleta(f"Nenhum registro legível na página {page_number}.")
        for record in batch:
            identifier = record["id_scielo"]
            if not identifier or not record["titulo"] or identifier in seen:
                raise BuscaIncompleta(f"Registro ausente, incompleto ou duplicado na página {page_number}: {identifier!r}.")
            seen.add(identifier)
            records.append(record)
        if len(records) > total:
            raise BuscaIncompleta(f"Foram coletados {len(records)} registros, acima dos {total} informados pela SciELO.")
        print(f"Metadados coletados: {len(records)}/{total}")
        page_number += 1
    return records, first_total


def extract_article_metadata(page) -> dict:
    return page.evaluate("""() => {
      const metas = [...document.querySelectorAll('meta[name]')];
      const values = name => metas.filter(meta => meta.name.toLowerCase() === name)
        .map(meta => meta.content.trim()).filter(Boolean);
      const first = (...names) => names.flatMap(values)[0] || '';
      return {
        titulo: first('citation_title', 'dc.title'),
        autores: values('citation_author').length ? values('citation_author') : values('dc.creator'),
        periodico: first('citation_journal_title'),
        data_publicacao: first('citation_publication_date', 'citation_date', 'dc.date'),
        volume: first('citation_volume'),
        numero: first('citation_issue'),
        doi: first('citation_doi'),
        palavras_chave: values('citation_keywords').length ? values('citation_keywords') : values('dc.subject'),
        resumo: first('citation_abstract', 'dc.description'),
        idioma: first('citation_language', 'dc.language'),
        url_pdf: first('citation_pdf_url')
      };
    }""")


def merge_article_metadata(record: dict[str, str], metadata: dict) -> None:
    for key in ("titulo", "periodico", "volume", "numero", "resumo", "idioma", "url_pdf"):
        if metadata.get(key):
            record[key] = metadata[key]
    if metadata.get("autores"):
        record["autores"] = "; ".join(metadata["autores"])
    if metadata.get("palavras_chave"):
        record["palavras_chave"] = "; ".join(metadata["palavras_chave"])
    if metadata.get("doi"):
        record["doi"] = metadata["doi"].removeprefix("doi:")
    year = re.search(r"\b(?:19|20)\d{2}\b", metadata.get("data_publicacao", ""))
    if year:
        record["ano"] = year.group()


def enrich_records(page, records: list[dict[str, str]]) -> None:
    for index, record in enumerate(records, 1):
        record.setdefault("volume", "")
        record.setdefault("numero", "")
        record.update(palavras_chave="", resumo="", idioma="",
                      situacao_metadados="sem_link", triagem="",
                      motivo_exclusao="", observacoes="")
        if not record["url_artigo"]:
            continue
        try:
            article_url = secure_scielo_url(record["url_artigo"])
            response = page.goto(article_url, wait_until="domcontentloaded", timeout=60000)
            if response is None or response.status >= 400:
                raise ValueError(f"resposta HTTP {response.status if response else 'ausente'}")
            metadata = extract_article_metadata(page)
            if not metadata["titulo"]:
                raise ValueError("metadados do artigo não encontrados")
            merge_article_metadata(record, metadata)
            record["url_artigo"] = secure_scielo_url(page.url)
            record["situacao_metadados"] = "coletados"
        except Exception as error:
            record["situacao_metadados"] = f"falha: {str(error)[:180]}"
        print(f"Metadados do artigo {index}/{len(records)}: {record['situacao_metadados']}")


def run(args) -> int:
    try:
        url = brazil_url(args.url if args.url else query_url(args.consulta))
        destination = output_folder(url, args.saida)
        datetime.strptime(args.data_busca, "%d/%m/%Y")
        if destination.exists():
            raise ValueError(f"A pasta {destination} já existe. Use --saida para escolher uma pasta nova e preservar a coleta anterior.")
    except ValueError as error:
        print(f"Erro: {error}", file=sys.stderr)
        return 2

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Instale a dependência: python3 -m pip install -r requirements.txt && python3 -m playwright install chromium", file=sys.stderr)
        return 2

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=not args.navegador)
            context = browser.new_context(locale="pt-BR", accept_downloads=False)
            page = context.new_page()
            records, total = collect(page, url)
            enrich_records(page, records)
            destination.mkdir(parents=True)
            with (destination / "artigos.csv").open("w", newline="", encoding="utf-8") as file:
                writer = csv.DictWriter(file, fieldnames=FIELDS)
                writer.writeheader()
                writer.writerows(records)
            (destination / "busca.json").write_text(json.dumps({
                "base": "SciELO", "colecao": "Brasil (scl)", "url_original": args.url,
                "consulta": dict(parse_qsl(urlparse(url).query, keep_blank_values=True)).get("q"),
                "url_consultada": url,
                "data_busca_informada": args.data_busca,
                "coleta_em": datetime.now().astimezone().isoformat(),
                "resultados_encontrados": total,
                "resultados_coletados": len(records),
                "metadados_detalhados": sum(r["situacao_metadados"] == "coletados" for r in records),
            }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            browser.close()
    except Exception as error:
        print(f"Coleta interrompida: {error}", file=sys.stderr)
        return 1
    print(f"Coleta salva em {destination}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    search = parser.add_mutually_exclusive_group(required=True)
    search.add_argument("--url", help="URL completa da busca feita na SciELO, com campo e filtros")
    search.add_argument("--consulta", help="consulta exata na sintaxe SciELO, por exemplo subject:(\"termo\")")
    parser.add_argument("--data-busca", required=True, help="data da busca original, DD/MM/AAAA")
    parser.add_argument("--saida", type=Path, help="pasta de saída alternativa; padrão: artigos/<termo da busca>")
    parser.add_argument("--navegador", action="store_true", help="mostra o navegador durante a coleta")
    return run(parser.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
