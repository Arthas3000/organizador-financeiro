# Organizador Financeiro

## O que é

App pessoal de finanças: registra receitas e despesas, mostra saldo por conta, gastos do mês, extrato e análise. Roda só no navegador (HTML, CSS e JavaScript puros), sem servidor e sem dependências. Instalado no iPhone como PWA.

## Rodar localmente

Na pasta do projeto:

```
python3 -m http.server 8000
```

Depois abra `http://localhost:8000` no navegador.

## Publicar no GitHub Pages

1. Suba o projeto para um repositório no GitHub (branch `main`).
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

Importação de PDF fica para a próxima versão.

Para lançar pelo Atalho do iOS, use **Mais → Colar lançamentos → Como configurar o Atalho**.

## Atualizar versão

1. Altere os arquivos do projeto.
2. Em `sw.js`, aumente o valor da constante `V` (por exemplo, de `v1` para `v2`). É isso que faz o celular baixar a nova versão.
3. Envie as mudanças para `main` (ou faça o commit e o push).
4. No iPhone, abra o app e aguarde. Se a versão antiga continuar, feche o app e abra de novo.
