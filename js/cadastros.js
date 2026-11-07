// Cadastros: conta e categoria (spec §6.6) e seletores com "+ Nova".
import { app } from './app.js';
import { abrirFolha, h, esc } from './ui.js';
import { salvarConta, salvarCategoria } from './estado.js';
import { parseValor, hoje } from './logica.js';

export const CORES = ['#0071e3', '#0c8ea5', '#1e9e45', '#7a9a0a', '#d97706', '#e0531f', '#d70015', '#c4285a', '#8e3ec4', '#636366'];

export function treme(el) {
  el.classList.remove('treme'); void el.offsetWidth; el.classList.add('treme');
}

const corHtml = atual => `<div class="grp"><div class="cores" role="radiogroup" aria-label="Cor">${CORES.map((c, i) =>
  `<button type="button" class="cor" role="radio" aria-checked="${c === atual}" aria-label="Cor ${i + 1}" data-cor="${c}" style="background:${c};--c:${c}"></button>`).join('')}</div></div>`;

// liga o seletor de cor dentro de `el`; devolve getter da cor atual
function ligarCores(el, inicial) {
  let cor = inicial;
  el.addEventListener('click', e => {
    const b = e.target.closest('.cor'); if (!b) return;
    cor = b.dataset.cor;
    for (const x of el.querySelectorAll('.cor')) x.setAttribute('aria-checked', x === b);
  });
  return () => cor;
}

const dinheiroIn = c => (c / 100).toFixed(2).replace('.', ',');
const iniciais = n => {
  const p = n.normalize('NFD').replace(/[^\p{L}\s]/gu, '').split(/\s+/).filter(Boolean);
  return (p.length > 1 ? p[0][0] + p[1][0] : (p[0] ?? '').slice(0, 2)).toUpperCase();
};
// saldo inicial: aceita "-", vazio e zero (parseValor recusa zero)
function parseSaldo(txt) {
  const t = txt.trim(), neg = t.startsWith('-'), corpo = t.replace(/^[-+]/, '').trim();
  if (!corpo || /^0+([.,]0+)?$/.test(corpo)) return 0;
  const v = parseValor(corpo);
  return isNaN(v) ? NaN : neg ? -v : v;
}

function avisoCredito() {
  const f = abrirFolha(h('<p class="tit">Antes de começar</p><p class="txt">Lance compras no crédito como saída normal. Não lance o pagamento da fatura: os gastos já estão aqui.</p><button class="btn">Entendi</button>'));
  f.el.querySelector('.btn').addEventListener('click', f.fechar);
}

export function abrirConta(conta) {
  return new Promise(res => {
    const novo = !conta;
    let feito = false, manual = !novo;
    const fim = v => { if (!feito) { feito = true; res(v); } };
    const f = abrirFolha(h(`<p class="tit">${novo ? 'Nova conta' : 'Editar conta'}</p>
      <div class="grp">
        <label class="fld"><span>Nome</span><input name="nome" maxlength="30" placeholder="Ex.: Itaú" autocomplete="off" value="${esc(conta?.nome)}"></label>
        <label class="fld"><span>Sigla</span><input name="sigla" maxlength="2" autocapitalize="characters" autocomplete="off" placeholder="IT" value="${esc(conta?.sigla)}"></label>
        <div class="fld"><span>Saldo inicial</span><button type="button" class="pm" aria-label="Inverter sinal">±</button><input name="saldo" inputmode="decimal" placeholder="0,00" aria-label="Saldo inicial" autocomplete="off" value="${conta ? dinheiroIn(conta.saldoInicial) : ''}"></div>
        <label class="fld"><span>Data do saldo</span><input type="date" name="data" value="${conta?.dataInicial ?? hoje()}"></label>
      </div>
      <div class="lab">Cor</div>${corHtml(conta?.cor ?? CORES[0])}
      <button class="btn" data-salvar style="margin-top:16px">Salvar</button>`), { onFechar: () => fim(null) });
    const q = n => f.el.querySelector(`[name=${n}]`);
    const cor = ligarCores(f.el, conta?.cor ?? CORES[0]);
    q('nome').addEventListener('input', () => { if (!manual) q('sigla').value = iniciais(q('nome').value); });
    q('sigla').addEventListener('input', () => { manual = true; q('sigla').value = q('sigla').value.toUpperCase(); });
    f.el.querySelector('.pm').addEventListener('click', () => {
      const s = q('saldo'), t = s.value.trim();
      s.value = t.startsWith('-') ? t.slice(1) : '-' + t;
    });
    f.el.querySelector('[data-salvar]').addEventListener('click', () => {
      const nome = q('nome').value.trim(), saldoInicial = parseSaldo(q('saldo').value), dataInicial = q('data').value;
      if (!nome) return treme(q('nome').parentElement), q('nome').focus();
      if (isNaN(saldoInicial)) return treme(q('saldo').parentElement), q('saldo').focus();
      if (!/^\d{4}-\d\d-\d\d$/.test(dataInicial)) return treme(q('data').parentElement);
      const c = { ...conta, nome, sigla: q('sigla').value.trim().toUpperCase() || iniciais(nome) || '?', cor: cor(), saldoInicial, dataInicial };
      const primeira = novo && !app.est.contas.length;
      salvarConta(app.est, c);
      app.salvarERender();
      fim(c); f.fechar();
      if (primeira) setTimeout(avisoCredito, 350); // depois de quem chamou reabrir sua folha, para ficar por cima
    });
  });
}

export function abrirCategoria(cat) {
  return new Promise(res => {
    const novo = !cat;
    let feito = false;
    const fim = v => { if (!feito) { feito = true; res(v); } };
    const f = abrirFolha(h(`<p class="tit">${novo ? 'Nova categoria' : 'Editar categoria'}</p>
      <div class="grp"><label class="fld"><span>Nome</span><input name="nome" maxlength="30" placeholder="Ex.: Mercado" autocomplete="off" value="${esc(cat?.nome)}"></label></div>
      <div class="lab">Cor</div>${corHtml(cat?.cor ?? CORES[0])}
      <button class="btn" data-salvar style="margin-top:16px">Salvar</button>`), { onFechar: () => fim(null) });
    const nome = f.el.querySelector('[name=nome]');
    const cor = ligarCores(f.el, cat?.cor ?? CORES[0]);
    f.el.querySelector('[data-salvar]').addEventListener('click', () => {
      if (!nome.value.trim()) return treme(nome.parentElement), nome.focus();
      const c = { ...cat, nome: nome.value.trim(), cor: cor() };
      salvarCategoria(app.est, c);
      app.salvarERender();
      fim(c); f.fechar();
    });
  });
}

// ---------- seletores ----------
const CHECK = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

function lista(titulo, itens, atual, rotuloNova, criar) {
  return new Promise(res => {
    let feito = false;
    const fim = v => { if (!feito) { feito = true; res(v); } };
    const f = abrirFolha(h(`<p class="tit">${esc(titulo)}</p><div class="opcoes">${itens.map(i =>
      `<button type="button" data-id="${esc(i.id)}">${i.marca}<span>${esc(i.nome)}</span>${i.id === atual ? CHECK : ''}</button>`).join('')}</div>
      <button class="btn sec" data-nova>${esc(rotuloNova)}</button>`), { onFechar: () => fim(null) });
    f.el.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if ('nova' in b.dataset) { const x = await criar(); if (x) { fim(x.id); f.fechar(); } return; }
      if (b.dataset.id != null) { fim(b.dataset.id); f.fechar(); }
    });
  });
}

// resolve id da conta, ou null se cancelar
export const escolherConta = (atual, exceto) => lista('Conta',
  app.est.contas.filter(c => c.id !== exceto).map(c => ({ id: c.id, nome: c.nome, marca: `<i class="bk" style="background:${esc(c.cor)}">${esc(c.sigla)}</i>` })),
  atual, '+ Nova conta', () => abrirConta());

// resolve id da categoria, '' para "Sem categoria", ou null se cancelar
export const escolherCategoria = atual => lista('Categoria',
  [{ id: '', nome: 'Sem categoria', marca: '<i class="dot" style="background:var(--t2)"></i>' },
    ...app.est.categorias.map(c => ({ id: c.id, nome: c.nome, marca: `<i class="dot" style="background:${esc(c.cor)}"></i>` }))],
  atual, '+ Nova categoria', () => abrirCategoria());
