// Painel de lançamento: novo e edição (spec §6.5).
import { app } from './app.js';
import { abrirFolha, escolher, toast, h, esc } from './ui.js';
import { adicionar, editar, apagarDesfazivel, replicar, desfazerReplica } from './estado.js';
import { parseValor, fmt, dividir, addMeses, norm, rotFreq } from './logica.js';
import { abrirConta, escolherConta, escolherCategoria, treme } from './cadastros.js';

const TIPOS = [['saida', 'Saída'], ['entrada', 'Entrada'], ['transf', 'Transferência']];
const ESCOPOS = [{ valor: 'um', rotulo: 'Só este' }, { valor: 'proximos', rotulo: 'Este e os próximos' }];
const reduzido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = 'cubic-bezier(.2,.8,.2,1)';
const mes = iso => new Date(iso + 'T12:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
const SWAP = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4v16M8 20l-3-3M8 20l3-3M16 20V4M16 4l-3 3M16 4l3 3"/></svg>';

const seg = (id, ops, atual) => `<div class="seg" data-seg="${id}"><i class="pill"></i>${ops.map(([k, r]) =>
  `<button type="button" data-k="${k}" class="${k === atual ? 'on' : ''}">${r}</button>`).join('')}</div>`;

function pilulas(raiz, anima) {
  for (const sg of raiz.querySelectorAll('.seg')) {
    const b = sg.querySelector('.on'), p = sg.querySelector('.pill');
    if (!b) continue;
    if (!anima) p.style.transition = 'none';
    p.style.width = b.offsetWidth + 'px'; p.style.transform = `translateX(${b.offsetLeft - 3}px)`;
    if (!anima) { void p.offsetWidth; p.style.transition = ''; }
  }
}

const nomeConta = id => app.est.contas.find(c => c.id === id)?.nome;
const nomeCat = id => app.est.categorias.find(c => c.id === id)?.nome;
const FREQS = [['1', 'Mensal'], ['6', 'Semestral'], ['12', 'Anual']];
const REPLICAS = [['m1', 'Próximo mês', 1, 1], ['m6', 'Todo mês, por 6 meses', 1, 6], ['m12', 'Todo mês, por 12 meses', 1, 12], ['s', 'A cada 6 meses', 6], ['a', 'Todo ano', 12]];
const mesAno = iso => new Date(iso + 'T12:00').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '').replace(' de ', '/');

// descrições já usadas do tipo, mais recentes primeiro; cada uma aponta para o último lançamento com ela
function usadas(tipo) {
  const m = new Map();
  for (const x of [...app.est.lancamentos].filter(x => x.tipo === tipo && x.desc && x.data <= app.hoje).sort((a, b) => (a.data < b.data ? 1 : -1)))
    if (!m.has(norm(x.desc))) m.set(norm(x.desc), x);
  return m;
}

const linha = (a, rotulo, valor) => `<button type="button" class="fld" data-a="${a}" data-campo="${a}"><span>${rotulo}</span><span>${esc(valor)} ›</span></button>`;

export function abrirLancamento(l) {
  const edit = !!l;
  if (!edit && !app.est.contas.length) {
    const f = abrirFolha(h('<div class="vazio"><b>Crie uma conta primeiro</b>Os lançamentos pertencem a uma conta (um banco).</div><button class="btn">Criar conta</button>'));
    f.el.querySelector('.btn').addEventListener('click', async () => {
      if (await abrirConta()) { f.fechar(); abrirLancamento(); }
    });
    return;
  }

  const s = edit
    ? { tipo: l.tipo, desc: l.desc ?? '', catId: l.catId ?? '', contaId: l.contaId, paraId: l.paraId ?? null, data: l.data, modo: 'unico', n: '3' }
    : { tipo: 'saida', desc: '', catId: '', contaId: app.est.contas[0].id, paraId: null, data: app.hoje, modo: 'unico', n: '3', freq: '1' };
  const tocou = { catId: false, contaId: false }; // escolhido à mão: o preenchimento automático não troca
  let sugest = new Map();
  const replicavel = edit && l.tipo === 'saida' && !l.grupo && !l.regraId;
  const replicas = () => `<div class="lab">Replicar</div><div class="grp">${REPLICAS.map(([op, rot, passo, n]) => {
    const ini = addMeses(l.data, passo, Number(l.data.slice(8)));
    const quando = n ? (n === 1 ? mes(ini) : `${mes(ini)} → ${mes(addMeses(l.data, n, Number(l.data.slice(8))))}`) : `a partir de ${mesAno(ini)}`;
    return `<button type="button" class="fld" data-rep="${op}"><span>${rot}</span><span>${esc(quando)}</span></button>`;
  }).join('')}</div>`;
  const valor0 = edit ? (l.valor / 100).toFixed(2).replace('.', ',') : '';

  const f = abrirFolha(h(`
    <div class="top"><button type="button" data-a="cancelar">Cancelar</button><b>${edit ? 'Editar lançamento' : 'Novo lançamento'}</b><i></i></div>
    ${edit ? '' : seg('tipo', TIPOS, s.tipo)}
    <input class="amt" inputmode="decimal" placeholder="R$ 0,00" aria-label="Valor" autocomplete="off" value="${valor0}">
    <div class="hint" aria-live="polite"></div>
    <div class="form"></div>
    ${replicavel ? replicas() : ''}
    <button class="btn" data-a="salvar" style="margin-top:16px">${edit ? 'Salvar alterações' : 'Salvar'}</button>
    ${edit ? '<button class="btn dest" data-a="apagar">Apagar lançamento</button>' : ''}`));
  const $ = x => f.el.querySelector(x);
  const amt = $('.amt'), F = $('.form'), dicaEl = $('.hint'), principal = $('[data-seg=tipo]');

  function form() {
    const t = s.tipo;
    sugest = edit || t === 'transf' ? new Map() : usadas(t);
    const lista = sugest.size ? `<datalist id="sug-desc">${[...sugest.values()].slice(0, 60).map(x => `<option value="${esc(x.desc)}">`).join('')}</datalist>` : '';
    const desc = `<label class="fld" data-campo="desc"><span>Descrição</span><input data-k="desc" value="${esc(s.desc)}" placeholder="${t === 'transf' ? 'Opcional' : t === 'entrada' ? 'Ex.: Salário' : 'Ex.: Mercado'}" maxlength="60" autocomplete="off"${lista ? ' list="sug-desc"' : ''}>${lista}</label>`;
    const data = `<label class="fld"><span>Data</span><input type="date" data-k="data" value="${esc(s.data)}"></label>`;
    if (t === 'transf')
      return `<div class="grp">${linha('de', 'De', nomeConta(s.contaId) ?? 'Escolher')}</div>
        <button type="button" class="swap" data-a="swap" aria-label="Inverter contas">${SWAP}</button>
        <div class="grp">${linha('para', 'Para', nomeConta(s.paraId) ?? 'Escolher')}</div>
        <div class="grp" style="margin-top:10px">${desc}${data}</div>`;
    let extra = '';
    if (!edit && t === 'saida') {
      extra = `<div class="fld"><span>Tipo</span>${seg('modo', [['unico', 'Única'], ['parcelado', 'Parcelado'], ['recorrente', 'Assinatura']], s.modo)}</div>`;
      if (s.modo === 'recorrente') extra += `<div class="fld"><span>Frequência</span>${seg('freq', FREQS, s.freq)}</div>`;
      if (s.modo === 'parcelado')
        extra += `<label class="fld" data-campo="n"><span>Parcelas</span><input data-k="n" type="number" inputmode="numeric" min="2" max="48" value="${esc(s.n)}"></label>`;
    } else if (!edit) {
      extra = `<div class="fld"><span>Repetir</span>${seg('modo', [['unico', 'Não'], ['recorrente', 'Todo mês']], s.modo)}</div>`;
    }
    return `<div class="grp">${desc}${linha('cat', 'Categoria', nomeCat(s.catId) ?? 'Sem categoria')}${linha('conta', 'Conta', nomeConta(s.contaId) ?? 'Escolher')}${data}${extra}</div>`;
  }

  function dica() {
    if (edit) {
      if (l.parcela) return `Parcela ${l.parcela[0]} de ${l.parcela[1]}`;
      const r = l.regraId && app.est.regras.find(x => x.id === l.regraId);
      return r ? `Repete: ${rotFreq(r.freq)}` : l.regraId ? 'Recorrente' : '';
    }
    if (s.modo === 'recorrente') {
      if (!s.data) return '';
      const d = Number(s.data.slice(8));
      return s.tipo === 'entrada' || s.freq === '1' ? `Repete todo mês no dia ${d}` : `Repete a cada ${s.freq} meses no dia ${d} · próxima em ${mesAno(addMeses(s.data, Number(s.freq), d))}`;
    }
    if (s.modo !== 'parcelado') return '';
    const n = Number(s.n), v = parseValor(amt.value);
    if (!Number.isInteger(n) || n < 2 || n > 48) return 'Parcelas de 2 a 48';
    if (isNaN(v) || !s.data) return `${n} parcelas`;
    const ms = Array.from({ length: Math.min(n, 3) }, (_, i) => mes(addMeses(s.data, i, Number(s.data.slice(8)))));
    return `${n}× de ${fmt(dividir(v, n).at(-1))} · ${ms.join(', ')}${n > 3 ? '…' : ''}`;
  }

  function pintar(dir = 0) {
    F.innerHTML = form();
    pilulas(F, false);
    amt.className = 'amt ' + ({ entrada: 'in', transf: 'tr' }[s.tipo] ?? '');
    dicaEl.textContent = dica();
    if (dir && !reduzido()) F.animate([{ opacity: 0, transform: `translateX(${dir * 14}px)` }, { opacity: 1, transform: 'none' }], { duration: 240, easing: ease });
  }
  pintar();
  if (principal) pilulas(f.el, false);
  if (!edit) amt.focus({ preventScroll: true });

  amt.addEventListener('input', () => { dicaEl.textContent = dica(); });
  F.addEventListener('input', e => {
    const k = e.target.dataset.k; if (!k) return;
    s[k] = e.target.value;
    if (k === 'desc') preencher();
    dicaEl.textContent = dica();
  });
  F.addEventListener('change', e => { if (e.target.dataset.k === 'data') dicaEl.textContent = dica(); });

  // descrição igual a uma já usada: copia categoria e conta do último lançamento com ela (sem repintar, para não perder o foco)
  function preencher() {
    const x = sugest.get(norm(s.desc.trim()));
    if (!x) return;
    if (!tocou.catId && app.est.categorias.some(c => c.id === x.catId)) s.catId = x.catId;
    if (!tocou.contaId && app.est.contas.some(c => c.id === x.contaId)) s.contaId = x.contaId;
    F.querySelector('[data-a=cat] span:last-child').textContent = `${nomeCat(s.catId) ?? 'Sem categoria'} ›`;
    F.querySelector('[data-a=conta] span:last-child').textContent = `${nomeConta(s.contaId) ?? 'Escolher'} ›`;
  }

  function replicarLanc(op) {
    const r = replicar(app.est, l.id, op, app.hoje);
    if (!r) return;
    app.salvarERender();
    f.fechar();
    const msg = r.regraId ? `Assinatura ${op === 's' ? 'semestral' : 'anual'} criada` : r.ids.length === 1 ? '1 cobrança criada' : `${r.ids.length} cobranças criadas`;
    toast(msg, { acao: 'Desfazer', onAcao: () => { desfazerReplica(app.est, r); app.salvarERender(); } });
  }

  let salvando = false;
  async function salvar() {
    const v = parseValor(amt.value), desc = s.desc.trim();
    // o motivo vai para o .hint (aria-live), não só a tremida
    const falha = (msg, el) => { dicaEl.textContent = msg; treme(el); return el.focus?.(); };
    const campo = n => F.querySelector(`[data-campo=${n}]`);
    if (isNaN(v)) return falha('Informe um valor maior que zero.', amt);
    if (s.tipo !== 'transf' && !desc) return falha('Informe a descrição.', campo('desc')), campo('desc').querySelector('input').focus();
    if (!s.contaId) return falha('Escolha a conta.', campo(s.tipo === 'transf' ? 'de' : 'conta'));
    if (s.tipo === 'transf' && (!s.paraId || s.paraId === s.contaId)) return falha('Escolha uma conta de destino diferente.', campo('para'));
    if (!/^\d{4}-\d\d-\d\d$/.test(s.data)) return falha('Informe uma data válida.', F.querySelector('[data-k=data]').parentElement);
    const n = Number(s.n);
    if (!edit && s.modo === 'parcelado' && (!Number.isInteger(n) || n < 2 || n > 48)) return falha('Parcelas de 2 a 48.', campo('n'));

    const dados = s.tipo === 'transf'
      ? { tipo: 'transf', valor: v, desc, contaId: s.contaId, paraId: s.paraId, data: s.data }
      : { tipo: s.tipo, valor: v, desc, contaId: s.contaId, catId: s.catId || null, data: s.data };
    if (salvando) return; salvando = true;
    if (edit) {
      let escopo = 'um';
      if (l.grupo || l.regraId) {
        escopo = await escolher('Aplicar a', ESCOPOS);
        if (!escopo) { salvando = false; return; }
      }
      editar(app.est, l.id, dados, escopo, app.hoje);
    } else {
      adicionar(app.est, s.modo === 'parcelado' ? { ...dados, n } : s.modo === 'recorrente' && s.tipo === 'saida' ? { ...dados, freq: Number(s.freq) } : dados, s.modo, app.hoje);
    }
    app.salvarERender();
    f.fechar();
  }

  async function apagarLanc() {
    let escopo = 'um';
    if (l.grupo || l.regraId) {
      escopo = await escolher('Aplicar a', ESCOPOS);
      if (!escopo) return;
    }
    const desfazer = apagarDesfazivel(app.est, l.id, escopo, app.hoje);
    app.salvarERender();
    f.fechar();
    toast('Lançamento apagado', { acao: 'Desfazer', onAcao: () => { app.est = desfazer(app.est); app.salvarERender(); } });
  }

  f.el.addEventListener('click', async e => {
    const sb = e.target.closest('.seg button');
    if (sb) {
      const id = sb.parentElement.dataset.seg, k = sb.dataset.k;
      if (id === 'tipo') {
        if (k === s.tipo) return;
        const dir = Math.sign(TIPOS.findIndex(t => t[0] === k) - TIPOS.findIndex(t => t[0] === s.tipo));
        s.tipo = k; s.modo = 'unico';
        if (k === 'transf') s.paraId = s.paraId === s.contaId ? null : s.paraId;
        for (const b of principal.children) b.classList?.toggle('on', b === sb);
        pilulas(principal.parentElement, true);
        pintar(dir);
      } else if (id === 'freq') { s.freq = k; pintar(); }
      else { s.modo = k; pintar(); }
      return;
    }
    const rp = e.target.closest('[data-rep]');
    if (rp) return replicarLanc(rp.dataset.rep);
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a;
    if (a === 'cancelar') f.fechar();
    else if (a === 'salvar') salvar();
    else if (a === 'apagar') apagarLanc();
    else if (a === 'cat') { const r = await escolherCategoria(s.catId); if (r !== null) { s.catId = r; tocou.catId = true; pintar(); } }
    else if (a === 'conta') { const r = await escolherConta(s.contaId); if (r) { s.contaId = r; tocou.contaId = true; pintar(); } }
    else if (a === 'de') {
      const r = await escolherConta(s.contaId);
      if (r) { s.contaId = r; if (s.paraId === r) s.paraId = null; pintar(); }
    } else if (a === 'para') { const r = await escolherConta(s.paraId, s.contaId); if (r) { s.paraId = r; pintar(); } }
    else if (a === 'swap') {
      if (!s.paraId) return treme(b);
      [s.contaId, s.paraId] = [s.paraId, s.contaId];
      pintar();
      if (!reduzido()) $('.swap').animate([{ transform: 'rotate(0)' }, { transform: 'rotate(180deg)' }], { duration: 320, easing: ease });
    }
  });
}
