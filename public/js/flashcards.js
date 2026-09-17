let fila = [];
let indiceAtual = 0;
let virado = false;

(async function main() {
  const user = await getOptionalUser();
  renderNavbar("flashcards", user);

  if (!user) {
    document.getElementById("add-form").style.display = "none";
    document.getElementById("revisao-area").innerHTML = loginGateHtml({
      mensagem: "Entre ou crie uma conta para revisar e guardar seus flashcards.",
      pagina: "flashcards.html",
    });
    document.getElementById("lista-geral").innerHTML = "";
    return;
  }

  Store.init(user.id);
  await carregarFila();
  await renderListaGeral();

  document.getElementById("add-btn").addEventListener("click", addFlashcard);
})();

async function carregarFila() {
  const hoje = new Date().toISOString().slice(0, 10);
  const todos = await Store.getFlashcards();
  fila = todos.filter((c) => c.proxima_revisao <= hoje);
  indiceAtual = 0;
  virado = false;
  renderRevisao();
}

function renderRevisao() {
  const area = document.getElementById("revisao-area");
  const subtitle = document.getElementById("subtitle");

  if (fila.length === 0) {
    subtitle.textContent = "Nenhum card pendente de revisão agora. Bom trabalho — volte mais tarde.";
    area.innerHTML = `<div class="empty-state">Tudo em dia por aqui. 🎉</div>`;
    return;
  }

  subtitle.textContent = `${fila.length - indiceAtual} card(s) pendente(s) de revisão hoje.`;

  if (indiceAtual >= fila.length) {
    area.innerHTML = `<div class="empty-state">Revisão de hoje concluída. 🎉</div>`;
    return;
  }

  const card = fila[indiceAtual];
  area.innerHTML = `
    <div class="card-stage">
      <div class="flashcard-wrap">
        <div class="lado-label" id="lado-label">frente</div>
        <div class="flashcard" id="flashcard"></div>
        <div class="avaliacao-row" id="avaliacao-row" style="display:none">
          <button class="btn btn-errei" data-q="0">Errei</button>
          <button class="btn btn-dificil" data-q="3">Difícil</button>
          <button class="btn btn-bom" data-q="4">Bom</button>
          <button class="btn btn-facil" data-q="5">Fácil</button>
        </div>
      </div>
    </div>
  `;

  const flashcardEl = document.getElementById("flashcard");
  flashcardEl.textContent = card.frente;
  flashcardEl.addEventListener("click", () => {
    virado = !virado;
    document.getElementById("lado-label").textContent = virado ? "verso" : "frente";
    flashcardEl.textContent = virado ? card.verso : card.frente;
    document.getElementById("avaliacao-row").style.display = virado ? "flex" : "none";
  });

  document.getElementById("avaliacao-row").addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const q = parseInt(btn.dataset.q, 10);
    await avaliarCard(card, q);
    indiceAtual += 1;
    virado = false;
    renderRevisao();
    renderListaGeral();
  });
}

// SM-2 simplificado: q vai de 0 (errou) a 5 (muito fácil).
async function avaliarCard(card, q) {
  let ease = card.facilidade || 2.5;
  let repeticoes = card.repeticoes || 0;
  let intervalo;

  if (q < 3) {
    repeticoes = 0;
    intervalo = 1;
  } else {
    if (repeticoes === 0) intervalo = 1;
    else if (repeticoes === 1) intervalo = 6;
    else intervalo = Math.round((card.intervalo_dias || 1) * ease);
    repeticoes += 1;
  }

  ease = ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (ease < 1.3) ease = 1.3;

  const proxima = new Date();
  proxima.setDate(proxima.getDate() + intervalo);

  await Store.updateFlashcard(card.id, {
    facilidade: Number(ease.toFixed(2)),
    intervalo_dias: intervalo,
    repeticoes,
    proxima_revisao: proxima.toISOString().slice(0, 10),
  });
}

async function addFlashcard() {
  const materia = document.getElementById("nova-materia").value.trim();
  const frente = document.getElementById("nova-frente").value.trim();
  const verso = document.getElementById("novo-verso").value.trim();
  if (!frente || !verso) return;

  await Store.addFlashcard({ materia, frente, verso });
  document.getElementById("nova-frente").value = "";
  document.getElementById("novo-verso").value = "";
  await carregarFila();
  await renderListaGeral();
}

async function renderListaGeral() {
  const lista = document.getElementById("lista-geral");
  const todos = await Store.getFlashcards();

  if (todos.length === 0) {
    lista.innerHTML = `<div class="empty-state">Nenhum flashcard cadastrado ainda.</div>`;
    return;
  }

  lista.innerHTML = "";
  todos.forEach((card) => {
    const row = document.createElement("div");
    row.className = "list-row";
    row.innerHTML = `
      <div style="flex:1">
        <div class="item-titulo"></div>
        <div class="item-materia"></div>
      </div>
      <div class="chip">próx.: ${card.proxima_revisao}</div>
      <button class="del-btn" style="background:none;border:none;color:var(--ink-dim);cursor:pointer;font-size:12px;padding:4px 8px">excluir</button>
    `;
    row.querySelector(".item-titulo").textContent = card.frente;
    row.querySelector(".item-materia").textContent = card.materia || "sem matéria";
    row.querySelector(".del-btn").addEventListener("click", async () => {
      if (confirm("Excluir este flashcard?")) {
        await Store.deleteFlashcard(card.id);
        await carregarFila();
        renderListaGeral();
      }
    });
    lista.appendChild(row);
  });
}
