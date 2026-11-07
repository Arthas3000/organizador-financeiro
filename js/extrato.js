// Extrato (spec §6.2): mês com setas/deslize, filtros, lista por dia, arrastar para apagar.
import { app } from './app.js';
import { esc, escolher, toast } from './ui.js';
import { apagarDesfazivel } from './estado.js';
import { filtrar, fmt, mesDe, addMeses, hoje } from './logica.js';
import { abrirLancamento } from './lancamento.js';

const reduzido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const espera = ms => new Promise(r => setTimeout(r, reduzido() ? 0 : ms));

document.head.append(Object.assign(document.createElement('style'), { textContent: `
.ext-nav { display: flex; align-items: center; justify-content: space-between; margin: 0 0 8px; }
.ext-nav .big { margin: 6px 4px; }
.ext-nav button { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 50%; font-size: 26px; color: var(--blue); }
.ext-nav .set { display: flex; }
.ext-chips { margin: 0 -16px 4px; padding: 2px 16px; }
.chip .x { display: inline-block; margin: 0 -6px 0 4px; padding: 0 6px; opacity: .7; }
.chip.ativo { background: var(--t); color: var(--bg); }
.ext-busca { display: block; width: 100%; height: 44px; margin: 8px 0 0; padding: 0 16px; border: 0; outline: 0; border-radius: 999px; background: var(--card); }
.ext-corpo .card { padding: 0; overflow: hidden; }
.ext-corpo .lab b { font-weight: 600; }
.lin { position: relative; overflow: hidden; border-bottom: 1px solid var(--sep); }
.lin:last-child { border-bottom: 0; }
.lin .del { position: absolute; inset: 0; display: flex; align-items: center; justify-content: flex-end; padding-right: 22px; background: var(--red); color: #fff; font-weight: 600; opacity: 0; transition: opacity .3s; }
.lin:has(> .lin-c[style*="translateX"]) .del { opacity: 1; }
.lin > .lin-c { position: relative; padding: 10px 14px; background: var(--card); border-bottom: 0; cursor: pointer; }
.lin > .lin-c:active { background: color-mix(in srgb, var(--t) 6%, var(--card)); }
.lin .dot { width: 8px; height: 8px; display: inline-block; margin-right: 5px; }
.ext-prev { opacity: .7; }
` }));

// ---------- estado da tela ----------
let mes, f = { contaId: '', catId: '', tipo: '', q: '' }, busca = false;
const TIPOS = [['', 'Todos'], ['saida', 'Saídas'], ['entrada', 'Entradas'], ['transf', 'Transferências'], ['parcela', 'Parcelas'], ['assinatura', 'Assinaturas']];

const dia = iso => new Date(iso + 'T12:00');
const maiuscula = s => s[0].toUpperCase() + s.slice(1);
const tituloMes = m => maiuscula(dia(m + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(' de ', ' '));
const curta = iso => dia(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
function rotuloDia(iso) {
  if (iso === app.hoje) return 'Hoje';
  if (iso === addDia(app.hoje, -1)) return 'Ontem';
  return dia(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
}
const addDia = (iso, n) => { const d = dia(iso); d.setDate(d.getDate() + n); return hoje(d); };

// ---------- linha (também usada no Início) ----------
export function linha(l, comData) {
  const est = app.est;
  const conta = id => est.contas.find(c => c.id === id) ?? { sigla: '?', cor: '#636366' };
  const c = conta(l.contaId), cat = est.categorias.find(x => x.id === l.catId);
  const sub = [];
  if (l.tipo === 'transf') sub.push(`${esc(c.sigla)} → ${esc(conta(l.paraId).sigla)}`);
  else sub.push(cat ? `<i class="dot" style="background:${esc(cat.cor)}"></i>${esc(cat.nome)}` : 'Sem categoria');
  if (l.parcela) sub.push(l.parcela[1] > l.parcela[0] ? `faltam ${l.parcela[1] - l.parcela[0]}` : 'última');
  else if (l.regraId) sub.push('mensal');
  if (comData) sub.push(curta(l.data));
  const v = l.tipo === 'transf' ? `<span class="t2">${fmt(l.valor)}</span>`
    : l.tipo === 'entrada' ? `<span class="pos">+${fmt(l.valor)}</span>` : `−${fmt(l.valor)}`;
  return `<div class="lin" data-id="${esc(l.id)}"><div class="del" aria-hidden="true">Apagar</div>
    <div class="it lin-c" data-id="${esc(l.id)}" role="button" tabindex="0">
      <i class="bk" style="background:${esc(c.cor)}">${esc(c.sigla)}</i>
      <div class="tx"><b>${esc(l.desc || (l.tipo === 'transf' ? 'Transferência' : 'Sem descrição'))}</b>${l.parcela ? `<span class="tag">${l.parcela[0]}/${l.parcela[1]}</span>` : ''}
        <small>${sub.join(' · ')}</small></div>
      <div class="v">${v}</div></div></div>`;
}

// ---------- desenho ----------
function chip(k, rotulo, ativoTxt) {
  return `<button class="chip ${ativoTxt ? 'ativo' : ''}" data-chip="${k}">${esc(ativoTxt || rotulo)}${ativoTxt ? '<span class="x" data-x aria-label="Limpar">×</span>' : ''}</button>`;
}

function cabecalho() {
  const conta = app.est.contas.find(c => c.id === f.contaId), cat = app.est.categorias.find(c => c.id === f.catId);
  const tipo = TIPOS.find(t => t[0] === f.tipo);
  return `<div class="ext-nav"><h1 class="big">${tituloMes(mes)}</h1>
      <div class="set"><button data-m="-1" aria-label="Mês anterior">‹</button><button data-m="1" aria-label="Próximo mês">›</button></div></div>
    <div class="chips ext-chips">${chip('contaId', 'Conta', conta?.nome)}${chip('catId', 'Categoria', cat?.nome)}${chip('tipo', 'Tipo', f.tipo && tipo[1])}${chip('q', 'Buscar', f.q && `“${f.q}”`)}</div>
    ${busca ? `<input class="ext-busca" type="search" placeholder="Buscar descrição" aria-label="Buscar" enterkeyhint="search" autocomplete="off" value="${esc(f.q)}">` : ''}`;
}

function corpo() {
  const hj = app.hoje, ls = filtrar(app.est.lancamentos, { mes, ...f });
  if (!ls.length) {
    const filtrado = f.contaId || f.catId || f.tipo || f.q;
    return `<div class="vazio"><b>${filtrado ? 'Nada encontrado' : 'Nenhum lançamento neste mês'}</b>${filtrado ? 'Tente outros filtros.' : ''}</div>
      ${filtrado ? '' : '<button class="btn" data-novo style="max-width:260px;margin:0 auto">Novo lançamento</button>'}`;
  }
  const grupos = new Map();
  for (const l of ls.filter(x => x.data <= hj)) (grupos.get(l.data) ?? grupos.set(l.data, []).get(l.data)).push(l);
  let html = '';
  for (const [d, itens] of grupos) {
    const t = itens.reduce((s, l) => s + (l.tipo === 'entrada' ? l.valor : l.tipo === 'saida' ? -l.valor : 0), 0);
    html += `<div class="lab"><span>${esc(rotuloDia(d))}</span><b class="num ${t > 0 ? 'pos' : ''}">${t > 0 ? '+' : ''}${fmt(t)}</b></div><div class="card lista">${itens.map(l => linha(l)).join('')}</div>`;
  }
  const prev = ls.filter(x => x.data > hj).reverse();
  if (prev.length) html += `<div class="lab"><span>Previstos</span></div><div class="card lista ext-prev">${prev.map(l => linha(l, true)).join('')}</div>`;
  return html;
}

export function render(el) {
  mes ??= mesDe(app.hoje);
  // conta/categoria apagada (ou backup restaurado): o filtro some junto
  if (f.contaId && !app.est.contas.some(c => c.id === f.contaId)) f.contaId = '';
  if (f.catId && !app.est.categorias.some(c => c.id === f.catId)) f.catId = '';
  if (!el.dataset.ok) { el.dataset.ok = '1'; ligar(el); }
  const y = el.scrollTop;
  el.innerHTML = `${cabecalho()}<div class="ext-corpo">${corpo()}</div>`;
  el.scrollTop = y;
}

const redesenhaLista = el => { el.querySelector('.ext-corpo').innerHTML = corpo(); };

function mudarMes(el, delta) {
  mes = mesDe(addMeses(mes + '-01', delta));
  render(el);
  if (!reduzido()) el.querySelector('.ext-corpo').animate(
    [{ transform: `translateX(${delta * 48}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }],
    { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)' });
}

async function escolherFiltro(el, k) {
  const { contas, categorias } = app.est;
  const ops = {
    contaId: ['Conta', contas.map(c => ({ valor: c.id, rotulo: c.nome })), 'Todas'],
    catId: ['Categoria', categorias.map(c => ({ valor: c.id, rotulo: c.nome })), 'Todas'],
    tipo: ['Tipo', TIPOS.slice(1).map(([valor, rotulo]) => ({ valor, rotulo })), 'Todos'],
  }[k];
  const v = await escolher(ops[0], [{ valor: '', rotulo: ops[2] }, ...ops[1]]);
  if (v === null) return;
  f[k] = v; render(el);
}

// ---------- gestos e cliques ----------
function ligar(el) {
  let suprime = false;
  el.style.touchAction = 'pan-y'; // o navegador rola na vertical; o horizontal é nosso

  el.addEventListener('click', e => {
    if (suprime) return;
    const t = e.target;
    if (t.closest('[data-m]')) return mudarMes(el, +t.closest('[data-m]').dataset.m);
    const ch = t.closest('[data-chip]');
    if (ch) {
      const k = ch.dataset.chip;
      if (t.closest('[data-x]')) { f[k] = ''; if (k === 'q') busca = false; return render(el); }
      if (k === 'q') { busca = !busca || !!f.q; render(el); return el.querySelector('.ext-busca')?.focus(); }
      return escolherFiltro(el, k);
    }
    if (t.closest('[data-novo]')) return abrirLancamento();
    const row = t.closest('.lin-c');
    if (row) { const l = app.est.lancamentos.find(x => x.id === row.dataset.id); if (l) abrirLancamento(l); }
  });
  el.addEventListener('input', e => {
    if (!e.target.matches('.ext-busca')) return;
    f.q = e.target.value; redesenhaLista(el);
    // o chip de busca reflete o texto sem perder o foco do campo
    el.querySelector('[data-chip=q]').outerHTML = chip('q', 'Buscar', f.q && `“${f.q}”`);
  });
  el.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.lin-c')) { e.preventDefault(); e.target.click(); }
    if (e.key === 'Escape' && e.target.matches('.ext-busca')) { f.q = ''; busca = false; render(el); el.querySelector('[data-chip=q]').focus(); } // limpa a busca pelo teclado
  });

  // um gesto horizontal: sobre uma linha, para a esquerda = apagar; fora disso = trocar de mês
  let g = null;
  el.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button) return;
    if (e.target.closest('.chips,input,button:not(.lin-c)')) return;
    g = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId, row: e.target.closest('.lin'), modo: null, dx: 0 };
  });
  el.addEventListener('pointermove', e => {
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.modo) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dy) > Math.abs(dx)) { g = null; return; }
      g.modo = g.row && dx < 0 ? 'row' : 'mes';
      g.alvo = g.modo === 'row' ? g.row.querySelector('.lin-c') : el.querySelector('.ext-corpo');
      g.alvo.style.transition = 'none';
      el.setPointerCapture(e.pointerId);
    }
    g.dx = dx;
    g.alvo.style.transform = `translateX(${g.modo === 'row' ? Math.min(0, dx) : dx * .5}px)`;
    if (g.modo === 'mes') g.alvo.style.opacity = 1 - Math.min(Math.abs(dx) / 400, .4);
  });
  const soltar = async e => {
    if (!g || e.pointerId !== g.id) return;
    const { modo, alvo, row, dx } = g, v = dx / Math.max(e.timeStamp - g.t, 1);
    g = null;
    if (!modo) return;
    suprime = true; setTimeout(() => suprime = false, 60);
    const volta = () => { alvo.style.transition = 'transform .4s cubic-bezier(.32,.72,0,1), opacity .3s'; alvo.style.transform = ''; alvo.style.opacity = ''; };
    if (e.type === 'pointercancel') return volta();
    if (modo === 'mes') {
      if (Math.abs(dx) > 70 || Math.abs(v) > .5) { alvo.style.transition = ''; alvo.style.transform = alvo.style.opacity = ''; return mudarMes(el, dx < 0 ? 1 : -1); }
      return volta();
    }
    if (-dx < row.offsetWidth * .4) return volta();
    alvo.style.transition = 'transform .22s cubic-bezier(.2,.8,.2,1)'; alvo.style.transform = 'translateX(-100%)';
    await espera(200);
    row.style.height = row.offsetHeight + 'px'; void row.offsetHeight;
    row.style.transition = 'height .25s cubic-bezier(.2,.8,.2,1)'; row.style.height = '0px'; row.style.borderBottomWidth = '0';
    await espera(250);
    const desfazer = apagarDesfazivel(app.est, row.dataset.id, 'um', app.hoje); // parcela/ocorrência: só esta
    app.salvarERender();
    toast('Lançamento apagado', { acao: 'Desfazer', onAcao: () => { app.est = desfazer(app.est); app.salvarERender(); } });
  };
  el.addEventListener('pointerup', soltar);
  el.addEventListener('pointercancel', soltar);
}
