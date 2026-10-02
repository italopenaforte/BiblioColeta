import json
from pathlib import Path
from tempfile import TemporaryDirectory
import sys
import threading
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen

import interface


class InterfaceTests(unittest.TestCase):
    def test_search_terms_and_scielo_link(self):
        url = interface.make_search_url({"source": "terms", "field": "ti", "terms": "ciência aberta"})
        self.assertEqual(parse_qs(urlparse(url).query)["q"], ['ti:("ciência aberta")'])
        filtered = interface.make_search_url({"source": "url", "url":
            "https://search.scielo.org/?q=teste&filter%5Bla%5D%5B%5D=pt"})
        params = parse_qs(urlparse(filtered).query)
        self.assertEqual(params["filter[la][]"], ["pt"])
        self.assertEqual(params["filter[in][]"], ["scl"])

    def test_search_requires_valid_input(self):
        with self.assertRaisesRegex(ValueError, "Digite os termos"):
            interface.make_search_url({"source": "terms", "terms": " "})
        with self.assertRaisesRegex(ValueError, "data válida"):
            interface.validate_date("2026-02-31")

    def test_each_collection_gets_its_own_folder(self):
        with TemporaryDirectory() as temp:
            with patch.object(interface, "ROOT", Path(temp)):
                url = interface.make_search_url({"source": "terms", "terms": "teste"})
                first = interface.next_folder(url)
                first.mkdir(parents=True)
                second = interface.next_folder(url)
                self.assertNotEqual(first, second)
                self.assertEqual(second.parent, first.parent)

    def test_packaged_collection_logs_without_standard_streams(self):
        with TemporaryDirectory() as temp:
            log_file = Path(temp) / "coleta.log"
            args = ["BiblioColeta.exe", "--collect", "--log-file", str(log_file),
                    "--url", "invalid", "--data-busca", "01/01/2026"]
            with patch.object(interface, "FROZEN", True), \
                 patch.object(sys, "_MEIPASS", temp, create=True), \
                 patch.object(sys, "argv", args), \
                 patch.object(sys, "stdout", None), \
                 patch.object(sys, "stderr", None), \
                 patch.dict(interface.os.environ, {}, clear=False):
                with self.assertRaises(SystemExit) as result:
                    interface.main()
                sys.stdout.close()
                sys.stderr.close()
            self.assertEqual(result.exception.code, 2)
            self.assertIn("Erro:", log_file.read_text(encoding="utf-8"))

    def test_local_page_requires_token_and_rejects_invalid_search(self):
        try:
            server = interface.ThreadingHTTPServer(("127.0.0.1", 0), interface.Handler)
        except PermissionError:
            self.skipTest("O ambiente não permite abrir uma porta local")
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        address = f"http://127.0.0.1:{server.server_port}"
        try:
            with self.assertRaises(HTTPError) as unauthorized:
                urlopen(address + "/", timeout=3)
            self.assertEqual(unauthorized.exception.code, 403)
            unauthorized.exception.close()
            with urlopen(address + "/?token=" + interface.TOKEN, timeout=3) as response:
                self.assertIn("Iniciar coleta", response.read().decode())
            payload = json.dumps({"token": interface.TOKEN, "source": "terms",
                                  "terms": "", "date": "2026-10-02"}).encode()
            request = Request(address + "/start", data=payload,
                              headers={"Content-Type": "application/json"})
            with self.assertRaises(HTTPError) as invalid:
                urlopen(request, timeout=3)
            self.assertEqual(invalid.exception.code, 400)
            invalid.exception.close()
        finally:
            server.shutdown()
            server.server_close()
            worker.join(timeout=3)


if __name__ == "__main__":
    unittest.main()
