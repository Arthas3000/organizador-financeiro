// Boot, troca de abas, render geral. Telas importam `app`.
import { carregar, salvar, completarRecorrentes } from './estado.js';
import { hoje } from './logica.js';
import { toast } from './ui.js';
import { abrirLancamento } from './lancamento.js';
import * as inicio from './inicio.js';
import * as extrato from './extrato.js';
import * as analise from './analise.js';
import * as mais from './mais.js';

const telas = { inicio, extrato, analise, mais };
const abas = Object.keys(telas);
const $ = s => document.querySelector(s);
let atual = 'inicio';
const inicial = carregar();

export const app = {
  est: inicial.est,
  get hoje() { return hoje(); }, // sempre a data de agora (o app pode ficar aberto por dias)
  salvarERender() {
    if (!salvar(app.est)) toast('Não foi possível salvar. Exporte um backup.');
    app.render();
  },
  render() { telas[atual].render($('#' + atual)); },
  irPara(aba) {
    if (aba === atual) return $('#' + aba).scrollTo({ top: 0, behavior: 'smooth' });
    $('#' + atual).classList.remove('on');
    atual = aba;
    app.render();
    $('#' + aba).classList.add('on');
    $('#tabs').style.setProperty('--i', abas.indexOf(aba));
    for (const b of document.querySelectorAll('#tabs button'))
      b.dataset.aba === aba ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current');
    $('#fab').classList.toggle('off', aba === 'mais');
    $('#fab').tabIndex = aba === 'mais' ? -1 : 0;
    $('#fab').setAttribute('aria-hidden', aba === 'mais');
  },
};

function iniciar() {
  completarRecorrentes(app.est, app.hoje);
  if (!inicial.corrompido) salvar(app.est); // dados ilegíveis: não sobrescreve até o usuário agir
  app.render();
  if (inicial.corrompido) toast('Os dados salvos estavam ilegíveis. Uma cópia foi guardada e o app abriu vazio.', { ms: 10000 });
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) app.irPara(b.dataset.aba); });
  $('#fab').addEventListener('click', () => abrirLancamento());
  // app aberto há dias: ao voltar, completa recorrentes e redesenha com a data de hoje
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    completarRecorrentes(app.est, app.hoje);
    app.render();
  });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}
iniciar();
