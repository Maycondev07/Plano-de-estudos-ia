let segundosRestantes = 25 * 60;
let duracaoOriginalMin = 25;
let timerInterval = null;
let rodando = false;

(async function main() {
  const user = await getOptionalUser();
  renderNavbar("foco", user);

  if (!user) {
    document.getElementById("foco-area").parentElement.innerHTML = loginGateHtml({
      mensagem: "Entre ou crie uma conta para registrar suas sessões de foco e seu diário.",
      pagina: "foco.html",
    });
    return;
  }

  Store.init(user.id);
  atualizarTimerDisplay();
  await renderHistorico();

  document.getElementById("duracao-select").addEventListener("change", (e) => {
    if (rodando) return;
    duracaoOriginalMin = parseInt(e.target.value, 10);
    segundosRestantes = duracaoOriginalMin * 60;
    atualizarTimerDisplay();
  });

  document.getElementById("iniciar-btn").addEventListener("click", iniciarTimer);
  document.getElementById("parar-btn").addEventListener("click", pararTimer);
  document.getElementById("salvar-diario-btn").addEventListener("click", salvarDiario);
})();

function atualizarTimerDisplay() {
  const mm = String(Math.floor(segundosRestantes / 60)).padStart(2, "0");
  const ss = String(segundosRestantes % 60).padStart(2, "0");
  document.getElementById("foco-timer").textContent = `${mm}:${ss}`;
}

function iniciarTimer() {
  if (rodando) return;
  rodando = true;
  document.getElementById("iniciar-btn").style.display = "none";
  document.getElementById("parar-btn").style.display = "inline-block";
  document.getElementById("duracao-select").disabled = true;

  timerInterval = setInterval(async () => {
    segundosRestantes -= 1;
    atualizarTimerDisplay();
    if (segundosRestantes <= 0) {
      clearInterval(timerInterval);
      rodando = false;
      document.getElementById("iniciar-btn").style.display = "inline-block";
      document.getElementById("parar-btn").style.display = "none";
      document.getElementById("duracao-select").disabled = false;
      await registrarSessao(duracaoOriginalMin, true);
      alert("Sessão concluída! 🎉");
      segundosRestantes = duracaoOriginalMin * 60;
      atualizarTimerDisplay();
    }
  }, 1000);
}

async function pararTimer() {
  clearInterval(timerInterval);
  rodando = false;
  document.getElementById("iniciar-btn").style.display = "inline-block";
  document.getElementById("parar-btn").style.display = "none";
  document.getElementById("duracao-select").disabled = false;

  const decorridoMin = Math.round(duracaoOriginalMin - segundosRestantes / 60);
  if (decorridoMin > 0) {
    await registrarSessao(decorridoMin, false);
  }
  segundosRestantes = duracaoOriginalMin * 60;
  atualizarTimerDisplay();
}

async function registrarSessao(duracaoMin, completa) {
  const materia = document.getElementById("materia-sessao").value.trim();
  try {
    await Store.addSessaoFoco({ materia, duracao_min: duracaoMin });
    await renderHistorico();
  } catch (err) {
    console.error(err);
  }
}

async function salvarDiario() {
  const texto = document.getElementById("diario-input").value.trim();
  if (!texto) return;
  await Store.addEntradaDiario({ texto, data: new Date().toISOString().slice(0, 10) });
  document.getElementById("diario-input").value = "";
  await renderHistorico();
}

async function renderHistorico() {
  const el = document.getElementById("historico");
  const [sessoes, diario] = await Promise.all([Store.getSessoesFoco(), Store.getDiario()]);

  if (sessoes.length === 0 && diario.length === 0) {
    el.innerHTML = `<div class="empty-state">Nenhuma sessão ou entrada de diário ainda.</div>`;
    return;
  }

  el.innerHTML = "";

  diario.slice(0, 10).forEach((d) => {
    const row = document.createElement("div");
    row.className = "list-row";
    row.innerHTML = `
      <div class="chip">${d.data}</div>
      <div style="flex:1"></div>
    `;
    row.querySelector("div:last-child").textContent = d.texto;
    el.appendChild(row);
  });

  sessoes.slice(0, 10).forEach((s) => {
    const row = document.createElement("div");
    row.className = "list-row";
    const data = new Date(s.data);
    row.innerHTML = `
      <div class="chip">${data.toLocaleDateString("pt-BR")}</div>
      <div style="flex:1"></div>
      <div class="item-materia">${s.duracao_min} min</div>
    `;
    row.querySelector("div:nth-child(2)").textContent = s.materia || "sessão de foco";
    el.appendChild(row);
  });
}
