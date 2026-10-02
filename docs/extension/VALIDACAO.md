# Estado da validação da extensão

Data: 02/10/2026.

## Confirmado neste ambiente

- Sintaxe dos módulos JavaScript: `node --check`.
- Nove testes de regras de URL, CSV e controlador com dependências simuladas: `npm test`.
- ZIP gerado com `python3 scripts/package-extension.py`; `manifest.json` está na raiz e não há dependências de desenvolvimento no arquivo.

## Ainda precisa ser testado no Chrome

- Carregar a extensão sem compactação e verificar o clique no ícone.
- Coleta real da SciELO com mais de uma página e enriquecimento de artigos.
- IndexedDB, seleção de destino do download, pausa e retomada após reiniciar Chrome.
- CSV aberto no Excel/LibreOffice e importado no Google Planilhas.
- Teste em Windows com Chrome.

Uma consulta direta à SciELO neste ambiente retornou HTTP 403 com página de verificação de acesso. O Chromium local também não iniciou por erro do ambiente macOS. Isso impede afirmar que o fluxo real foi validado. O tratamento da página de verificação foi incluído, mas precisa de teste no navegador do usuário.

**Não publicar na Chrome Web Store nem apresentar a migração como validada até passar pelos testes acima.**
