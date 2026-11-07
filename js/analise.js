// Tela Análise: saídas por mês, categorias do mês selecionado, tabela mensal e compromissos futuros.
import { app } from './app.js';
import { fmt, mesDe, addMeses, serieMensal, porCategoria } from './logica.js';
import { esc } from './ui.js';

const PERIODOS = [['mes', 'Mês'], ['6m', '6 meses'], ['ano', 'Ano']];
let per = 'mes', sel = null;

const css = `
.an-chart { display: flex; align-items: flex-end; gap: 6px; height: 140px; padding-top: 6px; }
.an-col { flex: 1; min-width: 0; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: stretch; touch-action: manipulation; }
.an-bar { display: flex; flex-direction: column; justify-content: flex-end; transform-origin: bottom; animation: cresce .45s var(--spring) backwards; animation-delay: calc(var(--k) * 25ms); }
.an-bar i { display: block; }
.an-bar .r { background: var(--blue); border-radius: 6px 6px 3px 3px; }
.an-bar .p { background: repeating-linear-gradient(135deg, color-mix(in srgb, var(--blue) 50%, transparent) 0 4px, color-mix(in srgb, var(--blue) 18%, transparent) 4px 8px); border-radius: 6px 6px 0 0; }
.an-bar .p + .r { border-radius: 0 0 3px 3px; }
.an-col.now .an-bar { outline: 2px solid var(--blue); outline-offset: 2px; border-radius: 6px; }
.an-col:active .an-bar { transform: scaleY(.97); transition: transform .12s var(--out); }
.an-mes { display: flex; gap: 6px; margin-top: 8px; }
.an-mes span { flex: 1; min-width: 0; text-align: center; font-size: 11px; line-height: 20px; border-radius: 10px; color: var(--t2); text-transform: capitalize; transition: background-color .2s, color .2s; }
.an-mes span.sel { background: var(--blue); color: #fff; font-weight: 600; }
.an-cat { padding: 10px 0; border-bottom: 1px solid var(--sep); }
.an-cat:last-child { border-bottom: 0; }
.an-cat > div { display: flex; justify-content: space-between; gap: 8px; font-size: 15px; }
.an-cat .tr { height: 6px; border-radius: 3px; margin-top: 6px; background: color-mix(in srgb, var(--t) 7%, transparent); overflow: hidden; }
.an-cat .tr i { display: block; height: 100%; border-radius: 3px; transform-origin: left; animation: an-w .5s var(--spring) backwards; }
@keyframes an-w { from { transform: scaleX(0); } }
.an-tab { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
.an-tab th { font-size: 11px; font-weight: 500; color: var(--t2); text-align: right; padding: 8px 0; }
.an-tab td { text-align: right; padding: 9px 0; border-top: 1px solid var(--sep); }
.an-tab th:first-child, .an-tab td:first-child { text-align: left; text-transform: capitalize; }
.an-tab tr.sel td { font-weight: 600; }
.an-tab tr.sel td:first-child { color: var(--blue); }
.an-sw { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 5px; vertical-align: -1px; }
@media (prefers-reduced-motion: reduce) { .an-bar, .an-cat .tr i { animation: none; } }
`;
function estilo() {
  if (document.getElementById('an-css')) return;
  document.head.append(Object.assign(document.createElement('style'), { id: 'an-css', textContent: css }));
}

const rotMes = (m, longo) => new Date(`${m}-15T12:00`).toLocaleDateString('pt-BR', longo ? { month: 'long', year: 'numeric' } : { month: 'short' }).replace('.', '').replace(' de ', ' ');
const cor = c => (/^#[0-9a-f]{3,8}$/i.test(c) ? c : 'var(--t2)');

function janela(mesAtual) {
  if (per === 'ano') return [`${mesAtual.slice(0, 4)}-01`, 12];
  return per === 'mes' ? [addMeses(`${mesAtual}-01`, -3).slice(0, 7), 6] : [addMeses(`${mesAtual}-01`, -5).slice(0, 7), 9];
}

export function render(el) {
  estilo();
  const est = app.est, hoje = app.hoje, atual = mesDe(hoje);
  const [ini, n] = janela(atual);
  const serie = serieMensal(est, ini, n, hoje);
  if (!serie.some(s => s.mes === sel)) sel = atual;

  const vazio = !est.lancamentos.length && !est.regras.length;
  const max = Math.max(1, ...serie.map(s => s.saidas));
  const alt = v => (v ? Math.max(3, (v / max) * 100) : 0);

  const grafico = () => `
    <div class="an-chart" role="img" aria-label="Saídas por mês">${serie.map((s, i) => `
      <button class="an-col${s.mes === atual ? ' now' : ''}" data-m="${s.mes}" aria-label="${esc(rotMes(s.mes, 1))}: ${fmt(s.saidas)}">
        <div class="an-bar" style="--k:${i};height:${alt(s.saidas)}%">
          ${s.saidasPrev ? `<i class="p" style="flex:${s.saidasPrev}"></i>` : ''}${s.saidasReal ? `<i class="r" style="flex:${s.saidasReal}"></i>` : ''}
        </div>
      </button>`).join('')}</div>
    <div class="an-mes">${serie.map(s => `<span data-m="${s.mes}" class="${s.mes === sel ? 'sel' : ''}">${esc(rotMes(s.mes))}</span>`).join('')}</div>
    <div class="leg"><span><i class="an-sw" style="background:var(--blue)"></i>Realizado</span><span><i class="an-sw" style="background:repeating-linear-gradient(135deg,color-mix(in srgb,var(--blue) 50%,transparent) 0 2px,color-mix(in srgb,var(--blue) 18%,transparent) 2px 4px)"></i>Previsto</span></div>`;

  const detalhe = () => {
    const cats = porCategoria(est, sel), topo = Math.max(1, ...cats.map(c => c.total));
    const lista = cats.length ? cats.map(c => {
      const k = c.catId == null ? null : est.categorias.find(x => x.id === c.catId);
      return `<div class="an-cat"><div><span>${esc(k ? k.nome : 'Sem categoria')}</span><b>${fmt(c.total)}</b></div>
        <div class="tr"><i style="width:${(c.total / topo) * 100}%;background:${k ? cor(k.cor) : 'var(--t2)'}"></i></div></div>`;
    }).join('') : '<p class="vazio" style="padding:20px">Sem saídas neste mês.</p>';
    return `<div class="lab"><span>Por categoria</span><span style="text-transform:capitalize">${esc(rotMes(sel, 1))}</span></div>
      <div class="card">${lista}</div>
      <div class="lab"><span>Mês a mês</span></div>
      <div class="card"><table class="an-tab"><thead><tr><th>Mês</th><th>Entradas</th><th>Saídas</th><th>Saldo</th></tr></thead><tbody>
        ${serie.map(s => { const d = s.entradas - s.saidas; return `<tr class="${s.mes === sel ? 'sel' : ''}"><td>${esc(rotMes(s.mes))}</td><td>${fmt(s.entradas)}</td><td>${fmt(s.saidas)}</td><td class="${d < 0 ? 'neg-c' : 'pos'}">${fmt(d)}</td></tr>`; }).join('')}
      </tbody></table></div>`;
  };

  const parcelas = est.lancamentos.reduce((t, l) => t + (l.tipo === 'saida' && l.parcela && l.data > hoje ? l.valor : 0), 0);
  const assin = est.regras.reduce((t, r) => t + (r.tipo === 'saida' && (!r.fim || r.fim >= hoje) ? r.valor : 0), 0);
  const futuros = `<div class="lab"><span>Compromissos futuros</span></div>
    <div class="card"><div class="lista">
      <div class="it"><span style="flex:1">Parcelas restantes</span><b>${fmt(parcelas)}</b></div>
      <div class="it"><span style="flex:1">Assinaturas por mês</span><b>${fmt(assin)}</b></div></div></div>`;

  const ops = PERIODOS.map(([k, r]) => `<button data-p="${k}" class="${k === per ? 'on' : ''}">${r}</button>`).join('');
  el.innerHTML = `<h1 class="big">Análise</h1>${vazio
    ? '<div class="vazio"><b>Nada para analisar ainda</b>Lance gastos e eles aparecem aqui.</div>'
    : `<div class="seg" data-seg><i class="pill"></i>${ops}</div>
       <div class="lab"><span>Saídas</span></div>
       <div class="card p" data-g>${grafico()}</div><div data-d>${detalhe()}</div>${futuros}`}`;
  if (vazio) { el.onclick = null; return; }

  // pílula do seletor, sem animar na entrada
  const sg = el.querySelector('.seg'), b = sg.querySelector('.on'), p = sg.querySelector('.pill');
  p.style.transition = 'none';
  const pos = () => { p.style.width = b.offsetWidth + 'px'; p.style.transform = `translateX(${b.offsetLeft - 3}px)`; };
  pos(); requestAnimationFrame(() => requestAnimationFrame(() => { p.style.transition = ''; }));

  el.onclick = e => {
    const bp = e.target.closest('[data-p]');
    if (bp) { per = bp.dataset.p; return render(el); }
    const bm = e.target.closest('.an-col, .an-mes span');
    if (!bm || bm.dataset.m === sel) return;
    sel = bm.dataset.m; // atualiza só o que muda: as barras não reanimam
    for (const s of el.querySelectorAll('.an-mes span')) s.classList.toggle('sel', s.dataset.m === sel);
    el.querySelector('[data-d]').innerHTML = detalhe();
  };
}
