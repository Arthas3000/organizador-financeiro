// Funções puras: dinheiro, datas, agregações, "Colar" e CSV. Sem DOM, sem storage.

const p2 = n => String(n).padStart(2, '0');
export const norm = s => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// ---------- dinheiro e datas ----------

export const rotFreq = f => ({ 6: 'semestral', 12: 'anual' })[f] ?? 'mensal';

export const fmt = cent => fmtBRL.format(cent / 100);

export function parseValor(txt) {
  const s = String(txt).replace(/R\$/gi, '').replace(/\s/g, '');
  let num;
  if (s.includes(',')) {
    if (!/^(\d{1,3}(\.\d{3})+|\d+),\d{1,2}$/.test(s)) return NaN;
    num = s.replace(/\./g, '').replace(',', '.');
  } else {
    if (!/^(\d{1,3}(\.\d{3})+|\d+(\.\d+)?)$/.test(s)) return NaN;
    num = /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, '') : s; // "1.234" = mil duzentos e trinta e quatro
  }
  const c = Math.round(Number(num) * 100);
  return c > 0 ? c : NaN;
}

export const hoje = (d = new Date()) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

export const mesDe = iso => iso.slice(0, 7);

export function addMeses(iso, n, dia) {
  const [y, m, d] = iso.split('-').map(Number);
  const i = m - 1 + n;
  const ano = y + Math.floor(i / 12);
  const mes = ((i % 12) + 12) % 12;
  const ultimo = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  return `${ano}-${p2(mes + 1)}-${p2(Math.min(dia ?? d, ultimo))}`;
}

export function dividir(total, n) {
  const base = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) => (i === 0 ? base + total - base * n : base));
}

// ---------- agregações ----------

export function saldoConta(est, contaId, h) {
  const c = est.contas.find(x => x.id === contaId);
  let s = c.saldoInicial;
  for (const l of est.lancamentos) {
    if (l.data > h || l.data < c.dataInicial) continue;
    if (l.tipo === 'transf') {
      if (l.contaId === contaId) s -= l.valor;
      if (l.paraId === contaId) s += l.valor;
    } else if (l.contaId === contaId) {
      s += l.tipo === 'entrada' ? l.valor : -l.valor;
    }
  }
  return s;
}

// `ben` filtra por tipo de conta: undefined = todas, true = só benefícios (VR, iFood), false = só bancos
export const ehBen = c => c?.tipo === 'beneficio';
const doTipo = (est, ben) => ben === undefined ? () => true : l => ehBen(est.contas.find(c => c.id === l.contaId)) === ben;

export const saldoTotal = (est, h, ben) =>
  est.contas.filter(c => ben === undefined || ehBen(c) === ben).reduce((t, c) => t + saldoConta(est, c.id, h), 0);

export function resumoMes(est, mes, h, ben) {
  const r = { entradas: 0, saidas: 0, previsto: 0 }, ok = doTipo(est, ben);
  for (const l of est.lancamentos) {
    if (l.tipo === 'transf' || mesDe(l.data) !== mes || !ok(l)) continue;
    if (l.tipo === 'entrada') {
      if (l.data <= h) r.entradas += l.valor;
    } else if (l.data <= h) r.saidas += l.valor;
    else r.previsto += l.valor;
  }
  return r;
}

export function serieMensal(est, mesInicio, n, h, ben) {
  const ok = doTipo(est, ben);
  return Array.from({ length: n }, (_, i) => {
    const mes = addMeses(`${mesInicio}-01`, i).slice(0, 7);
    const s = { mes, saidasReal: 0, saidasPrev: 0, entradas: 0 };
    for (const l of est.lancamentos) {
      if (l.tipo === 'transf' || mesDe(l.data) !== mes || !ok(l)) continue;
      if (l.tipo === 'entrada') s.entradas += l.valor;
      else if (l.data <= h) s.saidasReal += l.valor;
      else s.saidasPrev += l.valor;
    }
    s.saidas = s.saidasReal + s.saidasPrev;
    return s;
  });
}

export function porCategoria(est, mes, ben) {
  const m = new Map(), ok = doTipo(est, ben);
  for (const l of est.lancamentos) {
    if (l.tipo !== 'saida' || mesDe(l.data) !== mes || !ok(l)) continue;
    const k = l.catId ?? null;
    m.set(k, (m.get(k) ?? 0) + l.valor);
  }
  return [...m].map(([catId, total]) => ({ catId, total })).sort((a, b) => b.total - a.total);
}

export function filtrar(lancs, f = {}) {
  const q = f.q ? norm(f.q) : '';
  const tipoOk = l => {
    if (!f.tipo) return true;
    if (f.tipo === 'parcela') return !!l.parcela;
    if (f.tipo === 'assinatura') return l.tipo === 'saida' && !!l.regraId;
    return l.tipo === f.tipo;
  };
  return lancs
    .filter(l =>
      (!f.mes || mesDe(l.data) === f.mes) &&
      (!f.contaId || l.contaId === f.contaId || l.paraId === f.contaId) &&
      (!f.catId || l.catId === f.catId) &&
      tipoOk(l) &&
      (!q || norm(l.desc || '').includes(q)))
    .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
}

// ---------- Colar e CSV ----------

export function parseColar(txt, contas, categorias, hojeIso) {
  return txt.split('\n').map(l => l.trim()).filter(Boolean).map(linha => {
    const [v = '', desc = '', conta = '', cat = '', dt = ''] = linha.split(';').map(s => s.trim());
    const valor = parseValor(v.replace(/^\+/, ''));
    if (Number.isNaN(valor)) return { linha, erro: 'valor inválido' };
    if (!desc) return { linha, erro: 'descrição vazia' };
    const m = dt ? dt.match(/^(\d{2})\/(\d{2})\/(\d{4})$/) : null;
    if (dt && !m) return { linha, erro: 'data inválida' };
    if (m) {
      const [d, mm, a] = [m[1], m[2], m[3]].map(Number), x = new Date(a, mm - 1, d);
      if (x.getFullYear() !== a || x.getMonth() !== mm - 1 || x.getDate() !== d) return { linha, erro: 'data inválida' };
    }

    const c = conta && contas.find(x => [x.nome, x.sigla].some(n => norm(n) === norm(conta)));
    const k = cat && categorias.find(x => norm(x.nome) === norm(cat));
    const lanc = {
      tipo: v.startsWith('+') ? 'entrada' : 'saida',
      valor,
      desc,
      catId: k ? k.id : null,
      data: m ? `${m[3]}-${m[2]}-${m[1]}` : hojeIso,
    };
    if (c) lanc.contaId = c.id;
    return c ? { linha, lanc } : { linha, lanc, contaPendente: true };
  });
}

// mesmo valor, descrição, data, conta e tipo de um lançamento já existente
export const jaLancado = (lancs, l) =>
  lancs.some(x => x.contaId === l.contaId && x.data === l.data && x.valor === l.valor && x.tipo === l.tipo && norm(x.desc || '') === norm(l.desc || ''));

export function toCSV(est) {
  const nomeDe = (lista, id) => lista.find(x => x.id === id)?.nome ?? '';
  // aspas em ; " \r \n; apóstrofo antes de = + - @ para o Excel não tratar como fórmula
  const q = s => {
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [...est.lancamentos]
    .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))
    .map(l => [
      l.data,
      l.tipo,
      q(l.desc || ''),
      (l.tipo === 'saida' ? '-' : '') + (l.valor / 100).toFixed(2).replace('.', ','),
      q(nomeDe(est.contas, l.contaId)),
      q(nomeDe(est.contas, l.paraId)),
      q(nomeDe(est.categorias, l.catId)),
      l.parcela ? `${l.parcela[0]}/${l.parcela[1]}` : '',
    ].join(';'));
  return ['data;tipo;descricao;valor;conta;para;categoria;parcela', ...rows].join('\n');
}
