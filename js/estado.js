// Estado em memória, persistência (localStorage) e mutações. Sem DOM.
import { addMeses, dividir, mesDe, hoje } from './logica.js';

const CHAVE = 'orgfin';

export const vazio = () => ({ v: 1, contas: [], categorias: [], lancamentos: [], regras: [], ultimoBackup: null });
export const novoId = () => crypto.randomUUID();

// ---------- persistência ----------

const DATA = /^\d{4}-\d\d-\d\d$/;
const TIPOS = ['saida', 'entrada', 'transf'];
const itemOk = {
  contas: c => typeof c.id === 'string' && Number.isFinite(c.saldoInicial) && DATA.test(c.dataInicial),
  categorias: c => typeof c.id === 'string',
  lancamentos: l => typeof l.id === 'string' && DATA.test(l.data) && Number.isInteger(l.valor) && TIPOS.includes(l.tipo),
  regras: r => typeof r.id === 'string' && DATA.test(r.inicio) && Number.isInteger(r.dia) && Number.isInteger(r.valor),
};

export function validarBackup(texto) {
  let est;
  try { est = JSON.parse(texto); } catch { return { ok: false, erro: 'Arquivo inválido: não é JSON.' }; }
  if (est?.v !== 1) return { ok: false, erro: 'Arquivo de outro app ou de versão desconhecida.' };
  for (const k of ['contas', 'categorias', 'lancamentos', 'regras']) {
    if (!Array.isArray(est[k])) return { ok: false, erro: `Arquivo incompleto: falta "${k}".` };
    if (!est[k].every(x => x && typeof x === 'object' && itemOk[k](x))) return { ok: false, erro: `Arquivo com dados inválidos em "${k}".` };
  }
  est.ultimoBackup ??= null;
  return { ok: true, est, resumo: { contas: est.contas.length, lancamentos: est.lancamentos.length, ultimoBackup: est.ultimoBackup } };
}

// Ausente = app novo (vazio). Inválido = não apaga: copia o bruto e avisa `corrompido` (quem chama não deve salvar no boot).
export function carregar(storage = globalThis.localStorage) {
  let bruto;
  try { bruto = storage.getItem(CHAVE); } catch { return { est: vazio(), corrompido: false }; }
  if (bruto == null) return { est: vazio(), corrompido: false };
  const r = validarBackup(bruto);
  if (r.ok) return { est: r.est, corrompido: false };
  try { storage.setItem(CHAVE + '-corrompido', bruto); } catch { /* sem espaço: o original continua lá */ }
  return { est: vazio(), corrompido: true };
}

export function salvar(est, storage = globalThis.localStorage) {
  try { storage.setItem(CHAVE, JSON.stringify(est)); return true; } catch { return false; }
}

// ---------- lançamentos ----------

const diaAnterior = iso => {
  const [y, m, d] = iso.split('-').map(Number);
  return hoje(new Date(y, m - 1, d - 1));
};
const diaDe = iso => Number(iso.slice(8));

export function adicionar(est, dados, modo, hojeIso) {
  const { n, freq, ...base } = dados;
  if (modo === 'parcelado') {
    const grupo = novoId(), dia = diaDe(base.data);
    dividir(base.valor, n).forEach((valor, i) =>
      est.lancamentos.push({ ...base, id: novoId(), valor, data: addMeses(base.data, i, dia), grupo, parcela: [i + 1, n] }));
  } else if (modo === 'recorrente') {
    const { tipo, valor, desc, contaId, data } = base;
    est.regras.push({ id: novoId(), tipo, valor, desc, contaId, catId: base.catId ?? null, dia: diaDe(data), inicio: data, fim: null, puladas: [], freq: freq ?? 1 });
    completarRecorrentes(est, hojeIso);
  } else {
    est.lancamentos.push({ ...base, id: novoId() });
  }
}

export function completarRecorrentes(est, hojeIso) {
  const ultimoMes = mesDe(addMeses(hojeIso, 12));
  for (const r of est.regras) {
    const refs = new Set([...(r.puladas ?? []), ...est.lancamentos.filter(l => l.regraId === r.id).map(l => l.ref)]);
    for (let i = 0; ; i++) {
      const data = addMeses(r.inicio, i * (r.freq ?? 1), r.dia); // freq em meses: 1, 6 ou 12
      if (mesDe(data) > ultimoMes || (r.fim && data > r.fim)) break;
      const ref = mesDe(data);
      if (!refs.has(ref))
        est.lancamentos.push({ id: novoId(), tipo: r.tipo, valor: r.valor, desc: r.desc, contaId: r.contaId, catId: r.catId, data, regraId: r.id, ref });
    }
  }
}

// Replica um gasto único. 'm1' | 'm6' | 'm12' = N cópias mensais avulsas; 's' | 'a' = vira assinatura semestral/anual
// a partir do próximo período. Devolve o que foi criado, para desfazer.
export function replicar(est, id, op, hojeIso) {
  const l = est.lancamentos.find(x => x.id === id);
  if (!l) return null;
  const { tipo, valor, desc, contaId } = l, catId = l.catId ?? null, dia = diaDe(l.data);
  if (op === 's' || op === 'a') {
    const freq = op === 's' ? 6 : 12, regraId = novoId();
    est.regras.push({ id: regraId, tipo, valor, desc, contaId, catId, dia, inicio: addMeses(l.data, freq, dia), fim: null, puladas: [], freq });
    completarRecorrentes(est, hojeIso);
    return { ids: [], regraId };
  }
  const ids = Array.from({ length: { m1: 1, m6: 6, m12: 12 }[op] }, (_, i) => {
    const novo = { tipo, valor, desc, contaId, catId, data: addMeses(l.data, i + 1, dia), id: novoId() };
    est.lancamentos.push(novo);
    return novo.id;
  });
  return { ids, regraId: null };
}

export function desfazerReplica(est, { ids, regraId }) {
  const fora = new Set(ids);
  est.lancamentos = est.lancamentos.filter(x => !fora.has(x.id) && (!regraId || x.regraId !== regraId));
  if (regraId) est.regras = est.regras.filter(r => r.id !== regraId);
}

export function encerrarRegra(est, regraId, dataIso) {
  const r = est.regras.find(x => x.id === regraId);
  if (!r) return;
  r.fim = diaAnterior(dataIso);
  est.lancamentos = est.lancamentos.filter(l => l.regraId !== regraId || l.data < dataIso);
  if (r.fim < r.inicio) est.regras = est.regras.filter(x => x !== r); // sem ocorrências: regra some
}

const COMUNS = ['valor', 'desc', 'catId', 'contaId'];
const doGrupo = (est, l) => est.lancamentos.filter(x => x.grupo === l.grupo && x.parcela[0] >= l.parcela[0]);

export function editar(est, id, novos, escopo, hojeIso) {
  const l = est.lancamentos.find(x => x.id === id);
  if (!l) return;
  if (escopo === 'proximos' && l.grupo) {
    for (const x of doGrupo(est, l))
      if (x === l) Object.assign(x, novos);
      else for (const k of COMUNS) if (k in novos) x[k] = novos[k];
  } else if (escopo === 'proximos' && l.regraId) {
    const antiga = est.regras.find(r => r.id === l.regraId);
    const inicio = novos.data ?? l.data, fim = antiga.fim, mes0 = mesDe(inicio);
    // meses já apagados ("Só este") ou ainda ocupados pela regra antiga não podem voltar nem duplicar
    const puladas = [...(antiga.puladas ?? []), ...est.lancamentos.filter(x => x.regraId === antiga.id && x.data < l.data).map(x => x.ref)]
      .filter(r => r >= mes0);
    const nova = { ...antiga, id: novoId(), inicio, dia: novos.data && novos.data !== l.data ? diaDe(inicio) : antiga.dia, fim, puladas };
    for (const k of ['tipo', ...COMUNS]) if (k in novos) nova[k] = novos[k];
    encerrarRegra(est, antiga.id, l.data);
    est.regras.push(nova);
    completarRecorrentes(est, hojeIso);
  } else {
    Object.assign(l, novos);
  }
}

export function apagar(est, id, escopo, hojeIso) {
  const l = est.lancamentos.find(x => x.id === id);
  if (!l) return;
  if (escopo === 'proximos' && l.grupo) {
    const fora = new Set(doGrupo(est, l));
    est.lancamentos = est.lancamentos.filter(x => !fora.has(x));
  } else if (escopo === 'proximos' && l.regraId) {
    encerrarRegra(est, l.regraId, l.data);
  } else {
    if (l.regraId) { const r = est.regras.find(x => x.id === l.regraId); if (r) (r.puladas ??= []).push(l.ref); }
    est.lancamentos = est.lancamentos.filter(x => x !== l);
  }
}

// Apaga e devolve `desfazer(est)`. Se nada mudou depois, volta ao estado de antes; senão reinsere só o que foi removido.
export function apagarDesfazivel(est, id, escopo, hojeIso) {
  const antes = structuredClone(est);
  apagar(est, id, escopo, hojeIso);
  const depois = JSON.stringify(est);
  return atual => {
    if (JSON.stringify(atual) === depois) return antes;
    const ids = new Set(atual.lancamentos.map(x => x.id));
    for (const l of antes.lancamentos.filter(x => !ids.has(x.id))) {
      atual.lancamentos.push(l);
      if (!l.regraId) continue;
      let r = atual.regras.find(x => x.id === l.regraId);
      const ant = antes.regras.find(x => x.id === l.regraId);
      if (!r && ant) atual.regras.push(r = ant);
      if (!r) continue;
      r.puladas = (r.puladas ?? []).filter(x => x !== l.ref);
      if (r.fim && r.fim < l.data) r.fim = ant?.fim ?? null;
    }
    return atual;
  };
}

// ---------- contas e categorias ----------

function upsert(lista, item) {
  item.id ??= novoId();
  const i = lista.findIndex(x => x.id === item.id);
  if (i < 0) lista.push(item); else lista[i] = item;
}

export const salvarConta = (est, conta) => upsert(est.contas, conta);
export const salvarCategoria = (est, cat) => upsert(est.categorias, cat);

export function apagarConta(est, id) {
  const fora = new Set(est.regras.filter(r => r.contaId === id).map(r => r.id));
  est.contas = est.contas.filter(c => c.id !== id);
  est.regras = est.regras.filter(r => !fora.has(r.id));
  est.lancamentos = est.lancamentos.filter(l => l.contaId !== id && l.paraId !== id && !fora.has(l.regraId));
}

export function apagarCategoria(est, id) {
  est.categorias = est.categorias.filter(c => c.id !== id);
  for (const x of [...est.lancamentos, ...est.regras]) if (x.catId === id) x.catId = null;
}
