(async function main() {
  const user = await getOptionalUser();
  renderNavbar("plano", user);

  if (!user) {
    document.getElementById("add-form").style.display = "none";
    document.getElementById("lista").innerHTML = loginGateHtml({
      mensagem: "Entre ou crie uma conta para organizar seu plano de estudos.",
      pagina: "plano.html",
    });
    return;
  }

  Store.init(user.id);

  const hoje = new Date().toISOString().slice(0, 10);
  document.getElementById("nova-data").value = hoje;

  await renderLista();

  document.getElementById("add-btn").addEventListener("click", addItem);
})();

function formatarTituloDia(data, hoje) {
  if (data === hoje) return "Hoje";
  if (data < hoje) return `Atrasado — ${formatarData(data)}`;
  return formatarData(data);
}

function formatarData(iso) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

async function renderLista() {
  const lista = document.getElementById("lista");
  lista.innerHTML = `<div class="empty-state">Carregando…</div>`;
  const itens = await Store.getPlanoItens();

  if (itens.length === 0) {
    lista.innerHTML = `<div class="empty-state">Nenhum item no plano ainda. Adicione manualmente acima, ou peça pro Professor montar um cronograma no chat.</div>`;
    return;
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const grupos = {};
  itens.forEach((item) => {
    if (!grupos[item.data]) grupos[item.data] = [];
    grupos[item.data].push(item);
  });

  const datasOrdenadas = Object.keys(grupos).sort();

  lista.innerHTML = "";
  datasOrdenadas.forEach((data) => {
    const grupo = document.createElement("div");
    grupo.className = "dia-grupo";
    const atrasado = data < hoje;
    grupo.innerHTML = `<div class="dia-titulo ${atrasado ? "atrasado" : ""}">${formatarTituloDia(data, hoje)}</div>`;

    const panel = document.createElement("div");
    panel.className = "panel";

    grupos[data].forEach((item) => {
      const row = document.createElement("div");
      row.className = "list-row item-row";
      row.innerHTML = `
        <input type="checkbox" ${item.concluido ? "checked" : ""} />
        <div style="flex:1">
          <div class="item-titulo ${item.concluido ? "feito" : ""}"></div>
          ${item.materia ? `<div class="item-materia"></div>` : ""}
        </div>
        <button class="del-btn" style="background:none;border:none;color:var(--ink-dim);cursor:pointer;font-size:12px;padding:4px 8px">excluir</button>
      `;
      row.querySelector(".item-titulo").textContent = item.titulo;
      if (item.materia) row.querySelector(".item-materia").textContent = item.materia;
      row.querySelector('input[type="checkbox"]').addEventListener("change", async (e) => {
        await Store.updatePlanoItem(item.id, { concluido: e.target.checked });
        renderLista();
      });
      row.querySelector(".del-btn").addEventListener("click", async () => {
        if (confirm(`Excluir "${item.titulo}"?`)) {
          await Store.deletePlanoItem(item.id);
          renderLista();
        }
      });
      panel.appendChild(row);
    });

    grupo.appendChild(panel);
    lista.appendChild(grupo);
  });
}

async function addItem() {
  const titulo = document.getElementById("novo-titulo").value.trim();
  const materia = document.getElementById("nova-materia").value.trim();
  const data = document.getElementById("nova-data").value;
  if (!titulo || !data) return;

  await Store.addPlanoItem({ titulo, materia, data, concluido: false });
  document.getElementById("novo-titulo").value = "";
  document.getElementById("nova-materia").value = "";
  renderLista();
}
