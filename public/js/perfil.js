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

  const [perfil, planoItens, flashcards, sessoesFoco] = await Promise.all([
    Store.getPerfil(),
    Store.getPlanoItens(),
    Store.getFlashcards(),
    Store.getSessoesFoco(),
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
    <div class="panel" style="padding:18px 20px; font-size:13.5px; color:var(--ink-dim);">
      As matérias com nível (fraco/médio/bom) e a árvore de skills ficam na
      página <strong>Perfil do Treineiro</strong> — é a mesma conta, então o
      que você mapear lá o Professor já usa aqui para calibrar explicações e
      plano de estudos.
    </div>
  `;
})();
