# Instalar a versão de teste no Chrome

Esta versão é instalada manualmente. Ela ainda não está na Chrome Web Store.

1. Baixe `BiblioColeta-Chrome.zip` da Release da extensão ou peça o pacote à pessoa responsável.
2. Extraia o ZIP em uma pasta que você manterá no computador. Dentro dela deve existir `manifest.json`.
3. Abra o Chrome e digite `chrome://extensions` na barra de endereços.
4. Ative **Modo do desenvolvedor** no canto superior direito.
5. Clique em **Carregar sem compactação** e selecione a pasta que contém `manifest.json`.
6. Fixe o ícone do BiblioColeta na barra do Chrome pelo menu de extensões, se desejar.

Para usar:

1. Faça sua busca e aplique os filtros em `search.scielo.org`.
2. Com a página de resultados aberta, clique no ícone do BiblioColeta.
3. Confira o endereço e a data. Clique em **Iniciar coleta**.
4. Mantenha Chrome e a aba do BiblioColeta abertos. A extensão abrirá outra aba para ler os resultados e artigos.
5. Ao concluir, clique em **Baixar planilha CSV**. O Chrome perguntará onde salvar. O botão **Baixar dados da busca** salva um JSON com data, URL e totais.

Se a coleta for interrompida, abra o BiblioColeta e clique em **Retomar**. Os registros confirmados ficam neste perfil do Chrome. O botão de download indica `-parcial` quando a coleta ainda não foi concluída. Não interprete um CSV parcial como resultado completo.

Se a SciELO mostrar uma verificação de acesso ou mudar a página, a extensão pode interromper a coleta. Leia a mensagem na tela. Não há mecanismo para contornar bloqueios da SciELO.

Para atualizar uma instalação local, substitua os arquivos da pasta e clique em **Atualizar** no cartão da extensão em `chrome://extensions`. Preserve seu perfil do Chrome para manter coletas salvas; remova a extensão somente após exportar o que precisar.
