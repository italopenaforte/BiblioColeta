# Dados usados pela extensão

O BiblioColeta acessa páginas de `search.scielo.org` e `scielo.br` para ler resultados e metadados de artigos. Ele não lê todas as páginas visitadas nem baixa PDFs.

A pesquisa, a data e os registros coletados ficam no armazenamento local do perfil do Chrome. A extensão não envia esses dados a um servidor próprio. O CSV e o JSON são baixados para o destino escolhido pelo usuário.

A extensão precisa das permissões `scripting` para ler o conteúdo das páginas da SciELO, `downloads` para salvar os arquivos e acesso somente aos domínios indicados no manifesto. O armazenamento local das coletas usa IndexedDB.

Dados de uma coleta antiga permanecem no perfil até que você clique em **Apagar esta coleta do navegador** ou remova a extensão. Exporte os arquivos necessários antes de apagá-los.
