# Plano de implementação — BiblioColeta para Chrome

Estado: implementação local iniciada em 02/10/2026. A seção 6 distingue código escrito de aceite validado. Nenhuma tarefa deve ser considerada concluída sem a evidência correspondente.

Objetivo: permitir que uma pessoa pesquise na SciELO Brasil, colete os metadados dos resultados e baixe um CSV usando somente uma extensão do Chrome. A extensão não dependerá de Python, executável Windows, servidor local ou serviço externo próprio.

## 1. Como entregar este plano a outras LLMs

Execute **uma tarefa por sessão**, seguindo as dependências. Cada tarefa tem um escopo limitado; não peça a uma LLM pequena para implementar o plano inteiro.

Entregue à LLM:

1. As seções 2 a 6 deste documento.
2. O cartão da tarefa escolhida.
3. Os arquivos listados em “Ler” e os resultados das dependências.
4. O seguinte comando, substituindo `Txx`:

```text
Implemente somente a tarefa Txx de PLANO_EXTENSAO_CHROME.md.
Leia os contratos e os arquivos indicados antes de editar.
Preserve alterações locais existentes e limite suas edições ao escopo da tarefa.
Não altere contratos compartilhados sem registrar a incompatibilidade encontrada.
Não substitua APIs do Chrome por mocks na implementação de produção.
Rode a validação indicada e relate o resultado real, incluindo o que não pôde testar.
Não marque testes manuais ou contra a SciELO real como concluídos usando apenas fixtures.
Ao terminar, preencha o relatório de entrega abaixo. Não publique na loja.
```

Relatório obrigatório de cada tarefa:

```text
Tarefa:
Arquivos alterados:
Comportamento implementado:
Comandos executados e resultados:
Evidência de cada critério de aceite:
Limitações ou bloqueios:
Próxima tarefa liberada:
```

Regras de colaboração:

- Não reescrever o aplicativo Python durante a migração. Ele é a referência funcional.
- Não alterar código de outra tarefa para encobrir falhas; registrar o problema para a tarefa responsável.
- Commits, quando solicitados, devem usar o nome e o e-mail já configurados pelo usuário. Sem coauthor ou identificação da LLM.
- Não incluir credenciais, conteúdo privado de navegação nem dependências de desenvolvimento no ZIP distribuído.
- Atualizar a tabela de progresso somente depois de demonstrar o aceite. Se faltar acesso à internet ou ao Windows, registrar a validação como pendente.

## 2. O que a primeira versão deve fazer

Fluxo principal:

1. O usuário abre a SciELO, faz uma busca e aplica filtros.
2. Com os resultados abertos, clica no ícone do BiblioColeta.
3. A extensão abre uma aba própria, preenche o endereço da busca e pede confirmação da data.
4. Ao clicar em **Iniciar coleta**, ela cria uma aba de trabalho para visitar resultados e artigos.
5. A aba do BiblioColeta mostra progresso, avisos e controles para pausar, retomar e cancelar.
6. Ao terminar, o usuário baixa `artigos.csv`. Também pode baixar `busca.json`, com os dados da pesquisa.

A interface parte sempre de uma pesquisa já feita na SciELO. Não precisa oferecer formulário de termos ou campos de pesquisa. A coleção será sempre Brasil, mesmo que a URL original tenha outra coleção. Mostrar isso antes de iniciar.

Limites explícitos:

- Uma coleta ativa por vez. Sem download de PDFs, seleção automática de artigos, contas ou sincronização na nuvem.
- Coleta sequencial, sem dezenas de abas ou pedidos simultâneos.
- Manter Chrome e a aba do BiblioColeta abertos durante a coleta. Fechamentos ou descarte da aba interrompem o trabalho; os dados já confirmados devem sobreviver para retomada manual.
- Salvar o CSV via mecanismo de download do Chrome, com escolha de destino. Não criar uma pasta junto de um aplicativo instalado como a versão Python fazia.
- O usuário pode manter os registros da última pesquisa no navegador e apagá-los explicitamente. Iniciar nova pesquisa não pode apagar silenciosamente uma coleta anterior ainda não exportada.
- A extensão continua sujeita a mudanças, indisponibilidade e bloqueios da SciELO. Não contornar desafios de segurança nem apresentar bloqueio como “zero resultados”.
- Instalação local para testes primeiro. Publicação na Chrome Web Store é uma etapa posterior e depende de revisão da loja.

## 3. Referências do repositório atual

| Referência | O que reaproveitar como regra |
| --- | --- |
| `bibliocoleta.py`: `FIELDS` | Colunas e ordem do CSV |
| `validate_url`, `query_url`, `brazil_url`, `page_url` | URLs, campos, filtros e paginação |
| `parse_total`, `collect` | Total esperado, duplicatas e detecção de coleta incompleta |
| `extract_records` | Seletores dos resultados; precisam ser confirmados na SciELO atual |
| `extract_article_metadata`, `merge_article_metadata` | Metatags e enriquecimento dos registros |
| `enrich_records` | Falha de um artigo não descarta os outros |
| `run` | CSV, dados de `busca.json` e informações de rastreabilidade |
| `interface.py` | Textos em português, campos do formulário e mensagens de andamento |
| `test_bibliocoleta.py`, `test_interface.py` | Casos de comportamento já definidos |

O Python usa Playwright; a extensão usará APIs do Chrome. Portar regras, não tentar executar Python ou Playwright dentro da extensão.

## 4. Arquitetura proposta

Usar Manifest V3, JavaScript com módulos ES, HTML e CSS simples. Evitar framework de interface e etapa de compilação no MVP. Node e Playwright são ferramentas de desenvolvimento/teste, não dependências do usuário final.

```text
Ícone da extensão
  → service worker curto abre/foca app.html
    → app.html coordena a coleta e mostra o progresso
      → adaptador Chrome navega uma aba de trabalho
        → funções injetadas leem somente o DOM da SciELO
      → IndexedDB guarda registros e checkpoints
      → exportação cria CSV/JSON e solicita download
```

Decisões importantes:

- **Não colocar um loop longo de coleta no service worker.** O Chrome pode encerrá-lo. Ele só cuida do clique no ícone e da abertura/foco da interface. [Ciclo de vida do service worker](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle).
- Coordenar na aba da extensão. Salvar progresso a cada página de resultados e a cada artigo, sem depender de eventos de fechamento para salvar.
- Ler o DOM renderizado por meio de `chrome.scripting.executeScript`, no contexto isolado e no frame principal. Isso permite observar páginas que dependam de JavaScript. [API scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting).
- As funções injetadas precisam ser autossuficientes: não podem depender de imports ou variáveis do contexto da aba da extensão. Passar dados simples por `args` e retornar objetos serializáveis.
- Usar funções exportadas autossuficientes `readSearchDom()` e `readArticleDom()`. Elas acessam `document` dentro da página, e o adaptador as passa como `func`. Nos testes de navegador, executar as mesmas funções sobre fixtures.
- A primeira prova técnica deve confirmar que a SciELO permite esse fluxo; não presumir que `fetch()` de HTML retorna os mesmos dados do DOM renderizado.
- O service worker tenta reutilizar a aba da interface. O controlador também deve garantir exclusão mútua por origem, por exemplo com Web Locks, para duas abas não iniciarem dois trabalhos. Confirmar suporte no Chrome usado nos testes.
- O JSON da coleta e seus registros ficam em IndexedDB. A data inicial vem do relógio local; a primeira versão não precisa da permissão `storage`.

Permissões iniciais:

```json
{
  "permissions": ["scripting", "downloads"],
  "host_permissions": [
    "https://search.scielo.org/*",
    "https://www.scielo.br/*",
    "https://scielo.br/*"
  ]
}
```

Usar `chrome.tabs` para criar e navegar a aba de trabalho. Não adicionar `tabs`, `<all_urls>`, `cookies`, `debugger`, `webRequest` ou acesso a arquivos locais sem demonstrar uma necessidade concreta. As permissões dos hosts devem cobrir a leitura de URLs dos sites necessários. Se a SciELO redirecionar para outro domínio, interromper com informação clara e registrar o caso antes de ampliar permissões.

Estrutura alvo, criada aos poucos:

```text
extension/
  manifest.json
  worker.js
  app.html
  app.css
  app.js
  icons/
  lib/
    schema.js
    search-url.js
    merge-metadata.js
    search-parser.js
    article-parser.js
    browser.js
    store.js
    controller.js
    csv.js
    download.js
tests/extension/
  fixtures/
  *.test.js
scripts/package-extension.mjs
docs/extension/
  PROVA_TECNICA.md
  VALIDACAO.md
  PRIVACIDADE.md
  INSTALACAO.md
package.json
package-lock.json
```

## 5. Contratos que todas as tarefas devem respeitar

### 5.1 Registro e exportação

Todas as propriedades de um registro são strings. Dados ausentes ficam vazios. Ordem exata do CSV:

```text
id_scielo,titulo,autores,ano,periodico,volume,numero,doi,palavras_chave,resumo,idioma,url_artigo,url_pdf,situacao_metadados,triagem,motivo_exclusao,observacoes
```

- `autores` e `palavras_chave`: valores separados por `; ` dentro da célula.
- `situacao_metadados`: `pendente`, `coletados`, `sem_link` ou `falha: <motivo curto>`.
- `pendente` identifica registros ainda não visitados em exportação parcial.
- `triagem`, `motivo_exclusao`, `observacoes`: vazios ao coletar.
- CSV com vírgulas, CRLF e escape de aspas, vírgulas e quebras de linha. Usar UTF-8 com BOM para facilitar abertura no Excel; validar também Google Planilhas.
- Proteger células cujo início possa ser interpretado como fórmula (`=`, `+`, `-`, `@`, tabulação ou retorno de carro), prefixando apóstrofo na exportação. Documentar essa transformação, sem alterar os metadados armazenados.
- Exportação completa somente quando a paginação está completa e todos os registros foram processados. Falhas de metadados individuais devem aparecer no resumo e no CSV.
- Permitir exportação parcial explicitamente rotulada, com `-parcial` no nome do arquivo e indicador `completa: false` no JSON. Não mostrar “concluída” nesse caso.

### 5.2 Job persistido

```text
schemaVersion: 1
id: identificador único
status: idle | running | paused | completed | cancelled | error
phase: results | articles
sourceUrl: endereço informado pelo usuário
normalizedUrl: endereço com coleção Brasil e filtros preservados
searchDate: YYYY-MM-DD validado como data de calendário
startedAt, updatedAt: datas ISO
expectedTotal: inteiro não negativo ou null antes de ler o total
nextPage: inteiro, primeira página = 1
nextArticleIndex: inteiro, primeiro artigo = 0
resultCount, processedCount, enrichedCount, failedCount: inteiros
lastError: null ou { code, message, url, retryable }
```

Armazenar registros separadamente, indexados por `jobId`, `id_scielo` e posição na coleta. Em uma transação, gravar a página/artigo e avançar o checkpoint. Não gravar cursores antes dos registros. Repetir uma operação interrompida não pode duplicar registros.

Ao reabrir a interface, um job persistido como `running` só volta a executar por ação explícita do usuário; apresentar como pausado/interrompido até a retomada. Não confiar no ID antigo da aba de trabalho depois de reiniciar o Chrome: validar ou criar outra aba.

O `busca.json` preserva as informações da versão Python: base, coleção, consulta, URL original e normalizada, data da busca, data da coleta, totais encontrados/coletados/enriquecidos. Acrescentar versão da extensão, `completa`, quantidade de falhas e motivo de interrupção quando houver. Exibir a data para leigos em português; exportar `data_busca_informada` em DD/MM/AAAA para compatibilidade.

### 5.3 Interfaces entre módulos

Definir os formatos em `schema.js` com JSDoc; congelar estes contratos em T02:

```text
search-url.js:
  validateSearchUrl(url) → URL validada ou erro
  buildSearchUrl({ terms, field }) → string
  normalizeBrazilUrl(url) → string
  pageUrl(url, page, perPage = 50) → string
  validateSearchDate(value) → YYYY-MM-DD ou erro

search-parser.js:
  readSearchDom() → { url, total, records } ou erro de página ilegível

article-parser.js:
  readArticleDom() → { url, metadata } ou erro de página ilegível

merge-metadata.js:
  mergeArticleMetadata(record, metadata) → novo registro

browser.js:
  openWorkerTab() → tabId
  readSearchPage(tabId, url, signal) → resultado de readSearchDom
  readArticlePage(tabId, url, signal) → resultado de readArticleDom
  closeWorkerTab(tabId) → Promise<void>

store.js:
  createJob(input), getJob(id), getLatestJob(), listRecords(id)
  commitResultsPage(id, expectedPage, batch, total)
  commitArticle(id, expectedIndex, record)
  setJobStatus(id, status, error?), deleteJob(id)
  operações de escrita retornam o job atualizado após confirmar a transação

controller.js:
  createController({ browser, store, onProgress })
  start(input), pause(), resume(jobId), cancel()

csv.js:
  buildCsv(records) → string
  buildSearchReport(job, extensionVersion) → objeto JSON

download.js:
  downloadCsv(job, records), downloadReport(job)
```

Toda operação assíncrona retorna Promise. Normalizar falhas em `{code, message, url?, retryable}` na fronteira do adaptador/controlador. Não transportar nós DOM, funções ou objetos Error sem conversão entre contextos.

### 5.4 Regras de execução e recuperação

- Preservar parâmetros de filtros repetidos com `URLSearchParams`; não converter tudo para objeto simples.
- Validar host exato, HTTPS e consulta não vazia. Recusar domínios parecidos e URLs com credenciais embutidas.
- Paginar em blocos de até 50, seguindo a regra atual de `from`. Confirmar isso na prova real.
- Total zero é sucesso válido somente quando identificado em uma página de resultados legítima.
- Total alterado, página repetida, registro sem ID/título ou ID duplicado entre páginas: parar como coleta incompleta, preservando os dados.
- Diferenciar replay de uma página já confirmada (checkpoint idempotente) de duplicata real na resposta da SciELO (inconsistência).
- Enriquecer sequencialmente, preservando dados da busca quando metadados do artigo estiverem vazios.
- Falha isolada de artigo: registrar `falha: ...` e continuar. Bloqueio geral, perda de permissões ou aba fechada: pausar/interromper a coleta com motivo, sem disparar tentativas infinitas.
- Intervalo inicial de 1 segundo entre navegações; timeout inicial de 60 segundos. No máximo duas novas tentativas para falhas transitórias, com espera crescente. Esses são valores de implementação a validar, não garantias de limite da SciELO.
- Navegação concluída não implica DOM pronto. Esperar seletores esperados por tempo limitado e distinguir página vazia, bloqueio e erro de layout.
- O adaptador de abas não promete ler status HTTP de toda navegação: usar URL final, erros de navegação, DOM e timeout. Não inventar um código HTTP.
- Pausa/cancelamento interrompem esperas e impedem novas navegações. Ignorar resultados tardios pelo identificador da execução; não permitir que atualizem outro job.
- Não navegar nem fechar a aba original do usuário. Só administrar a aba criada pela extensão.

## 6. Ordem de execução

| Tarefa | Entrega | Depende de | Estado |
| --- | --- | --- | --- |
| T01 | Prova com SciELO real | — | Bloqueada neste ambiente: SciELO respondeu 403; teste no Chrome pendente |
| T02 | Estrutura e contratos | T01 | Código criado; carga no Chrome pendente |
| T03 | URLs e datas | T02 | Código criado; testes Node passaram |
| T04 | Parser de resultados | T02 | Código criado; DOM real pendente |
| T05 | Parser e mesclagem de artigos | T02 | Código criado; DOM real pendente |
| T06 | Persistência e checkpoints | T02 | Código criado; teste no Chrome pendente |
| T07 | Navegação nas abas | T03, T04, T05 | Código criado; teste no Chrome pendente |
| T08 | Controlador de paginação | T06, T07 | Código criado; testes simulados passaram |
| T09 | Enriquecimento e retomada | T08 | Código criado; retomada real pendente |
| T10 | CSV e relatório JSON | T02 | Código criado; testes Node passaram |
| T11 | Download no Chrome | T10 | Código criado; download real pendente |
| T12 | Interface do usuário | T09, T11 | Código criado; uso real pendente |
| T13 | Validação integrada | T12 | Pendente |
| T14 | Documentação e ZIP | T13 | Código criado; instalação real pendente |
| T15 | Release após merge | T14 | Workflow criado; execução no GitHub pendente |
| T16 | Preparação da loja | T13, T14 | Pendente |

T03, T04, T05, T06 e T10 têm contratos independentes após T02. Podem ser entregues a sessões separadas, mas integrar cada resultado antes de executar tarefas consumidoras. A integração fica sob responsabilidade de uma única pessoa/LLM.

## 7. Cartões de trabalho

### T01 — Confirmar a leitura real no Chrome

**Ler:** seções 2–5, `extract_records`, `extract_article_metadata` e `collect` em `bibliocoleta.py`.

**Editar:** somente `experiments/chrome-probe/` e `docs/extension/PROVA_TECNICA.md`.

**Fazer:** criar uma extensão mínima descartável que leia a página de resultados e um artigo por injeção de função. Registrar Chrome/SO, URL consultada, data, seletores encontrados e redirecionamentos. Testar pelo menos uma busca com mais de uma página. Guardar fixtures pequenas e sanitizadas do DOM relevante e sua origem.

**Aceite:** demonstrar leitura do total, IDs, títulos, URL do artigo, passagem para a segunda página e metatags de um artigo. Listar hosts efetivamente necessários. Se algum passo não funcionar, registrar a causa e bloquear a arquitetura de produção até resolvê-la. Fixtures inventadas não substituem essa evidência.

**Prompt específico:** “Faça somente a prova de viabilidade T01. Não construa a interface final nem altere o aplicativo Python.”

### T02 — Estrutura, contratos e execução dos testes

**Ler:** relatório T01 e seção 5.

**Editar:** `extension/manifest.json`, `worker.js`, interface mínima, `lib/schema.js`, ícones, `package.json`, lockfile e configuração dos testes.

**Fazer:** criar Manifest V3 e página mínima que abre pelo ícone. Worker registrado como módulo. Definir tipos JSDoc, colunas, estados e formatos de erro. Separar testes Node para funções puras e testes de navegador para DOM/APIs. Fixar dependências de desenvolvimento no lockfile. Sem scripts inline, CDN, `eval` ou código remoto.

**Aceite:** carregar `extension/` por **Carregar sem compactação**, abrir a interface e executar um teste inicial. Nenhuma dependência de Node no pacote final. Ícones locais válidos nos tamanhos previstos pelo manifest. Não deixar uma tela incompleta apresentar “coleta concluída”.

**Prompt específico:** “Implemente somente T02. Documente os comandos exatos de teste que as demais tarefas usarão.”

### T03 — URLs, filtros e datas

**Ler:** funções de URL em `bibliocoleta.py`, `make_search_url`/`validate_date` em `interface.py` e testes relacionados.

**Editar:** `lib/search-url.js` e seus testes.

**Fazer:** portar as regras da seção 5. Validar os quatro campos de pesquisa e a data real de calendário. Normalizar a coleção para `scl`; preservar idioma, filtros repetidos e consulta. Gerar páginas a partir da URL normalizada.

**Aceite:** testes de consulta com acentos/aspas, consulta vazia, host falso, HTTP recusado para buscas, filtros repetidos, substituição da coleção, páginas 1/2 e data impossível. Comparar parâmetros semanticamente, sem exigir o mesmo escape de espaços que Python.

**Prompt específico:** “Implemente somente T03, como funções puras; não acesse Chrome ou rede.”

### T04 — Ler resultados da busca

**Ler:** fixtures T01 e `extract_records`/`parse_total`.

**Editar:** `lib/search-parser.js`, fixtures e testes correspondentes.

**Fazer:** extrair total e registros do DOM. Completar todas as colunas com strings, usando `pendente` antes do enriquecimento. Resolver links relativos contra a URL da página. Confirmar seletores atuais e suas alternativas observadas; não inventar seletores genéricos que aceitem páginas de erro.

**Aceite:** testar zero resultados legítimo, total formatado, metadados faltantes, links relativos e página sem resultados reconhecíveis. Testar a função no contexto real de uma página, sem imports disponíveis após injeção. Uma tela de bloqueio deve resultar em erro.

**Prompt específico:** “Implemente somente T04. Extraia os dados; a detecção de duplicatas entre páginas pertence ao controlador.”

### T05 — Ler e mesclar metadados do artigo

**Ler:** `extract_article_metadata`, `merge_article_metadata`, teste de enriquecimento e fixtures T01.

**Editar:** `lib/article-parser.js`, `lib/merge-metadata.js` e testes relacionados.

**Fazer:** ler metatags `citation_*` e alternativas `dc.*`, incluindo valores múltiplos. Manter mesclagem como função pura. Usar URL final válida do artigo; registrar link PDF sem acessá-lo. Normalizar somente URLs HTTP conhecidas da SciELO para HTTPS.

**Aceite:** artigo completo, resumo ausente, metatags alternativas, autores repetidos em tags, DOI e ano. Metadado vazio não apaga dado obtido nos resultados. Uma página sem título de metadados não é enriquecimento bem-sucedido.

**Prompt específico:** “Implemente somente T05. Não faça download de PDF nem navegue por conta própria.”

### T06 — Persistência transacional

**Ler:** contrato do job e API `store.js` da seção 5.

**Editar:** `lib/store.js` e testes de persistência.

**Fazer:** criar IndexedDB com versão de schema, jobs e registros. Gravar cada lote/registro e avanço de cursor na mesma transação. Validar página/índice esperado. Erros de quota precisam ser propagados e interromper a coleta, sem descartar silenciosamente dados. Implementar exclusão explícita do job e registros associados.

**Aceite:** reabrir banco preserva dados; transação interrompida não avança cursor; replay não duplica; registros mantêm ordem; apagar uma coleta remove apenas seus dados. Testar persistência no navegador além de eventuais mocks.

**Prompt específico:** “Implemente somente T06. Não implemente navegação, interface ou uma fila em service worker.”

### T07 — Adaptador de navegação Chrome

**Ler:** prova T01, APIs de scripting/tabs e contratos dos parsers.

**Editar:** `lib/browser.js` e testes do adaptador.

**Fazer:** criar aba de trabalho, registrar listeners antes de navegar, esperar carregamento e DOM esperado, injetar funções e ler resultados. Garantir timeout, limpeza de listeners e cancelamento. Validar URL final e hosts antes de processar dados. Correlacionar retorno com a navegação atual para não aceitar DOM da página anterior.

**Aceite:** uma página de resultados e um artigo reais; aba fechada; timeout; permissão negada; URL final fora do escopo; navegação rápida sem perder evento; abortar limpa listeners. Não exigir `webRequest` apenas para fabricar um status HTTP.

**Prompt específico:** “Implemente somente T07. Use a aba criada pela extensão e preserve a aba original da pesquisa.”

### T08 — Controlador: páginas de resultados

**Ler:** `collect` em Python, regras da seção 5 e contratos T06/T07.

**Editar:** `lib/controller.js` e testes do controlador para a fase `results`.

**Fazer:** iniciar job, controlar exclusão mútua, paginar sequencialmente, confirmar cada lote e emitir progresso. Comparar total, IDs e quantidade coletada. Implementar pausa/cancelamento para esta fase. Preparar transição para `articles`; apenas zero resultados pode concluir antes do enriquecimento.

**Aceite:** 0/1/51 resultados; mudança de total; duplicatas entre páginas; página repetida; total excedido; falha no meio preserva lotes anteriores. Duas interfaces não iniciam dois jobs simultâneos. Testar cenários determinísticos com dependências injetadas.

**Prompt específico:** “Implemente somente T08. Não invente sucesso da fase de artigos; deixe a transição explícita para T09.”

### T09 — Controlador: artigos e retomada

**Ler:** `enrich_records`, T05/T06 e controlador T08.

**Editar:** parte de enriquecimento/recuperação de `lib/controller.js` e testes associados.

**Fazer:** percorrer registros persistidos, mesclar metadados, atualizar situação e confirmar cada artigo. Implementar retomada do cursor em ambas as fases; job interrompido exige clique em Retomar. Recriar aba de trabalho quando necessário. Diferenciar falha isolada de artigo de falha geral de navegação/permissões.

**Aceite:** fechar/reabrir interface após um lote ou artigo; retomar sem duplicar; cancelar impede novos acessos; callback tardio não altera outro job; artigo sem link e falha individual não eliminam registros. Contadores de processados, enriquecidos e falhos são coerentes após retomada.

**Prompt específico:** “Implemente somente T09. Não use timers para manter service worker vivo e não prometa coleta com Chrome fechado.”

### T10 — CSV e relatório da busca

**Ler:** seção 5.1, `FIELDS` e geração de JSON em Python.

**Editar:** `lib/csv.js` e testes puros.

**Fazer:** serialização dos registros na ordem contratada, escape e proteção de fórmulas. Gerar relatório JSON com completude, totais, origem e data. Dados brutos permanecem inalterados.

**Aceite:** títulos com vírgulas/aspas, resumo com quebras de linha, acentos, vazio e células com prefixos de fórmula. Zero resultados gera cabeçalho válido. Validar round-trip com parser CSV de teste e conferir mesmas colunas da versão Python.

**Prompt específico:** “Implemente somente T10. Não acesse arquivos locais nem APIs Chrome.”

### T11 — Download pelo navegador

**Ler:** T10 e API de downloads do Chrome.

**Editar:** `lib/download.js` e testes de integração relacionados.

**Fazer:** criar Blob/URL temporária na página da extensão e usar download com escolha de destino. Nome sugerido `BiblioColeta/<termo>-<data-hora>/artigos.csv`, com sufixo parcial quando aplicável; sanitizar nome e evitar sobrescrita. Exportar `busca.json` por ação separada. Liberar URL temporária ao concluir/interromper e limpar listeners.

**Aceite:** salvar CSV e JSON, cancelar a janela de destino, exportar novamente e baixar parcial. Só mostrar arquivo salvo após confirmação do download; um ID retornado indica início, não conclusão. Registrar o comportamento real de destino no Windows.

**Prompt específico:** “Implemente somente T11. Não use o filesystem de Node e não escolha silenciosamente uma pasta arbitrária do usuário.”

### T12 — Interface para pessoas leigas

**Ler:** `interface.py`, T09/T11 e fluxo da seção 2.

**Editar:** `app.html`, `app.css`, `app.js` e `worker.js` quando necessário para abertura/preenchimento.

**Fazer:** formulário por termos/URL, captura da busca ativa, data local, aviso da coleção Brasil, progresso, pausa, retomada, cancelamento e exportações. Mostrar resultados com falhas de metadados. Recuperar última coleta e pedir decisão antes de descartá-la. Textos vindos de artigos devem ser inseridos como texto, nunca HTML executável.

**Aceite:** teclado e rótulos funcionam; duplo clique em Iniciar não duplica job; botões refletem estados reais; reabrir permite retomar; página de bloqueio produz mensagem útil; parcial e completo são distinguíveis. Usuário recebe instrução clara para manter a aba aberta.

**Prompt específico:** “Implemente somente T12. Reutilize controlador e exportação; não replique regras de coleta na interface.”

### T13 — Validação integrada e comparação

**Ler:** todas as entregas e testes Python.

**Editar:** testes de integração e `docs/extension/VALIDACAO.md`; correções de código devem ser pequenas e identificadas por tarefa de origem.

**Fazer:** testar extensão carregada em Chromium/Chrome compatível, com fixtures e uma pesquisa real pequena. Comparar IDs e campos com o Python sob as mesmas condições; se a pesquisa ao vivo mudou entre execuções, usar fixtures congeladas para a comparação e explicar diferenças.

**Aceite obrigatório:**

- Fluxo completo até CSV com mais de uma página, filtros e acentos.
- Zero resultados e falha isolada de artigo.
- Pausar, retomar, cancelar, fechar aba de trabalho e reabrir interface.
- Chrome reiniciado: dados confirmados disponíveis e retomada manual.
- Totais inconsistentes, DOM inesperado, perda de acesso e timeout sem falso sucesso.
- Nenhum PDF baixado ou permissão além das justificadas.
- CSV aberto no Excel ou LibreOffice e importado no Google Planilhas.
- Teste manual no Windows registrado com versão do Chrome, consulta, data e resultado.

**Prompt específico:** “Execute somente T13. Não afirme equivalência total sem a comparação de dados e não marque teste Windows como feito num Mac.”

### T14 — Manual e pacote instalável localmente

**Ler:** relatório T13 e README existente.

**Editar:** `docs/extension/INSTALACAO.md`, `PRIVACIDADE.md`, `scripts/package-extension.mjs`, comandos de empacotamento e seção nova do README.

**Fazer:** ensinar baixar ZIP, extrair, abrir `chrome://extensions`, ativar modo de desenvolvedor e selecionar a pasta correta em **Carregar sem compactação**. Explicar coleta, retomada, exportação e como apagar dados locais. Documentar permissões, armazenamento local e acesso somente à SciELO. Empacotar por lista de arquivos permitidos, com `manifest.json` na raiz do ZIP.

**Aceite:** extrair o ZIP em pasta vazia e carregar a extensão a partir dela; nenhum Python, Node, `node_modules`, testes, fixtures ou segredos no pacote. Pessoa leiga consegue seguir os passos. README não promete instalação pela loja enquanto a extensão não estiver publicada.

**Prompt específico:** “Implemente somente T14. Preserve as instruções da versão Windows enquanto a migração não for concluída.”

### T15 — Release da extensão após merge na main

**Ler:** `.github/workflows/windows-app.yml`, script de empacotamento e exigência do usuário de executar somente após merge na `main`.

**Editar:** `.github/workflows/chrome-extension.yml` e documentação de distribuição.

**Fazer:** workflow próprio disparado por `pull_request: closed` para `main`, com condição `merged == true` e checkout do `merge_commit_sha`. Executar testes, empacotar e anexar `BiblioColeta-Chrome.zip` a uma Release. Usar tags `chrome-build-N` para não colidir com o workflow Windows. Permissão de escrita apenas no job de publicação. Reexecução deve atualizar o asset da mesma versão sem duplicar Release.

**Aceite:** PR aberto/fechado sem merge não constrói; merge constrói o SHA correto; teste falho impede publicação; ZIP extraído carrega; release da extensão independe do sucesso do empacotamento Windows. O workflow não publica automaticamente na Chrome Web Store.

**Prompt específico:** “Implemente somente T15. Mantenha a publicação existente do Windows até uma decisão explícita de descontinuação.”

### T16 — Preparar publicação na Chrome Web Store

**Ler:** regras atuais da Chrome Web Store, manifest final e relatório T13.

**Editar:** documentação de publicação, descrição da extensão e materiais da listagem.

**Fazer:** preparar descrição em português, finalidade única, justificativa de cada permissão, política de privacidade coerente com o código, capturas reais, ícones e ZIP revisado. Conferir versão do manifest a cada atualização. Levantar cadastro, verificação e eventual taxa vigente na conta do proprietário.

**Aceite:** checklist de publicação revisado, proprietário identificado e pacote pronto. Conta, pagamento e envio externo dependem do usuário ou de autorização explícita. Não prometer aprovação ou prazo de revisão. Manter instalação local utilizável enquanto aguarda revisão.

**Prompt específico:** “Prepare somente T16. Não crie conta, aceite termos ou envie a extensão à loja sem autorização.”

## 8. Critério para considerar a migração pronta

A extensão substitui o fluxo de uso principal quando uma pessoa no Windows consegue instalar, coletar uma pesquisa real com paginação, obter os metadados, retomar uma interrupção e abrir o CSV corretamente. T01 e T13 precisam ter evidência real; testes unitários sozinhos não fecham a migração.

O pacote Python permanece disponível até essa validação. Publicação na loja é uma entrega adicional: a primeira versão pode ser validada por instalação local, sem afirmar que já está disponível para instalação por um clique.

## 9. Fontes oficiais para consulta durante a implementação

Consultadas para o planejamento em 02/10/2026. Reconsultar na tarefa correspondente se APIs, permissões ou políticas tiverem mudado.

- [Criar e carregar uma extensão local](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world).
- [Injeção de funções e resultados com scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting).
- [Content scripts e isolamento](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts).
- [Ciclo de vida e encerramento do service worker](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle).
- [Downloads e escolha de destino](https://developer.chrome.com/docs/extensions/reference/api/downloads).
- [Permissões de extensão](https://developer.chrome.com/docs/extensions/reference/api/permissions).
- [Acesso de rede e permissões de hosts](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests).
- [Publicação na Chrome Web Store](https://developer.chrome.com/docs/webstore/publish).
