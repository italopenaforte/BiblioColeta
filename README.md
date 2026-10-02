# BiblioColeta

O BiblioColeta busca artigos científicos na coleção **SciELO Brasil** e reúne informações como título, autores, ano e resumo em uma planilha. Você pode usar essa planilha para escolher os artigos que interessam à sua pesquisa. Os PDFs não são baixados.

## Extensão para Chrome — versão de teste

A pessoa faz a pesquisa e aplica os filtros no [site da SciELO](https://search.scielo.org/). Com os resultados abertos, clica no ícone da extensão **BiblioColeta**, confere a URL e a data e escolhe **Iniciar coleta**. A extensão lê as páginas de resultados e os artigos, mostra o andamento e, ao terminar, oferece **Baixar planilha CSV**. O Chrome pergunta onde salvar o arquivo. Também é possível baixar `busca.json` com a URL, a data e os totais.

Para instalar a versão local de teste, siga [Instalação da extensão](docs/extension/INSTALACAO.md). Para gerar o ZIP a partir do código, execute `npm test` e `npm run package:chrome`; o arquivo resultante é `BiblioColeta-Chrome.zip`. Node e Python são necessários apenas para preparar esse ZIP, não para usar a extensão no Chrome.

**Estado da migração:** a lógica da extensão e os testes de regras estão implementados. A coleta com a SciELO real, a instalação no Chrome e o download no Windows ainda precisam ser validados. Consulte [Validação da extensão](docs/extension/VALIDACAO.md). Até essa validação, a versão Windows abaixo continua disponível.

## Como usar no Windows — passo a passo

Você não precisa saber programar, instalar Python nem digitar comandos. Precisa de um computador Windows e de conexão com a internet para buscar os artigos.

### 1. Baixe o aplicativo

1. Abra a [página de download da versão mais recente](https://github.com/italopenaforte/BiblioColeta/releases/latest).
2. Procure a seção **Assets** (arquivos para download). Clique nela para expandir, se necessário.
3. Clique em **BiblioColeta-Windows.zip** e aguarde o download. Geralmente ele fica na pasta **Downloads** do computador.

Escolha o arquivo com esse nome. Os links **Source code** são para quem desenvolve o programa.

Se você recebeu `BiblioColeta-Windows.zip` diretamente de alguém responsável pela pesquisa, pode começar pelo próximo passo.

### 2. Extraia os arquivos

O ZIP é um pacote que guarda todos os arquivos do aplicativo. É preciso extraí-lo antes de usar.

1. Abra a pasta **Downloads** e encontre `BiblioColeta-Windows.zip`.
2. Clique nele com o **botão direito do mouse** e escolha **Extrair Tudo…**.
3. Escolha onde guardar a pasta, por exemplo, na **Área de Trabalho**, e clique em **Extrair**.
4. Abra a pasta extraída e, dentro dela, a pasta **BiblioColeta**.

Mantenha todos os arquivos e pastas juntos, inclusive a pasta `_internal`. Se quiser mover o aplicativo, mova a pasta **BiblioColeta** inteira. Abrir o programa diretamente de dentro do ZIP pode impedir seu funcionamento.

### 3. Abra o BiblioColeta

Dê dois cliques em **BiblioColeta.exe**. Se o Windows esconder a parte `.exe`, o nome aparecerá apenas como **BiblioColeta**, com o tipo **Aplicativo**.

A tela do BiblioColeta abrirá no seu navegador, como Edge, Chrome ou Firefox. Isso é esperado: é ali que você faz a pesquisa. O programa funciona no seu computador e acessa a SciELO pela internet para coletar os dados.

### 4. Faça uma busca

1. Deixe marcada a opção **Buscar por termos**.
2. Em **Termos da busca**, escreva o assunto que deseja pesquisar, por exemplo, `ciência aberta`.
3. Em **Onde procurar**, escolha se deseja buscar no título, no resumo ou nas palavras-chave. A opção inicial pesquisa nos três campos.
4. Confira a **Data da busca**.
5. Clique em **Iniciar coleta** e acompanhe a seção **Andamento**. Aguarde a mensagem **Coleta concluída. A planilha está pronta.**

Se você já fez uma busca no site da SciELO e aplicou filtros, marque **Usar uma busca pronta da SciELO**. Copie o endereço completo da página de resultados, na barra de endereços do navegador, e cole no campo indicado.

A coleta considera somente a coleção Brasil. O tempo de espera depende da quantidade de artigos; mantenha o aplicativo e a conexão com a internet ativos até terminar.

### 5. Salve e abra a planilha

Clique em **Baixar planilha CSV**. O navegador salvará o arquivo, normalmente em **Downloads**, ou perguntará onde você quer guardá-lo.

CSV é um formato de planilha que pode ser aberto no Excel, no LibreOffice Calc ou importado no Google Planilhas. Se todos os dados aparecerem em uma única coluna, use a opção de importar um arquivo CSV e escolha **vírgula** como separador e **UTF-8** como codificação, quando essas opções forem solicitadas.

Uma cópia também fica na pasta **artigos**, dentro da pasta do aplicativo. Cada coleta ganha uma subpasta própria, para preservar os resultados anteriores. A planilha inclui colunas vazias para você anotar sua seleção de artigos e observações.

### 6. Feche o aplicativo

Depois que a coleta terminar, clique em **Fechar aplicativo** na página. Quando aparecer a confirmação, você pode fechar a aba do navegador.

### Se algo não funcionar

- **O aplicativo não abre ou informa que falta um arquivo:** confirme que extraiu o ZIP inteiro e que o `.exe` continua junto das outras pastas e arquivos.
- **O navegador não abriu:** verifique se uma nova aba foi aberta no navegador padrão do Windows. Se não houver nenhuma, envie o detalhe do problema à pessoa responsável pela ferramenta.
- **A coleta foi interrompida:** confira a conexão com a internet e leia a mensagem na seção **Andamento**. Envie essa mensagem à pessoa responsável se o problema continuar.

As seções abaixo são para quem desenvolve ou prepara o aplicativo para distribuição.

## Para quem prepara a distribuição

Em um computador Windows com Python 3 instalado, abra PowerShell na pasta do projeto e execute:

```powershell
.\construir_windows.ps1
```

Isso instala as dependências de construção, inclui o navegador necessário e cria `BiblioColeta-Windows.zip`. Distribua o ZIP completo, não apenas o `.exe`. A construção exige conexão com a internet; quem recebe o ZIP não precisa instalar Python nem Playwright.

O GitHub gera o pacote automaticamente somente quando um PR é mesclado na branch `main`. O workflow **Criar aplicativo Windows** executa os testes e verifica o aplicativo empacotado antes de publicar `BiblioColeta-Windows.zip` em **Releases**, com uma versão identificada por `build-N`. Para distribuir, abra a Release e baixe o ZIP em **Assets**. O pacote também fica disponível como artefato da execução. PRs abertos ou fechados sem merge não geram pacotes; não é necessário criar tags manualmente.

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
