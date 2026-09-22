// Camada de dados: fala com o MESMO projeto Supabase do Treineiro. Por isso
// nome/prova alvo (profiles) e matérias com nível (materias) aparecem aqui
// automaticamente — é a conta e o raio-x que a pessoa já tem lá. Este
// arquivo só ACRESCENTA 4 tabelas novas, próprias do Professor: plano_itens,
// flashcards, sessoes_foco e diario_estudo (SQL completo no README).
// Chame Store.init(userId) uma vez, logo depois do login confirmado.

const Store = (() => {
  let userId = null;

  function init(uid) {
    userId = uid;
  }

  // ---------- Perfil (tabela compartilhada com o Treineiro) ----------
  async function getPerfil() {
    const { data, error } = await supabaseClient.from("profiles").select("*").eq("id", userId).single();
    if (error) {
      console.error(error);
      return { nome: "", prova_alvo: "" };
    }
    return data;
  }

  async function setPerfil(changes) {
    const { error } = await supabaseClient.from("profiles").update(changes).eq("id", userId);
    if (error) throw error;
  }

  // ---------- Matérias (tabela compartilhada com o Treineiro — só leitura aqui) ----------
  async function getMaterias() {
    const { data, error } = await supabaseClient
      .from("materias")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      console.error(error);
      return [];
    }
    return data;
  }

  // ---------- Simulados (tabela compartilhada com o Treineiro — só leitura aqui) ----------
  async function getSimulados() {
    const { data, error } = await supabaseClient
      .from("simulados")
      .select("*")
      .order("data", { ascending: false });
    if (error) {
      console.error(error);
      return [];
    }
    return data;
  }

  // ---------- Histórico de evolução das skills (tabela compartilhada — só leitura aqui) ----------
  // Preenchida pelo Treineiro (mesmo gatilho que alimenta a árvore de skills
  // por lá); usamos aqui só pra desenhar a mesma árvore/gráfico de evolução.
  async function getSkillHistory() {
    const { data, error } = await supabaseClient
      .from("skill_history")
      .select("*")
      .order("criado_em", { ascending: true });
    if (error) {
      console.error(error);
      return [];
    }
    return data;
  }

  // ---------- Plano de estudos (itens do cronograma) ----------
  async function getPlanoItens() {
    const { data, error } = await supabaseClient
      .from("plano_itens")
      .select("*")
      .order("data", { ascending: true });
    if (error) {
      console.error(error);
      return [];
    }
    return data;
  }

  async function addPlanoItem(item) {
    const { error } = await supabaseClient.from("plano_itens").insert({ user_id: userId, ...item });
    if (error) throw error;
  }

  async function updatePlanoItem(id, changes) {
    const { error } = await supabaseClient.from("plano_itens").update(changes).eq("id", id);
    if (error) throw error;
  }

  async function deletePlanoItem(id) {
    const { error } = await supabaseClient.from("plano_itens").delete().eq("id", id);
    if (error) throw error;
  }

  // ---------- Flashcards (revisão espaçada) ----------
  async function getFlashcards() {
    const { data, error } = await supabaseClient
      .from("flashcards")
      .select("*")
      .order("proxima_revisao", { ascending: true });
    if (error) {
      console.error(error);
      return [];
    }
    return data;
  }

  async function addFlashcard(card) {
    const { error } = await supabaseClient.from("flashcards").insert({
      user_id: userId,
      facilidade: 2.5,
      intervalo_dias: 0,
      repeticoes: 0,
      proxima_revisao: new Date().toISOString().slice(0, 10),
      ...card,
    });
    if (error) throw error;
  }

  async function updateFlashcard(id, changes) {
    const { error } = await supabaseClient.from("flashcards").update(changes).eq("id", id);
    if (error) throw error;
  }

  async function deleteFlashcard(id) {
    const { error } = await supabaseClient.from("flashcards").delete().eq("id", id);
    if (error) throw error;
  }

  // ---------- Sessões de foco (pomodoro) ----------
  async function getSessoesFoco() {
    const { data, error } = await supabaseClient
      .from("sessoes_foco")
      .select("*")
      .order("data", { ascending: false });
    if (error) {
      console.error(error);
      return [];
    }
    return data;
  }

  async function addSessaoFoco(sessao) {
    const { error } = await supabaseClient.from("sessoes_foco").insert({ user_id: userId, ...sessao });
    if (error) throw error;
  }

  // ---------- Diário de estudo ----------
  async function getDiario() {
    const { data, error } = await supabaseClient
      .from("diario_estudo")
      .select("*")
      .order("data", { ascending: false });
    if (error) {
      console.error(error);
      return [];
    }
    return data;
  }

  async function addEntradaDiario(entrada) {
    const { error } = await supabaseClient.from("diario_estudo").insert({ user_id: userId, ...entrada });
    if (error) throw error;
  }

  // ---------- Histórico de chat (fica só no navegador, por usuário) ----------
  function getChatHistorico() {
    const raw = localStorage.getItem("professor_chat_" + userId);
    return raw ? JSON.parse(raw) : null;
  }

  function setChatHistorico(messages) {
    localStorage.setItem("professor_chat_" + userId, JSON.stringify(messages));
  }

  return {
    init,
    getPerfil,
    setPerfil,
    getMaterias,
    getSimulados,
    getSkillHistory,
    getPlanoItens,
    addPlanoItem,
    updatePlanoItem,
    deletePlanoItem,
    getFlashcards,
    addFlashcard,
    updateFlashcard,
    deleteFlashcard,
    getSessoesFoco,
    addSessaoFoco,
    getDiario,
    addEntradaDiario,
    getChatHistorico,
    setChatHistorico,
  };
})();
