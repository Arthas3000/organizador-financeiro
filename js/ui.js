// Helpers de DOM e movimento. Todo texto do usuário passa por esc().
import { fmt } from './logica.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const h = html => document.createRange().createContextualFragment(html);
const reduzido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- folha ----------
const pilha = [];
addEventListener('keydown', e => { if (e.key === 'Escape') pilha.at(-1)?.fechar(); });

// com folha aberta, só a do topo é navegável (leitor de tela e Tab)
function isolar() {
  for (const s of ['main', '#tabs', '#fab']) document.querySelector(s)?.toggleAttribute('inert', pilha.length > 0);
  pilha.forEach((f, i) => f.el.toggleAttribute('inert', i < pilha.length - 1));
}
let nFolha = 0;

export function abrirFolha(conteudo, { onFechar } = {}) {
  const antes = document.activeElement;
  const dim = Object.assign(document.createElement('div'), { className: 'dim' });
  const el = Object.assign(document.createElement('div'), { className: 'folha' });
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  el.innerHTML = '<div class="grab"></div><div class="corpo"></div>';
  el.querySelector('.corpo').append(conteudo);
  const tit = el.querySelector('.tit, .top b');
  if (tit) { tit.id ||= 'folha-tit-' + ++nFolha; el.setAttribute('aria-labelledby', tit.id); } else el.setAttribute('aria-label', 'Janela');
  document.body.append(dim, el);
  requestAnimationFrame(() => requestAnimationFrame(() => { dim.classList.add('on'); el.classList.add('on'); }));

  let fechada = false;
  const api = {
    el,
    fechar() {
      if (fechada) return; fechada = true;
      pilha.splice(pilha.indexOf(api), 1);
      el.setAttribute('inert', ''); isolar(); // antes de devolver o foco: elemento inert não aceita foco
      el.style.transition = el.style.transform = '';
      el.classList.remove('on'); dim.classList.remove('on');
      setTimeout(() => { el.remove(); dim.remove(); }, reduzido() ? 160 : 480);
      antes?.isConnected && antes.focus?.({ preventScroll: true });
      onFechar?.();
    },
  };
  pilha.push(api);
  isolar();
  dim.addEventListener('pointerdown', api.fechar);

  // arrasto: segue o dedo 1:1, solta pela distância ou pela velocidade
  for (const alca of el.querySelectorAll('.grab,[data-arrasto]')) {
    alca.style.touchAction = 'none';
    alca.addEventListener('pointerdown', e => {
      alca.setPointerCapture(e.pointerId);
      const y0 = e.clientY, hAlt = el.offsetHeight, amostras = [[e.timeStamp, e.clientY]];
      el.style.transition = 'none';
      const mover = ev => {
        const dy = ev.clientY - y0;
        el.style.transform = `translateY(${dy > 0 ? dy : dy * .15}px)`;
        amostras.push([ev.timeStamp, ev.clientY]);
        while (amostras.length > 1 && ev.timeStamp - amostras[0][0] > 100) amostras.shift();
      };
      const soltar = ev => {
        alca.removeEventListener('pointermove', mover);
        alca.removeEventListener('pointerup', soltar); alca.removeEventListener('pointercancel', soltar);
        const [t, y] = amostras[0], dt = ev.timeStamp - t;
        const v = dt > 0 ? (ev.clientY - y) / dt : 0; // px/ms
        if (ev.clientY - y0 > hAlt * .3 || v > .6) api.fechar();
        else { el.style.transition = el.style.transform = ''; } // volta com a mola da classe
      };
      alca.addEventListener('pointermove', mover);
      alca.addEventListener('pointerup', soltar); alca.addEventListener('pointercancel', soltar);
    });
  }
  el.querySelector('button, input, select, textarea')?.focus({ preventScroll: true });
  return api;
}

export function escolher(titulo, opcoes) {
  return new Promise(res => {
    let feito = false;
    const fim = v => { if (!feito) { feito = true; res(v); } };
    const c = h(`<p class="tit">${esc(titulo)}</p><div class="opcoes">${opcoes.map((o, i) => `<button data-i="${i}">${esc(o.rotulo)}</button>`).join('')}</div><button class="btn sec" data-x>Cancelar</button>`);
    const f = abrirFolha(c, { onFechar: () => fim(null) });

    f.el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.i != null) fim(opcoes[b.dataset.i].valor);
      f.fechar();
    });
  });
}

export function confirmar(titulo, texto, rotuloOk, destrutivo = false) {
  return new Promise(res => {
    let feito = false;
    const fim = v => { if (!feito) { feito = true; res(v); } };
    const c = h(`<p class="tit">${esc(titulo)}</p><p class="txt">${esc(texto)}</p><button class="btn ${destrutivo ? 'dest' : ''}" data-ok>${esc(rotuloOk)}</button><button class="btn sec">Cancelar</button>`);
    const f = abrirFolha(c, { onFechar: () => fim(false) });
    f.el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      fim('ok' in b.dataset);
      f.fechar();
    });
  });
}

// ---------- toast ----------
let atual, tToast;
export function toast(msg, { acao, onAcao, ms = 4000 } = {}) {
  const sai = el => { el.classList.remove('on'); setTimeout(() => el.remove(), 400); };
  if (atual) sai(atual);
  clearTimeout(tToast);
  const el = atual = Object.assign(document.createElement('div'), { className: 'toast' });
  el.setAttribute('role', 'status');
  el.innerHTML = `<span>${esc(msg)}</span>${acao ? `<button>${esc(acao)}</button>` : ''}`;
  el.querySelector('button')?.addEventListener('click', () => { clearTimeout(tToast); sai(el); onAcao?.(); });
  document.body.append(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
  tToast = setTimeout(() => sai(el), ms);
}

// ---------- número animado ----------
export function contar(el, de, para, ms = 400) {
  if (reduzido() || de === para) { el.textContent = fmt(para); return; }
  const t0 = performance.now();
  const passo = t => {
    const p = Math.min((t - t0) / ms, 1), e = 1 - (1 - p) ** 3;
    el.textContent = fmt(Math.round(de + (para - de) * e));
    if (p < 1) requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}
