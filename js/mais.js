// Tela Mais: ferramentas (colar, backup), organização (contas, categorias, recorrentes), app.
import { app } from './app.js';
import { abrirFolha, escolher, confirmar, toast, h, esc } from './ui.js';
import { parseColar, toCSV, fmt, hoje, jaLancado } from './logica.js';
import { adicionar, encerrarRegra, validarBackup, apagarConta, apagarCategoria, completarRecorrentes } from './estado.js';
import { abrirConta, abrirCategoria, escolherConta } from './cadastros.js';

if (!document.getElementById('css-mais')) {
  const s = document.createElement('style');
  s.id = 'css-mais';
  s.textContent = `
.mais button.it { width: 100%; text-align: left; border-radius: 0; touch-action: manipulation; }
.mais button.it:active, .fl button.it:active { background: color-mix(in srgb, var(--t) 6%, transparent); }
.mais button.it[disabled] { opacity: .45; }
.fl button.it { width: 100%; text-align: left; }
.it .ch { color: var(--t2); flex: none; }
.mais .rod { text-align: center; font-size: 12px; color: var(--t2); margin: 14px 0 4px; }
.fl .cola { display: block; width: 100%; min-height: 110px; resize: vertical; border: 0; border-radius: 16px; padding: 12px; background: var(--card); outline: 0; }
.fl .ln { text-decoration: line-through; color: var(--t2); }
.fl .it[aria-pressed=false] { opacity: .55; }
.fl .mot { color: var(--red); text-decoration: none; display: block; font-size: 12px; }
.fl details { margin-top: 16px; background: var(--card); border-radius: 22px; padding: 4px 14px; }
.fl summary { min-height: 44px; display: flex; align-items: center; font-weight: 500; }
.fl details ol { margin: 0 0 12px; padding-left: 20px; color: var(--t2); font-size: 14px; }
.fl details li { margin-bottom: 6px; }
.fl details code { font-size: 13px; color: var(--t); overflow-wrap: anywhere; }
`;
  document.head.append(s);
}

const CH = '<svg class="ch" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
const dataBR = iso => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');
const linha = (id, txt, ret = '', dis = '') => `<button class="it" data-a="${id}"${dis}><span class="tx"><b>${txt}</b>${ret}</span>${CH}</button>`;

export function render(el) {
  const e = app.est;
  el.classList.add('mais');
  el.innerHTML = `<h1 class="big">Mais</h1>
    <div class="lab">Ferramentas</div>
    <div class="card lista">
      ${linha('colar', 'Colar lançamentos')}
      ${linha('pdf', 'Importar extrato PDF', '<small class="hint" style="text-align:left;margin:0">em breve</small>', ' disabled')}
      ${linha('backup', 'Exportar backup')}
      ${linha('csv', 'Exportar CSV')}
      ${linha('restaurar', 'Restaurar backup')}
    </div>
    <div class="lab">Organização</div>
    <div class="card lista">
      ${linha('contas', 'Contas', `<small class="hint" style="text-align:left;margin:0">${e.contas.length}</small>`)}
      ${linha('categorias', 'Categorias', `<small class="hint" style="text-align:left;margin:0">${e.categorias.length}</small>`)}
      ${linha('recorrentes', 'Recorrentes', `<small class="hint" style="text-align:left;margin:0">${ativas().length}</small>`)}
    </div>
    <p class="rod">${e.ultimoBackup ? `Último backup: ${esc(dataBR(e.ultimoBackup))}` : 'Nenhum backup feito ainda'}</p>`;
  el.onclick = ev => {
    const b = ev.target.closest('button[data-a]');
    if (b) ({ colar, backup, csv, restaurar, contas, categorias, recorrentes })[b.dataset.a]?.();
  };
}

// ---------- compartilhar / baixar ----------
async function entregar(texto, nome, tipo, marcaBackup) {
  const arq = new File([texto], nome, { type: tipo });
  if (navigator.canShare?.({ files: [arq] })) {
    try { await navigator.share({ files: [arq] }); } catch (err) { if (err.name === 'AbortError') return; throw err; }
  } else {
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(arq), download: nome });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  if (marcaBackup) { app.est.ultimoBackup = app.hoje; app.salvarERender(); }
  toast('Arquivo pronto');
}

const backup = () => {
  const est = { ...app.est, ultimoBackup: app.hoje };
  return entregar(JSON.stringify(est), `organizador-${app.hoje}.json`, 'application/json', true).catch(() => toast('Não foi possível exportar'));
};
const csv = () => entregar(toCSV(app.est), `organizador-${app.hoje}.csv`, 'text/csv').catch(() => toast('Não foi possível exportar'));

function restaurar() {
  const inp = Object.assign(document.createElement('input'), { type: 'file', accept: 'application/json,.json' });
  inp.onchange = async () => {
    const arq = inp.files[0]; if (!arq) return;
    const r = validarBackup(await arq.text());
    if (!r.ok) return toast(r.erro);
    const { contas, lancamentos, ultimoBackup } = r.resumo;
    const resumo = `${contas} contas, ${lancamentos} lançamentos${ultimoBackup ? `, backup de ${dataBR(ultimoBackup).slice(0, 5)}` : ''}. Isso substitui tudo o que está no app.`;
    if (!await confirmar('Restaurar backup?', resumo, 'Substituir tudo', true)) return;
    app.est = r.est;
    completarRecorrentes(app.est, app.hoje);
    app.salvarERender();
    toast('Backup restaurado');
  };
  inp.click();
}

// ---------- colar ----------
function colar() {
  let linhas = [];
  const f = abrirFolha(h(`<div class="fl"><p class="tit">Colar lançamentos</p>
    <textarea class="cola" aria-label="Lançamentos" placeholder="45,90;Padaria;C6&#10;+1200;Salário;Itaú" autocapitalize="none" autocorrect="off" spellcheck="false"></textarea>
    <button class="btn sec" data-col style="margin-top:8px">Colar da área de transferência</button>
    <div class="prev"></div>
    <button class="btn" data-ok disabled>Lançar</button>
    <details><summary>Como configurar o Atalho</summary>
      <ol>
        <li>No app Atalhos, abra a aba <b>Automação</b> e toque em <b>+</b>.</li>
        <li>Escolha <b>Transação</b> (Carteira) e selecione seus cartões. Marque <b>Executar imediatamente</b>.</li>
        <li>Adicione a ação <b>Texto</b> com <code>[Valor];[Comerciante];[Cartão]</code>, usando as variáveis do gatilho.</li>
        <li>Adicione <b>Copiar para a área de transferência</b>.</li>
        <li>Ao pagar, abra o app, vá em Mais → Colar lançamentos e toque em Colar. Dê o mesmo nome do cartão à conta, ou use a sigla.</li>
        <li><b>Variante SMS:</b> crie outra automação com gatilho <b>Mensagem</b>, que contém <code>compra</code>, e use as mesmas ações de texto e cópia.</li>
      </ol></details></div>`));
  const q = s => f.el.querySelector(s);
  const ta = q('.cola'), ok = q('[data-ok]'), prev = q('.prev');

  // duplicata (já existe igual no app) começa desmarcada; tocar na linha alterna
  const dup = l => !!l.lanc && !l.contaPendente && jaLancado(app.est.lancamentos, l.lanc);
  const inclui = l => l.lanc && !l.contaPendente && (l.incluir ?? !dup(l));
  const pintar = () => {
    const n = linhas.filter(inclui).length;
    prev.innerHTML = linhas.length ? `<div class="lab">Prévia</div><div class="card lista">${linhas.map((l, i) => {
      if (l.erro) return `<div class="it"><span class="tx ln"><b>${esc(l.linha)}</b><small class="mot">${esc(l.erro)}</small></span></div>`;
      const { lanc } = l, c = app.est.contas.find(x => x.id === lanc.contaId);
      const v = (lanc.tipo === 'entrada' ? '+' : '−') + fmt(lanc.valor);
      const d = dup(l);
      return `<button class="it" data-i="${i}"${d ? ` aria-pressed="${inclui(l)}"` : ''}><span class="tx"><b>${esc(lanc.desc)}</b><small>${esc(dataBR(lanc.data))}${l.contaPendente ? ' · <span style="color:var(--red)">escolher conta</span>' : ''}${d ? ` · <span style="color:var(--red)">já lançado${inclui(l) ? ' (será lançado de novo)' : ' · toque para lançar mesmo assim'}</span>` : ''}</small></span>`
        + (c ? `<i class="bk" style="background:${esc(c.cor)}">${esc(c.sigla)}</i>` : '') + `<span class="v">${v}</span></button>`;
    }).join('')}</div>` : '';
    ok.disabled = !n;
    ok.textContent = n ? `Lançar ${n}` : 'Lançar';
  };
  const ler = () => { linhas = parseColar(ta.value, app.est.contas, app.est.categorias, app.hoje); pintar(); };

  ta.addEventListener('input', ler);
  q('[data-col]').addEventListener('click', async () => {
    try { ta.value = await navigator.clipboard.readText(); ler(); } catch { ta.focus(); }
  });
  prev.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-i]'); if (!b) return;
    const l = linhas[b.dataset.i];
    if (!l.contaPendente) { if (dup(l)) { l.incluir = !inclui(l); pintar(); } return; }
    const id = await escolherConta();
    if (id) { l.lanc.contaId = id; l.contaPendente = false; pintar(); }
  });
  ok.addEventListener('click', () => {
    const certas = linhas.filter(inclui);
    for (const l of certas) adicionar(app.est, l.lanc, 'unico', app.hoje);
    app.salvarERender();
    f.fechar();
    toast(`${certas.length} ${certas.length === 1 ? 'lançamento adicionado' : 'lançamentos adicionados'}`);
  });
}

// ---------- cadastros e recorrentes ----------
// folha com lista que se redesenha após cada ação (as folhas de edição empilham por cima)
function folhaLista({ titulo, itens, vazio, nova, aoTocar }) {
  const f = abrirFolha(h('<div class="fl"></div>'));
  const raiz = f.el.querySelector('.fl');
  const pintar = () => {
    const l = itens();
    raiz.innerHTML = `<p class="tit">${esc(titulo)}</p>` + (l.length
      ? `<div class="card lista">${l.map(i => `<button class="it" data-id="${esc(i.id)}">${i.marca ?? ''}<span class="tx"><b>${esc(i.nome)}</b>${i.sub ? `<small>${esc(i.sub)}</small>` : ''}</span>${i.dir ? `<span class="v">${esc(i.dir)}</span>` : ''}</button>`).join('')}</div>`
      : `<div class="vazio"><b>${esc(vazio)}</b></div>`)
      + (nova ? `<button class="btn sec" data-nova style="margin-top:12px">${esc(nova.rotulo)}</button>` : '');
  };
  raiz.addEventListener('click', async ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if ('nova' in b.dataset) await nova.criar();
    else if (b.dataset.id) await aoTocar(b.dataset.id);
    pintar();
  });
  pintar();
}

// transferências com OUTRAS contas somem junto e mudam o saldo delas
const transfs = id => {
  const n = app.est.lancamentos.filter(l => l.tipo === 'transf' && (l.contaId === id || l.paraId === id)).length;
  return n ? ` ${n === 1 ? '1 transferência ligada' : `${n} transferências ligadas`} a ela também ${n === 1 ? 'será apagada' : 'serão apagadas'}, e o saldo das outras contas muda.` : '';
};

const contas = () => folhaLista({
  titulo: 'Contas',
  itens: () => app.est.contas.map(c => ({ id: c.id, nome: c.nome, marca: `<i class="bk" style="background:${esc(c.cor)}">${esc(c.sigla)}</i>` })),
  vazio: 'Nenhuma conta',
  nova: { rotulo: '+ Nova conta', criar: () => abrirConta() },
  async aoTocar(id) {
    const c = app.est.contas.find(x => x.id === id);
    const a = await escolher(c.nome, [{ rotulo: 'Editar', valor: 'e' }, { rotulo: 'Apagar', valor: 'a' }]);
    if (a === 'e') await abrirConta(c);
    else if (a === 'a' && await confirmar('Apagar conta?', `Os lançamentos e recorrentes de "${c.nome}" também serão apagados.${transfs(id)} Isso não pode ser desfeito.`, 'Apagar conta', true)) {
      apagarConta(app.est, id);
      app.salvarERender();
    }
  },
});

const categorias = () => folhaLista({
  titulo: 'Categorias',
  itens: () => app.est.categorias.map(c => ({ id: c.id, nome: c.nome, marca: `<i class="dot" style="background:${esc(c.cor)}"></i>` })),
  vazio: 'Nenhuma categoria',
  nova: { rotulo: '+ Nova categoria', criar: () => abrirCategoria() },
  async aoTocar(id) {
    const c = app.est.categorias.find(x => x.id === id);
    const a = await escolher(c.nome, [{ rotulo: 'Editar', valor: 'e' }, { rotulo: 'Apagar', valor: 'a' }]);
    if (a === 'e') await abrirCategoria(c);
    else if (a === 'a' && await confirmar('Apagar categoria?', `Os lançamentos de "${c.nome}" ficam sem categoria.`, 'Apagar categoria', true)) {
      apagarCategoria(app.est, id);
      app.salvarERender();
    }
  },
});

const ativas = () => app.est.regras.filter(r => !r.fim || r.fim > app.hoje);

const recorrentes = () => folhaLista({
  titulo: 'Recorrentes',
  itens: () => ativas().map(r => {
    const c = app.est.contas.find(x => x.id === r.contaId);
    return { id: r.id, nome: r.desc, sub: `${(r.freq ?? 1) === 1 ? 'Todo mês' : r.freq === 6 ? 'A cada 6 meses' : 'Todo ano'}, dia ${r.dia}${c ? ` · ${c.nome}` : ''}`, dir: (r.tipo === 'entrada' ? '+' : '−') + fmt(r.valor) };
  }),
  vazio: 'Nenhum lançamento recorrente',
  async aoTocar(id) {
    const r = app.est.regras.find(x => x.id === id);
    const [y, m, d] = app.hoje.split('-').map(Number);
    const amanha = hoje(new Date(y, m - 1, d + 1));
    if (await confirmar(`Encerrar "${r.desc}"?`, 'As ocorrências futuras serão apagadas. As de hoje para trás ficam.', 'Encerrar', true)) {
      encerrarRegra(app.est, id, amanha);
      app.salvarERender();
    }
  },
});
