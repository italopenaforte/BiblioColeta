# Prova técnica com a SciELO

Estado: **pendente de execução em um Chrome com acesso normal à SciELO**.

Em 02/10/2026, a consulta direta a `search.scielo.org` neste ambiente respondeu HTTP 403 e entregou uma página “Establishing a secure connection” do serviço de proteção. O Chromium instalado localmente não iniciou por erro do macOS no serviço MachPortRendezvousServer. Não há evidência de leitura de resultados ou artigos reais pela extensão neste ambiente.

## Procedimento no Chrome

1. Carregue a pasta `extension/` em `chrome://extensions` usando **Carregar sem compactação**.
2. Faça uma pesquisa pequena na SciELO Brasil com pelo menos 51 resultados e aplique um filtro.
3. Clique no ícone do BiblioColeta. Confirme a URL e inicie a coleta.
4. Observe se o total, IDs, títulos e links são lidos na primeira e na segunda página.
5. Observe se um artigo com metatags fornece autores, ano e resumo.
6. Baixe CSV e JSON; confira total, quantidade de registros e estado de completude.
7. Repita com uma busca de zero resultados e com uma pesquisa de apenas um artigo.

Registrar aqui a data, versão do Chrome, URL de busca sem dados privados, resultado de cada passo e qualquer redirecionamento ou domínio adicional. Se a página mostrar desafio de acesso, registrar o bloqueio; não tratar isso como resultado zero nem tentar contorná-lo.
