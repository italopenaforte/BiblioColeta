import unittest
from pathlib import Path

from bibliocoleta import brazil_url, collect, enrich_records, folder_for_query, output_folder, page_url, parse_total, query_url, secure_scielo_url, validate_url
from urllib.parse import parse_qs, urlparse


class FakeLocator:
    def __init__(self, page, kind):
        self.page = page
        self.kind = kind

    def wait_for(self, **kwargs):
        pass

    def inner_text(self):
        return self.page.header

    def evaluate_all(self, script):
        return self.page.records


class FakeResponse:
    status = 200


class FakePage:
    def __init__(self, total, records):
        self.header = f"Busca > termo ({total})"
        self.records = records
        self.visited = []

    def goto(self, url, **kwargs):
        self.visited.append(url)
        return FakeResponse()

    def locator(self, selector):
        return FakeLocator(self, selector)


class FakeArticlePage:
    url = "https://www.scielo.br/j/exemplo/a/abc/"

    def goto(self, url, **kwargs):
        return FakeResponse()

    def evaluate(self, script):
        return {
            "titulo": "Título completo", "autores": ["Ana Silva", "Bia Souza"],
            "periodico": "Revista", "data_publicacao": "2023-06-01",
            "volume": "15", "numero": "2", "doi": "10.1590/exemplo",
            "palavras_chave": ["resíduos", "política pública"],
            "resumo": "Texto do resumo", "idioma": "pt",
            "url_pdf": "https://www.scielo.br/artigo.pdf",
        }


class SearchTests(unittest.TestCase):
    URL = "https://search.scielo.org/?q=ti%3Aresiduos&filter%5Bin%5D%5B%5D=scl&lang=pt"

    def test_page_url_preserves_search_and_filters(self):
        url = page_url(self.URL, 2)
        self.assertIn("q=ti%3Aresiduos", url)
        self.assertIn("filter%5Bin%5D%5B%5D=scl", url)
        self.assertIn("from=51", url)
        self.assertIn("page=2", url)

    def test_query_url_keeps_exact_field_expression(self):
        url = query_url('subject:("ciência aberta")')
        self.assertIn("q=subject%3A%28%22ci%C3%AAncia+aberta%22%29", url)
        self.assertEqual(parse_qs(urlparse(url).query)["filter[in][]"], ["scl"])

    def test_brazil_filter_replaces_other_collections_and_preserves_filters(self):
        url = "https://search.scielo.org/?q=teste&filter%5Bin%5D%5B%5D=col&filter%5Bin%5D%5B%5D=arg&filter%5Bla%5D%5B%5D=pt"
        params = parse_qs(urlparse(brazil_url(url)).query)
        self.assertEqual(params["filter[in][]"], ["scl"])
        self.assertEqual(params["filter[la][]"], ["pt"])

    def test_scielo_article_links_use_https(self):
        self.assertEqual(secure_scielo_url("http://www.scielo.br/j/abc/a/123/?lang=pt"),
                         "https://www.scielo.br/j/abc/a/123/?lang=pt")

    def test_default_folder_uses_search_term(self):
        url = query_url('subject:("ciência aberta")')
        self.assertEqual(folder_for_query(url), "ciência aberta")
        self.assertEqual(output_folder(url, None).parts[-2:], ("artigos", "ciência aberta"))

    def test_custom_output_folder_is_preserved(self):
        self.assertEqual(output_folder(self.URL, Path("outra-pasta")), Path("outra-pasta"))

    def test_folder_name_cannot_escape_articles(self):
        self.assertEqual(folder_for_query(query_url('ti:("../meu/artigo")')), "meu artigo")

    def test_rejects_wrong_host(self):
        with self.assertRaises(ValueError):
            validate_url("https://search.scielo.org.evil.test/?q=x")

    def test_parses_formatted_total(self):
        self.assertEqual(parse_total("Pesquisa > termo (1.234)"), 1234)
        self.assertEqual(parse_total("Busca\nResultados: 1 234\nFiltros"), 1234)

    def test_collects_without_expected_count(self):
        page = FakePage(1, [{"id_scielo": "1", "titulo": "Um"}])
        records, total = collect(page, self.URL)
        self.assertEqual(total, 1)
        self.assertEqual(len(records), 1)
        self.assertEqual(len(page.visited), 1)

    def test_empty_search_is_valid(self):
        page = FakePage(0, [])
        records, total = collect(page, self.URL)
        self.assertEqual((records, total), ([], 0))

    def test_article_page_enriches_all_requested_fields(self):
        record = {
            "id_scielo": "abc", "titulo": "Título curto", "autores": "",
            "periodico": "", "ano": "", "doi": "",
            "url_artigo": "https://www.scielo.br/scielo.php?script=sci_arttext&pid=abc",
            "url_pdf": "",
        }
        enrich_records(FakeArticlePage(), [record])
        self.assertEqual(record["titulo"], "Título completo")
        self.assertEqual(record["autores"], "Ana Silva; Bia Souza")
        self.assertEqual(record["ano"], "2023")
        self.assertEqual(record["periodico"], "Revista")
        self.assertEqual(record["volume"], "15")
        self.assertEqual(record["numero"], "2")
        self.assertEqual(record["doi"], "10.1590/exemplo")
        self.assertEqual(record["palavras_chave"], "resíduos; política pública")
        self.assertEqual(record["resumo"], "Texto do resumo")
        self.assertEqual(record["idioma"], "pt")
        self.assertEqual(record["url_artigo"], FakeArticlePage.url)
        self.assertEqual(record["url_pdf"], "https://www.scielo.br/artigo.pdf")
        self.assertEqual(record["situacao_metadados"], "coletados")


if __name__ == "__main__":
    unittest.main()
