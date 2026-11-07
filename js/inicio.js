// Início (spec §6.1): saldo, gastos do mês, contas, próximos 7 dias, lembrete de backup.
import { app } from './app.js';
import { esc, contar } from './ui.js';
import { saldoTotal, saldoConta, resumoMes, fmt, mesDe, hoje as isoDe } from './logica.js';
import { abrirConta } from './cadastros.js';
import { abrirLancamento } from './lancamento.js';
import { linha } from './extrato.js';

document.head.append(Object.assign(document.createElement('style'), { textContent: `
.ini-card .lab { margin: 0 0 6px; }
.ini-val { display: block; font-size: clamp(17px, 5.4vw, 22px); font-weight: 700; letter-spacing: -.02em; white-space: nowrap; font-variant-numeric: tabular-nums; }
.ini-card small { display: block; margin-top: 4px; font-size: 12px; }
.ini-ent { display: flex; justify-content: space-between; margin: 10px 6px 0; font-size: 14px; color: var(--t2); }
.ini-ent b { font-weight: 600; font-variant-numeric: tabular-nums; }
.faixa { display: flex; gap: 10px; margin: 0 -16px; padding: 2px 16px; overflow-x: auto; scrollbar-width: none; }
.cta { flex: none; display: flex; flex-direction: column; gap: 8px; min-width: 144px; padding: 12px; border-radius: 20px; text-align: left; background: var(--card); }
.cta b { display: block; font-weight: 500; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cta small { font-variant-numeric: tabular-nums; }
.cta.nova { align-items: center; justify-content: center; min-width: 96px; color: var(--blue); font-weight: 500; background: color-mix(in srgb, var(--t) 6%, transparent); }
.ini-lemb { display: block; width: 100%; margin-top: 14px; padding: 12px 16px; border-radius: 18px; text-align: left; background: color-mix(in srgb, var(--purple) 12%, var(--card)); }
.ini-lemb b { display: block; font-weight: 600; }
.ini-card7 { padding: 0; overflow: hidden; }
.ini-card7 .vazio { padding: 22px; }
` }));

const ultimo = {}; // números do último render, para animar só o que mudou
const mesTitulo = m => { const t = new Date(m + '-01T12:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(' de ', ' '); return t[0].toUpperCase() + t.slice(1); };

function diasDesde(iso) {
  const a = new Date(iso.slice(0, 10) + 'T12:00'), b = new Date(app.hoje + 'T12:00');
  return Math.round((b - a) / 864e5);
}

export function render(el) {
  if (!el.dataset.ok) { el.dataset.ok = '1'; ligar(el); }
  const { est } = app, hj = app.hoje, mes = mesDe(hj);
  const y = el.scrollTop;
  let html = `<h1 class="big">${mesTitulo(mes)}</h1>`;

  if (!est.contas.length) {
    el.innerHTML = html + `<div class="card p vazio"><b>Crie sua primeira conta</b>Cada conta é um banco. Depois é só lançar seus gastos e entradas.</div>
      <button class="btn" data-conta style="max-width:260px;margin:0 auto">Criar conta</button>`;
    return;
  }

  const r = resumoMes(est, mes, hj), saldo = saldoTotal(est, hj);
  const nums = { saldo, gastos: r.saidas, entradas: r.entradas };
  html += `<div class="dois">
      <div class="card p ini-card"><div class="lab">Saldo</div><b class="ini-val ${saldo < 0 ? 'neg-c' : ''}" data-n="saldo">${fmt(saldo)}</b><small>&nbsp;</small></div>
      <div class="card p ini-card"><div class="lab">Gastos do mês</div><b class="ini-val" data-n="gastos">${fmt(r.saidas)}</b><small>${r.previsto > 0 ? `+ ${fmt(r.previsto)} previstos` : 'nada previsto'}</small></div>
    </div>
    <div class="ini-ent"><span>Entradas do mês</span><b class="pos" data-n="entradas">${fmt(r.entradas)}</b></div>
    <div class="lab"><span>Contas</span></div>
    <div class="faixa">${est.contas.map(c => `<button class="cta" data-conta="${esc(c.id)}"><i class="bk" style="background:${esc(c.cor)}">${esc(c.sigla)}</i><span><b>${esc(c.nome)}</b><small class="num">${fmt(saldoConta(est, c.id, hj))}</small></span></button>`).join('')}<button class="cta nova" data-conta aria-label="Nova conta">+ Conta</button></div>`;

  const lim = new Date(hj + 'T12:00'); lim.setDate(lim.getDate() + 7);
  const limite = isoDe(lim);
  const prox = est.lancamentos.filter(l => l.data > hj && l.data <= limite).sort((a, b) => a.data < b.data ? -1 : a.data > b.data ? 1 : 0);
  html += `<div class="lab"><span>Próximos 7 dias</span></div><div class="card lista ini-card7">${prox.length ? prox.map(l => linha(l, true)).join('') : '<div class="vazio">Nada previsto nos próximos 7 dias</div>'}</div>`;

  const bk = est.ultimoBackup, dias = bk ? diasDesde(bk) : null;
  if (est.lancamentos.length && (dias === null || dias > 7))
    html += `<button class="ini-lemb" data-backup><b>Faça um backup</b><small>${dias === null ? 'Você ainda não exportou seus dados.' : `Último backup há ${dias} dias.`} Toque para abrir Mais.</small></button>`;

  el.innerHTML = html;
  el.scrollTop = y;
  for (const [k, v] of Object.entries(nums)) {
    const n = el.querySelector(`[data-n=${k}]`);
    if (ultimo[k] !== undefined && ultimo[k] !== v) { n.textContent = fmt(ultimo[k]); contar(n, ultimo[k], v); }
    ultimo[k] = v;
  }
}

function ligar(el) {
  el.addEventListener('click', e => {
    const t = e.target;
    const c = t.closest('[data-conta]');
    if (c) return abrirConta(app.est.contas.find(x => x.id === c.dataset.conta));
    if (t.closest('[data-backup]')) return app.irPara('mais');
    const row = t.closest('.lin-c');
    if (row) { const l = app.est.lancamentos.find(x => x.id === row.dataset.id); if (l) abrirLancamento(l); }
  });
  el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('.lin-c')) e.target.click(); });
}
