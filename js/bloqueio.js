// Tela de bloqueio com Face ID / Touch ID via WebAuthn (autenticador da plataforma).
// 1º uso: cria a credencial (credentials.create) e guarda o id. Depois: credentials.get com esse id.
// ponytail: sem servidor não há verificação da assinatura; isto é um portão de presença no aparelho,
// não criptografia dos dados. Para proteção real, cifrar o localStorage com chave derivada de senha.
const CHAVE = 'orgfin-faceid';
const tela = document.getElementById('bloqueio');
const botao = document.getElementById('desbloquear');
const msg = document.getElementById('bloqueio-msg');
let travado = true, verificando = false;

const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const deB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const aleatorio = n => crypto.getRandomValues(new Uint8Array(n));

// Enquanto travado, o resto da página não recebe foco nem toque (inclui folhas/toasts criados depois)
function inerte(sim) {
  for (const el of document.body.children) if (el !== tela && el.tagName !== 'SCRIPT') el.inert = sim;
}
const obs = new MutationObserver(() => travado && inerte(true));
obs.observe(document.body, { childList: true });

function travar() {
  travado = true;
  tela.hidden = false;
  inerte(true);
}
function destravar() {
  travado = false;
  tela.hidden = true;
  inerte(false);
}
function falhou(texto) {
  msg.textContent = texto;
  botao.hidden = false;
  botao.focus();
}

async function autenticar() {
  if (verificando) return;
  verificando = true;
  botao.hidden = true;
  msg.textContent = '';
  try {
    const id = localStorage.getItem(CHAVE);
    if (id) {
      await navigator.credentials.get({ publicKey: {
        challenge: aleatorio(32),
        allowCredentials: [{ type: 'public-key', id: deB64(id), transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60000,
      } });
    } else {
      const cred = await navigator.credentials.create({ publicKey: {
        challenge: aleatorio(32),
        rp: { name: 'Finanças' },
        user: { id: aleatorio(16), name: 'Finanças', displayName: 'Finanças' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
        timeout: 60000,
      } });
      localStorage.setItem(CHAVE, b64(cred.rawId));
    }
    destravar();
  } catch (e) {
    falhou(e?.name === 'NotAllowedError' ? 'Leitura cancelada ou não reconhecida.' : 'Não foi possível verificar.');
  } finally {
    verificando = false;
  }
}

async function iniciar() {
  const temBiometria = window.PublicKeyCredential
    && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => false);
  // Sem Face ID/Touch ID (ex.: computador sem biometria): não bloqueia, senão os dados ficariam inacessíveis
  if (!temBiometria) return destravar();
  botao.addEventListener('click', autenticar);
  // Minimizou: trava já (esconde o conteúdo da miniatura do multitarefa). Voltou: pede Face ID de novo.
  // O próprio prompt do Face ID pode disparar "hidden"; ignorado enquanto verifica.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { if (!verificando) travar(); }
    else if (travado) autenticar();
  });
  autenticar();
}

inerte(true);
iniciar();
