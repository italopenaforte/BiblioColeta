# BiblioColeta

Ferramenta para buscar artigos na coleção **SciELO Brasil** e gerar uma planilha CSV para triagem. Ela visita os artigos para reunir os metadados disponíveis. Os PDFs não são baixados.

## Para quem vai usar no Windows

1. Receba o arquivo `BiblioColeta-Windows.zip` do responsável pela pesquisa e extraia a pasta inteira.
2. Abra a pasta `BiblioColeta` e dê dois cliques em `BiblioColeta.exe`.
3. Na página que abrir, digite os termos da busca e escolha onde procurar. Se você já aplicou filtros na SciELO, selecione **Usar uma busca pronta da SciELO** e cole o link completo da página de resultados.
4. Confira a data e clique em **Iniciar coleta**. Aguarde a mensagem de conclusão; a duração depende do número de artigos.
5. Clique em **Baixar planilha CSV**. Uma cópia também ficará na pasta `artigos`, ao lado do aplicativo. A triagem é feita nas colunas vazias da planilha.

Mantenha o aplicativo aberto até a coleta terminar. Cada execução cria uma pasta própria para preservar coletas anteriores.

## Para quem prepara a distribuição

Em um computador Windows com Python 3 instalado, abra PowerShell na pasta do projeto e execute:

```powershell
.\construir_windows.ps1
```

Isso instala as dependências de construção, inclui o navegador necessário e cria `BiblioColeta-Windows.zip`. Distribua o ZIP completo, não apenas o `.exe`. A construção exige conexão com a internet; quem recebe o ZIP não precisa instalar Python nem Playwright.

Também é possível gerar o ZIP no GitHub, sem ter um computador Windows: ao enviar alterações para a branch `main`, o workflow **Criar aplicativo Windows** é executado automaticamente. Você também pode iniciá-lo em **Actions → Criar aplicativo Windows → Run workflow**. Quando terminar, abra a execução e baixe o artefato `BiblioColeta-Windows`; dentro dele estará `BiblioColeta-Windows.zip`. O fluxo verifica se o navegador incluído abre antes de disponibilizar o pacote.

Para testar a interface no próprio Windows antes de empacotar, dê dois cliques em `Iniciar BiblioColeta.bat`. Esse iniciador requer Python 3 e prepara as dependências na primeira execução.

## Uso técnico pela linha de comando

O programa também pode ser executado como script Python. Nesse modo, a consulta e o destino podem ser informados por parâmetros.

### Preparação

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m playwright install chromium
```

Você pode informar diretamente a consulta na sintaxe da SciELO. O campo faz parte da consulta (`ti` para título, `kw` para palavras chave, `ab` para resumo, `subject` para título, resumo e palavras chave).

```bash
.venv/bin/python bibliocoleta.py \
  --consulta 'subject:("ciência aberta")' \
  --data-busca 01/10/2026
```

Se a pesquisa tiver filtros, faça a busca no navegador da SciELO, aplique o campo e os filtros desejados e copie a **URL completa** da página de resultados. O script preserva os demais parâmetros e aplica a coleção Brasil (`scl`), substituindo qualquer filtro de coleção presente na URL.

```bash
.venv/bin/python bibliocoleta.py \
  --url 'https://search.scielo.org/?q=subject%3A%22ci%C3%AAncia+aberta%22&lang=pt' \
  --data-busca 01/10/2026
```

O exemplo de URL ilustra apenas a sintaxe: use a URL real da pesquisa. `--navegador` mostra o Chromium se for necessário acompanhar a página. A data informada documenta a busca original. O script lê automaticamente o total atual da coleção Brasil para saber quantas páginas percorrer.

Por padrão, a coleta fica em `artigos/ciência aberta/` dentro deste projeto, com o nome da pasta extraído da consulta. Você pode escolher outro destino com `--saida outra-pasta`.

### Arquivos gerados

- `busca.json`: consulta ou URL original, data, total encontrado, total coletado e data da coleta.
- `artigos.csv`: ID, título, autores, ano, periódico, volume, número, DOI, palavras chave, resumo, idioma, link do artigo, link do PDF e colunas vazias para triagem manual. Campos indisponíveis ficam vazios. O link do PDF é apenas registrado, sem download. O arquivo usa vírgulas como separador e codificação UTF-8 para importar no Google Sheets.

O script exige uma pasta de saída nova para cada execução. Se a pasta do termo já existir, use `--saida` com outro nome para preservar a coleta anterior. A SciELO pode mudar sua página ou bloquear automação; nesse caso, execute com `--navegador` e revise a mensagem de erro.
