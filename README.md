# BiblioColeta

O BiblioColeta é uma extensão do Chrome que reúne os artigos de uma pesquisa da **SciELO Brasil** em uma planilha. Você faz a pesquisa no site da SciELO, aplica os filtros que quiser e usa a extensão para coletar os resultados. Os PDFs não são baixados.

## Instalar e usar

Siga o [guia passo a passo com fotos reais](docs/extension/INSTALACAO.md) para instalar a versão de teste no Chrome. A extensão ainda não está na Chrome Web Store.

Depois de instalar:

1. Faça a pesquisa no [site da SciELO](https://search.scielo.org/) e deixe os resultados abertos.
2. Clique no ícone **BiblioColeta** no Chrome, confira o endereço da pesquisa e clique em **Iniciar coleta**.
3. Espere a mensagem **Coleta concluída** e clique em **Baixar planilha**. O arquivo `artigos.csv` pode ser aberto no Excel, LibreOffice ou Google Planilhas.

Se a coleta parar, a página permite retomá-la e copiar a mensagem de erro para pedir ajuda. Os registros já coletados ficam guardados neste perfil do Chrome até você apagá-los.

## Para quem desenvolve ou distribui

A extensão está na pasta [`extension/`](extension/). Os testes usam Node.js 22 ou mais recente. Para verificar e criar o pacote:

```bash
npm test
npm run package:chrome
```

O segundo comando cria `BiblioColeta-Chrome.zip` na raiz do projeto, com apenas os arquivos da extensão. Não há dependências de desenvolvimento no pacote. O workflow [Criar extensão Chrome](.github/workflows/chrome-extension.yml) executa esses comandos e anexa o ZIP a uma Release quando um pull request é mesclado na `main`.

Leia também [privacidade](docs/extension/PRIVACIDADE.md) e [estado da validação](docs/extension/VALIDACAO.md). A coleta real com a SciELO e o uso no Chrome ainda precisam de validação documentada antes de apresentar a extensão como pronta para publicação na loja.
