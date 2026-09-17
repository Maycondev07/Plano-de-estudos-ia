const WELCOME = `Oi! Eu sou o Professor. Me conta o que você quer estudar hoje — pode ser
uma dúvida pontual, um tema pra eu explicar do zero, ou pedir um plano de
estudos pra sua prova alvo. Se você já usa o Treineiro com a mesma conta, eu
já enxergo suas matérias e os níveis mapeados por lá.`;

const PAGINAS_PERMITIDAS = ["index.html", "plano.html", "flashcards.html", "foco.html", "perfil.html"];

// Ajuste esse número pra bater com o limite diário (em tokens) do seu
// provedor de IA — é só uma estimativa local, calculada a partir do "usage"
// que a API retorna a cada resposta; não é o contador oficial do provedor.
const DAILY_TOKEN_BUDGET = 200000;

let state = {
  messages: [{ role: "assistant", content: WELCOME }],
  loading: false,
};
let currentUser = null;

if (window.marked) {
  marked.setOptions({ breaks: true, gfm: true });
}

(async function main() {
  currentUser = await getOptionalUser();
  Store.init(currentUser ? currentUser.id : "visitante");
  renderNavbar("inicio", currentUser);

  state.messages = Store.getChatHistorico() || state.messages;
  renderMessages();
  renderTokenCounter();

  document.getElementById("send-btn").addEventListener("click", sendMessage);
  document.getElementById("input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  document.getElementById("clear-btn").addEventListener("click", clearChat);
})();

function clearChat() {
  if (!confirm("Limpar esta conversa? O histórico do chat será apagado (o que já foi salvo no plano, flashcards etc. continua intacto).")) {
    return;
  }
  state.messages = [{ role: "assistant", content: WELCOME }];
  Store.setChatHistorico(state.messages);
  hideBanner("error-banner");
  hideBanner("plano-banner");
  renderMessages();
}

async function sendMessage() {
  const input = document.getElementById("input");
  const text = input.value.trim();
  if (!text || state.loading) return;

  state.messages.push({ role: "user", content: text });
  input.value = "";
  state.loading = true;
  hideBanner("error-banner");
  hideBanner("plano-banner");
  renderMessages();

  try {
    let contexto = {
      perfil: null,
      materias: [],
      planoItens: [],
      flashcardsPendentes: 0,
      sessoesFoco: [],
      diario: [],
    };
    if (currentUser) {
      try {
        const [perfil, materias, planoItens, flashcards, sessoesFoco, diario] = await Promise.all([
          Store.getPerfil(),
          Store.getMaterias(),
          Store.getPlanoItens(),
          Store.getFlashcards(),
          Store.getSessoesFoco(),
          Store.getDiario(),
        ]);
        const hoje = new Date().toISOString().slice(0, 10);
        const flashcardsPendentes = flashcards.filter((c) => c.proxima_revisao <= hoje).length;
        contexto = {
          perfil,
          materias,
          planoItens,
          flashcardsPendentes,
          sessoesFoco: sessoesFoco.slice(0, 20),
          diario: diario.slice(0, 3),
        };
      } catch (err) {
        // Se der erro ao buscar o contexto, segue a conversa sem ele em vez de travar o chat.
      }
    }

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: state.messages,
        ...contexto,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      showError(data.error || "Erro desconhecido.");
    } else {
      const { texto, acoes } = extrairAcoes(data.reply);
      state.messages.push({ role: "assistant", content: texto });
      Store.setChatHistorico(state.messages);
      checkForPlano(texto);
      if (data.usage && data.usage.total_tokens) {
        registrarTokensUsados(data.usage.total_tokens);
      }
      if (acoes.length) {
        // não trava a resposta: executa em seguida, com feedback via toast
        executarAcoes(acoes);
      }
    }
  } catch (err) {
    showError(err.message);
  } finally {
    state.loading = false;
    renderMessages();
  }
}

// ---------- Ações que a IA pode executar direto no site ----------
function extrairAcoes(reply) {
  const linhas = reply.split("\n");
  const acoes = [];
  const restante = [];

  linhas.forEach((linha) => {
    const m = linha.match(/^\s*A[ÇC][AÃ]O:\s*(\w+)\s*\|\s*(.+)$/i);
    if (m) {
      acoes.push({ tipo: m[1].toLowerCase(), args: parseArgsAcao(m[2]) });
    } else {
      restante.push(linha);
    }
  });

  const texto = restante.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return { texto: texto || reply, acoes };
}

function parseArgsAcao(str) {
  const args = {};
  str.split("|").forEach((par) => {
    const idx = par.indexOf("=");
    if (idx === -1) return;
    const chave = par.slice(0, idx).trim().toLowerCase();
    const valor = par.slice(idx + 1).trim();
    if (chave) args[chave] = valor;
  });
  return args;
}

async function executarAcoes(acoes) {
  if (!currentUser) {
    showToast("O Professor tentou fazer uma alteração, mas é preciso entrar ou criar conta pra isso funcionar.", "erro");
    return;
  }

  for (const acao of acoes) {
    try {
      if (acao.tipo === "adicionar_item_plano") {
        if (!acao.args.titulo || !acao.args.data) continue;
        await Store.addPlanoItem({
          titulo: acao.args.titulo,
          materia: acao.args.materia || "",
          data: acao.args.data,
          concluido: false,
        });
        showToast(`✓ "${acao.args.titulo}" adicionado ao plano (${acao.args.data}).`);
      } else if (acao.tipo === "concluir_item_plano") {
        if (!acao.args.titulo) continue;
        const itens = await Store.getPlanoItens();
        const alvo = itens.find((i) => i.titulo.trim().toLowerCase() === acao.args.titulo.trim().toLowerCase());
        if (alvo) {
          await Store.updatePlanoItem(alvo.id, { concluido: true });
          showToast(`✓ "${acao.args.titulo}" marcado como concluído.`);
        }
      } else if (acao.tipo === "remover_item_plano") {
        if (!acao.args.titulo) continue;
        const itens = await Store.getPlanoItens();
        const alvo = itens.find((i) => i.titulo.trim().toLowerCase() === acao.args.titulo.trim().toLowerCase());
        if (alvo) {
          await Store.deletePlanoItem(alvo.id);
          showToast(`✓ "${acao.args.titulo}" removido do plano.`);
        }
      } else if (acao.tipo === "adicionar_flashcard") {
        if (!acao.args.frente || !acao.args.verso) continue;
        await Store.addFlashcard({
          materia: acao.args.materia || "",
          frente: acao.args.frente,
          verso: acao.args.verso,
        });
        showToast(`✓ Flashcard adicionado.`);
      } else if (acao.tipo === "adicionar_entrada_diario") {
        if (!acao.args.texto) continue;
        await Store.addEntradaDiario({ texto: acao.args.texto, data: new Date().toISOString().slice(0, 10) });
        showToast(`✓ Entrada de diário salva.`);
      } else if (acao.tipo === "navegar") {
        const pagina = (acao.args.pagina || "").trim();
        if (PAGINAS_PERMITIDAS.includes(pagina)) {
          showToast(`↳ Indo para ${pagina}…`);
          setTimeout(() => {
            window.location.href = pagina;
          }, 650);
        }
      }
    } catch (err) {
      showToast("Não consegui executar uma ação: " + err.message, "erro");
    }
  }
}

// ---------- Banner para salvar um plano de estudos gerado de uma vez ----------
function checkForPlano(reply) {
  const match = reply.match(/plano gerado:\s*([^\n]+)/i);
  if (!match) return;
  const itens = parsePlanoList(match[1]);
  if (itens.length) showPlanoBanner(itens);
}

function parsePlanoList(texto) {
  return texto
    .split(";")
    .map((pedaco) => {
      const m = pedaco.trim().match(/^(.+?)\s*\(([^,]*),\s*(\d{4}-\d{2}-\d{2})\)$/);
      if (!m) return null;
      return { titulo: m[1].trim(), materia: m[2].trim(), data: m[3].trim() };
    })
    .filter(Boolean);
}

function showPlanoBanner(itens) {
  const banner = document.getElementById("plano-banner");
  if (!banner) return;
  banner.style.display = "flex";

  if (!currentUser) {
    banner.querySelector("span").textContent =
      `Montei um plano com ${itens.length} item(ns). Crie uma conta ou entre para salvá-lo de uma vez.`;
    document.getElementById("plano-yes").textContent = "Entrar / Criar conta";
    document.getElementById("plano-yes").onclick = () => {
      window.location.href = "login.html?next=index.html";
    };
    document.getElementById("plano-no").onclick = () => hideBanner("plano-banner");
    return;
  }

  banner.querySelector("span").textContent =
    `Montei um plano com ${itens.length} item(ns). Quer salvar tudo de uma vez na página "Plano"?`;
  document.getElementById("plano-yes").textContent = "Salvar plano";
  document.getElementById("plano-yes").onclick = async () => {
    try {
      const existentes = await Store.getPlanoItens();
      const chaveExistente = (i) => `${i.titulo.trim().toLowerCase()}|${i.data}`;
      const existentesSet = new Set(existentes.map(chaveExistente));
      const novos = itens.filter((i) => !existentesSet.has(chaveExistente(i)));

      for (const item of novos) {
        await Store.addPlanoItem({ titulo: item.titulo, materia: item.materia, data: item.data, concluido: false });
      }

      hideBanner("plano-banner");
      if (novos.length) {
        alert(`${novos.length} item(ns) salvo(s) no plano! Veja na página "Plano".`);
      } else {
        alert("Esses itens já estavam cadastrados no plano.");
      }
    } catch (err) {
      showError("Não consegui salvar o plano: " + err.message);
    }
  };
  document.getElementById("plano-no").onclick = () => hideBanner("plano-banner");
}

// ---------- Contador de tokens restantes hoje (estimativa local) ----------
function getTokenUsageKey() {
  const dia = new Date().toISOString().slice(0, 10);
  return `professor_tokens_${currentUser ? currentUser.id : "visitante"}_${dia}`;
}

function getTokensUsadosHoje() {
  const raw = localStorage.getItem(getTokenUsageKey());
  return raw ? parseInt(raw, 10) || 0 : 0;
}

function registrarTokensUsados(qtd) {
  const usados = getTokensUsadosHoje() + qtd;
  localStorage.setItem(getTokenUsageKey(), String(usados));
  renderTokenCounter();
}

function renderTokenCounter() {
  const el = document.getElementById("token-counter");
  if (!el) return;
  const usados = getTokensUsadosHoje();
  const restantes = Math.max(0, DAILY_TOKEN_BUDGET - usados);
  el.textContent = `🪙 ${restantes.toLocaleString("pt-BR")} tokens restantes hoje (estimativa)`;
}

// ---------- Toasts (feedback rápido de ações) ----------
function showToast(mensagem, tipo) {
  const stack = document.getElementById("toast-stack");
  if (!stack) return;
  const el = document.createElement("div");
  el.className = "toast" + (tipo === "erro" ? " erro" : "");
  el.textContent = mensagem;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

function showError(message) {
  const el = document.getElementById("error-banner");
  el.textContent = message;
  el.style.display = "block";
}

function hideBanner(id) {
  document.getElementById(id).style.display = "none";
}

function renderMessages() {
  const container = document.getElementById("messages");
  container.innerHTML = "";
  state.messages.forEach((m) => {
    const row = document.createElement("div");
    row.className = "msg-row";
    row.innerHTML = `
      <div class="msg-role ${m.role === "user" ? "user" : ""}">${m.role === "user" ? "você" : "professor"}</div>
      <div class="msg-content"></div>
    `;
    const contentEl = row.querySelector(".msg-content");
    if (window.marked && window.DOMPurify) {
      contentEl.innerHTML = DOMPurify.sanitize(marked.parse(m.content || ""));
    } else {
      contentEl.textContent = m.content;
    }
    container.appendChild(row);
  });
  if (state.loading) {
    const row = document.createElement("div");
    row.style.cssText = "padding:16px 0; color:var(--ink-dim); font-family:var(--mono); font-size:13px;";
    row.textContent = "professor está escrevendo…";
    container.appendChild(row);
  }
  container.scrollTop = container.scrollHeight;
}
