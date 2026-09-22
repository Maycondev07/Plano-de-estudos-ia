(async function main() {
  const user = await getOptionalUser();
  renderNavbar("perfil", user);

  const subtitle = document.getElementById("subtitle");
  const conteudo = document.getElementById("conteudo");

  if (!user) {
    subtitle.textContent = "Entre para ver suas estatísticas de estudo.";
    conteudo.innerHTML = loginGateHtml({
      mensagem: "Entre ou crie uma conta para ver seu progresso.",
      pagina: "perfil.html",
    });
    return;
  }

  Store.init(user.id);

  const [perfil, planoItens, flashcards, sessoesFoco, materias, skillHistory] = await Promise.all([
    Store.getPerfil(),
    Store.getPlanoItens(),
    Store.getFlashcards(),
    Store.getSessoesFoco(),
    Store.getMaterias(),
    Store.getSkillHistory(),
  ]);

  subtitle.textContent = perfil.nome
    ? `${perfil.nome}${perfil.prova_alvo ? " — estudando para " + perfil.prova_alvo : ""}`
    : "Suas estatísticas de estudo com o Professor.";

  const hoje = new Date().toISOString().slice(0, 10);
  const planoConcluidos = planoItens.filter((i) => i.concluido).length;
  const planoPct = planoItens.length ? Math.round((planoConcluidos / planoItens.length) * 100) : 0;
  const flashcardsPendentes = flashcards.filter((c) => c.proxima_revisao <= hoje).length;
  const minutosFoco = sessoesFoco.reduce((soma, s) => soma + (s.duracao_min || 0), 0);

  conteudo.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-num">${planoConcluidos}/${planoItens.length}</div>
        <div class="stat-label">itens do plano concluídos (${planoPct}%)</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${flashcards.length}</div>
        <div class="stat-label">flashcards cadastrados</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${flashcardsPendentes}</div>
        <div class="stat-label">pendentes de revisão hoje</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${minutosFoco}</div>
        <div class="stat-label">minutos de foco registrados</div>
      </div>
    </div>

    <div class="label" style="margin-top:38px">árvore de skills</div>
    <p class="page-subtitle" style="margin-bottom:0">
      A mesma árvore do Treineiro (mesma conta, mesmos dados) — cada matéria
      pode ter submatérias, e o anel mostra o domínio real de 0% a 100%. O
      Professor só usa essa árvore pra calibrar explicações e o plano de
      estudos; quem cadastra ou ajusta matérias é sempre o Treineiro.
    </p>
    <div class="tree-legend">
      <div style="display:flex; flex-direction:column; gap:4px;">
        <div class="gradient-bar"></div>
        <div class="gradient-labels"><span>0%</span><span>50%</span><span>100%</span></div>
      </div>
    </div>
    <div id="tree-wrap">
      <svg id="tree-svg"></svg>
      <div id="tree-nodes"></div>
    </div>

    <div class="label" style="margin-top:38px">evolução geral</div>
    <p class="page-subtitle" style="margin-bottom:16px">
      Média do domínio (0% a 100%) ao longo do tempo, somando matérias e
      submatérias — atualizada pelo Treineiro sempre que uma matéria muda.
    </p>
    <div class="panel" style="padding:16px;">
      <canvas id="evo-canvas" height="180"></canvas>
      <div id="evo-empty" class="empty-state" style="display:none">
        Ainda não há histórico suficiente. Cadastre matérias no Treineiro e vá
        ajustando o domínio delas conforme evolui.
      </div>
    </div>
  `;

  const nomeUsuario = (perfil.nome || "Você").trim() || "Você";
  SkillTree.renderSkillTree({
    wrapId: "tree-wrap",
    svgId: "tree-svg",
    nodesId: "tree-nodes",
    materias,
    nomeUsuario,
    emptyMensagem: "Nenhuma matéria cadastrada ainda. Mapeie suas matérias no Treineiro para ver a árvore aqui também.",
  });
  SkillTree.renderEvolucao({ canvasId: "evo-canvas", emptyId: "evo-empty", skillHistory });
})();
