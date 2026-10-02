#!/usr/bin/env python3
"""Interface local para iniciar coletas da SciELO no navegador."""

from __future__ import annotations

from datetime import date, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import threading
from urllib.parse import parse_qs, quote, urlparse
import webbrowser

from bibliopnrs import brazil_url, folder_for_query, query_url


FROZEN = bool(getattr(sys, "frozen", False))
ROOT = Path(sys.executable).resolve().parent if FROZEN else Path(__file__).resolve().parent
TOKEN = secrets.token_urlsafe(24)
LOCK = threading.Lock()
STATE = {"running": False, "lines": [], "result": None, "folder": None}
FIELDS = {"subject": "Título, resumo e palavras-chave", "ti": "Título", "ab": "Resumo", "kw": "Palavras-chave"}


def make_search_url(values: dict[str, str]) -> str:
    source = values.get("source", "terms")
    if source == "url":
        return brazil_url(values.get("url", "").strip())
    if source != "terms":
        raise ValueError("Escolha uma forma de busca válida.")
    terms = values.get("terms", "").strip()
    if not terms:
        raise ValueError("Digite os termos da busca.")
    field = values.get("field", "subject")
    if field not in FIELDS:
        raise ValueError("Escolha um campo válido.")
    return query_url(f'{field}:("{terms}")')


def validate_date(value: str) -> str:
    try:
        return date.fromisoformat(value).strftime("%d/%m/%Y")
    except ValueError as error:
        raise ValueError("Informe uma data válida para a busca.") from error


def next_folder(url: str) -> Path:
    base = ROOT / "artigos"
    name = folder_for_query(url)
    stamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    candidate = base / f"{name} - {stamp}"
    number = 2
    while candidate.exists():
        candidate = base / f"{name} - {stamp} ({number})"
        number += 1
    return candidate


def run_collection(url: str, search_date: str, folder: Path) -> None:
    if FROZEN:
        command = [sys.executable, "--collect", "--url", url, "--data-busca", search_date,
                   "--saida", str(folder)]
    else:
        command = [sys.executable, "-u", str(ROOT / "bibliopnrs.py"), "--url", url,
                   "--data-busca", search_date, "--saida", str(folder)]
    try:
        process = subprocess.Popen(command, cwd=ROOT, stdout=subprocess.PIPE,
                                   stderr=subprocess.STDOUT, text=True, bufsize=1)
        assert process.stdout is not None
        for line in process.stdout:
            with LOCK:
                STATE["lines"].append(line.rstrip())
        code = process.wait()
        with LOCK:
            STATE["result"] = "done" if code == 0 else "error"
            STATE["running"] = False
    except Exception as error:
        with LOCK:
            STATE["lines"].append(f"Não foi possível iniciar a coleta: {error}")
            STATE["result"] = "error"
            STATE["running"] = False


PAGE = """<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BiblioPNRS · Coleta SciELO</title>
<style>
body{font:16px/1.5 system-ui,sans-serif;background:#f5f7f4;color:#173124;margin:0}
main{max-width:700px;margin:40px auto;padding:0 20px}h1{margin-bottom:0;font-size:2rem}p{margin-top:8px}
.card{background:white;border:1px solid #dce6dc;border-radius:14px;padding:24px;margin:20px 0;box-shadow:0 4px 20px #1731240a}
label{display:block;font-weight:650;margin:16px 0 5px}input,select{box-sizing:border-box;width:100%;padding:11px;border:1px solid #aab9af;border-radius:7px;font:inherit}
.choice{display:inline-flex;align-items:center;gap:6px;margin:8px 22px 0 0;font-weight:400}.choice input{width:auto}
button,.button{background:#185b3a;color:white;border:0;border-radius:7px;padding:11px 18px;font:inherit;cursor:pointer;text-decoration:none;display:inline-block}
button:disabled{opacity:.55;cursor:wait}.muted{color:#536b59;font-size:.92rem}.hidden{display:none}#message{font-weight:600}
pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#eef4ee;border-radius:8px;padding:16px;max-height:270px;overflow:auto}
a{color:#185b3a}
</style></head><body><main><h1>Coleta de artigos SciELO</h1>
<p>Informe sua busca. A coleta considera apenas a coleção Brasil e cria uma planilha CSV para triagem.</p>
<section class="card"><form id="form">
<div><label class="choice"><input type="radio" name="source" value="terms" checked> Buscar por termos</label>
<label class="choice"><input type="radio" name="source" value="url"> Usar uma busca pronta da SciELO</label></div>
<div id="termsFields"><label for="terms">Termos da busca</label><input id="terms" name="terms" placeholder="Ex.: Política Nacional de Resíduos Sólidos">
<label for="field">Onde procurar</label><select id="field" name="field">
<option value="subject">Título, resumo e palavras-chave</option><option value="ti">Título</option>
<option value="ab">Resumo</option><option value="kw">Palavras-chave</option></select></div>
<div id="urlFields" class="hidden"><label for="url">Link da página de resultados da SciELO</label>
<input id="url" name="url" type="url" placeholder="https://search.scielo.org/?q=...">
<p class="muted">Abra a busca na SciELO, aplique os filtros desejados e cole aqui o endereço completo.</p></div>
<label for="searchDate">Data da busca</label><input id="searchDate" name="date" type="date" required>
<p class="muted">O arquivo será salvo em uma nova pasta dentro de “artigos”. Os PDFs não são baixados.</p>
<button id="start" type="submit">Iniciar coleta</button></form></section>
<section class="card" aria-live="polite"><h2>Andamento</h2><p id="message">Pronto para começar.</p>
<a id="download" class="button hidden" href="#">Baixar planilha CSV</a><pre id="log" class="hidden"></pre>
<button id="close" type="button">Fechar aplicativo</button></section>
</main><script>
const token=__TOKEN__,form=document.querySelector('#form'),start=document.querySelector('#start');
const message=document.querySelector('#message'),log=document.querySelector('#log'),download=document.querySelector('#download');
let closed=false;
document.querySelectorAll('[name=source]').forEach(r=>r.addEventListener('change',()=>{
const isUrl=document.querySelector('[name=source]:checked').value==='url';
document.querySelector('#termsFields').classList.toggle('hidden',isUrl);
document.querySelector('#urlFields').classList.toggle('hidden',!isUrl);
}));
const localToday=new Date();localToday.setMinutes(localToday.getMinutes()-localToday.getTimezoneOffset());
document.querySelector('#searchDate').value=localToday.toISOString().slice(0,10);
async function refresh(){
if(closed)return;
try{const r=await fetch('/status?token='+encodeURIComponent(token));const s=await r.json();
start.disabled=s.running;log.textContent=s.lines.join('\\n');log.classList.toggle('hidden',!s.lines.length);
if(s.running)message.textContent='Coleta em andamento. Esta etapa pode demorar conforme o número de artigos.';
else if(s.result==='done'){message.textContent='Coleta concluída. A planilha está pronta.';
download.href='/download?token='+encodeURIComponent(token);download.classList.remove('hidden');}
else if(s.result==='error')message.textContent='A coleta foi interrompida. Veja o detalhe abaixo.';
else message.textContent='Pronto para começar.';
}catch(e){message.textContent='A conexão com a ferramenta foi perdida. Abra-a novamente.';}}
form.addEventListener('submit',async e=>{e.preventDefault();start.disabled=true;download.classList.add('hidden');
message.textContent='Iniciando coleta...';log.classList.add('hidden');
const values=Object.fromEntries(new FormData(form));values.token=token;
try{const r=await fetch('/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)});
const result=await r.json();if(!r.ok){message.textContent=result.error;start.disabled=false;return;}refresh();}
catch(err){message.textContent='Não foi possível iniciar a coleta.';start.disabled=false;}});
document.querySelector('#close').addEventListener('click',async()=>{
if(start.disabled){message.textContent='Aguarde a coleta terminar antes de fechar.';return;}
await fetch('/shutdown',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});
closed=true;
message.textContent='Aplicativo fechado. Você já pode fechar esta aba.';
});
refresh();setInterval(refresh,1500);
</script></body></html>"""


class Handler(BaseHTTPRequestHandler):
    def send(self, code: int, content: bytes, mime: str) -> None:
        self.send_response(code)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(content)

    def json_response(self, code: int, data: dict) -> None:
        self.send(code, json.dumps(data, ensure_ascii=False).encode(), "application/json; charset=utf-8")

    def authorized(self, query: str) -> bool:
        return secrets.compare_digest(parse_qs(query).get("token", [""])[0], TOKEN)

    def do_GET(self) -> None:
        route = urlparse(self.path)
        if not self.authorized(route.query):
            self.json_response(403, {"error": "Acesso não autorizado."})
            return
        if route.path == "/":
            self.send(200, PAGE.replace("__TOKEN__", json.dumps(TOKEN)).encode(), "text/html; charset=utf-8")
        elif route.path == "/status":
            with LOCK:
                data = {key: STATE[key] for key in ("running", "lines", "result")}
            self.json_response(200, data)
        elif route.path == "/download":
            with LOCK:
                folder = STATE["folder"] if STATE["result"] == "done" else None
            csv_file = folder / "artigos.csv" if folder else None
            if csv_file is None or not csv_file.is_file():
                self.json_response(404, {"error": "Planilha indisponível."})
                return
            content = csv_file.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/csv; charset=utf-8")
            self.send_header("Content-Disposition", "attachment; filename*=UTF-8''" + quote(csv_file.parent.name + ".csv"))
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        else:
            self.json_response(404, {"error": "Página não encontrada."})

    def do_POST(self) -> None:
        route = urlparse(self.path).path
        if route not in {"/start", "/shutdown"}:
            self.json_response(404, {"error": "Página não encontrada."})
            return
        try:
            if int(self.headers.get("Content-Length", "0")) > 100_000:
                raise ValueError("Os dados enviados são muito grandes.")
            values = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
            if not secrets.compare_digest(str(values.get("token", "")), TOKEN):
                self.json_response(403, {"error": "Acesso não autorizado."})
                return
            if route == "/shutdown":
                with LOCK:
                    if STATE["running"]:
                        self.json_response(409, {"error": "Aguarde a coleta terminar."})
                        return
                self.json_response(200, {"ok": True})
                threading.Thread(target=self.server.shutdown, daemon=True).start()
                return
            url = make_search_url(values)
            search_date = validate_date(values.get("date", ""))
            with LOCK:
                if STATE["running"]:
                    self.json_response(409, {"error": "Já existe uma coleta em andamento."})
                    return
                folder = next_folder(url)
                STATE.update(running=True, lines=[], result=None, folder=folder)
            threading.Thread(target=run_collection, args=(url, search_date, folder), daemon=True).start()
            self.json_response(200, {"ok": True})
        except (ValueError, TypeError, KeyError, json.JSONDecodeError) as error:
            self.json_response(400, {"error": str(error)})

    def log_message(self, format: str, *args: object) -> None:
        pass


def main() -> None:
    if FROZEN:
        os.environ["PLAYWRIGHT_BROWSERS_PATH"] = str(
            Path(sys._MEIPASS) / "playwright" / "driver" / "package" / ".local-browsers")
    if FROZEN and len(sys.argv) > 1 and sys.argv[1] == "--check":
        from playwright.sync_api import sync_playwright
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            browser.close()
        probe = subprocess.run([sys.executable, "--collect", "--url", "invalid",
                                "--data-busca", "01/01/2026"],
                               capture_output=True, text=True, check=False)
        if probe.returncode != 2 or "Erro:" not in probe.stderr:
            raise RuntimeError(f"A coleta empacotada não iniciou corretamente: {probe.stderr or probe.stdout}")
        return
    if FROZEN and len(sys.argv) > 1 and sys.argv[1] == "--collect":
        import bibliopnrs
        if sys.stdout is None:
            sys.stdout = open(1, "w", encoding="utf-8", buffering=1, closefd=False)
        if sys.stderr is None:
            sys.stderr = open(2, "w", encoding="utf-8", buffering=1, closefd=False)
        sys.argv.pop(1)
        raise SystemExit(bibliopnrs.main())
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    address = f"http://127.0.0.1:{server.server_port}/?token={TOKEN}"
    if not FROZEN:
        print("BiblioPNRS aberto no navegador. Mantenha esta janela aberta durante a coleta.")
        print(f"Se o navegador não abrir sozinho, acesse: {address}")
    webbrowser.open(address)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
