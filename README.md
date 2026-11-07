# Organizador Financeiro

## O que é

App pessoal de finanças: registra receitas e despesas, mostra saldo por conta, gastos do mês, extrato e análise. Roda só no navegador (HTML, CSS e JavaScript puros), sem servidor e sem dependências. Instalado no iPhone como PWA.

## Publicar no GitHub Pages

1. Crie um repositório no GitHub e envie para ele **o conteúdo desta pasta** (os arquivos dela ficam na raiz do repositório, branch `main`).
2. No repositório, vá em **Settings → Pages**.
3. Em **Build and deployment**, escolha **Deploy from a branch**.
4. Em **Branch**, escolha `main` e a pasta `/ (root)`. Clique em **Save**.
5. Aguarde alguns minutos. O endereço aparece na mesma tela (`https://<usuario>.github.io/<repositorio>/`).

## Instalar no iPhone

1. Abra o endereço do GitHub Pages no **Safari**.
2. Toque em **Compartilhar** → **Adicionar à Tela de Início**.
3. Abra o app pelo ícone na tela inicial.

Os dados ficam só no celular, dentro do app instalado. O Safari usa outro armazenamento, então os dados do navegador não aparecem no app.

## Backup

Os dados não são sincronizados. Para guardar uma cópia:

1. No app, vá em **Mais → Exportar backup**.
2. Guarde o arquivo gerado (por exemplo, no iCloud Drive ou no computador).

Para trocar de aparelho (computador ↔ celular), use um de cada vez: exporte no aparelho que estava usando, leve o arquivo (AirDrop, iCloud Drive, e-mail) e use **Mais → Restaurar backup** no outro. Restaurar substitui tudo o que está no aparelho que recebe.

Importação de PDF fica para a próxima versão.

Para lançar pelo Atalho do iOS, use **Mais → Colar lançamentos → Como configurar o Atalho**.

## Atualizar versão

1. Altere os arquivos do app.
2. Em `sw.js`, aumente o valor da constante `V` (por exemplo, de `v1` para `v2`). É isso que faz o celular baixar a nova versão.
3. Envie os arquivos alterados para o repositório do GitHub.
4. No iPhone, abra o app e aguarde. Se a versão antiga continuar, feche o app e abra de novo.
