# Professor — site em HTML puro para estudar e organizar os estudos

Projeto complementar ao **Treineiro**. Enquanto o Treineiro foca em
diagnóstico e simulados (modo prova), o **Professor** foca em ENSINAR e em
ajudar a organizar a rotina de estudos: aulas sob demanda, plano de estudos
com cronograma, flashcards com revisão espaçada, sessões de foco (pomodoro)
e um diário de estudo.

Mesma stack do Treineiro (HTML/CSS/JS puro, sem framework, servidor mínimo
em Node para a chamada de IA) e — de propósito — o **mesmo projeto
Supabase**, para os dois sites "conversarem": login único, e as matérias/
níveis mapeados no Treineiro já chegam prontos aqui pra calibrar explicações
e o plano de estudos.

- **Início** (`index.html`) — chat com o Professor: explica conteúdo a
  fundo, tira dúvidas, monta plano de estudos e sugere flashcards a partir
  do que foi explicado. Funciona sem login para conversar; salvar algo no
  site (plano, flashcard, diário) exige login. A IA pode executar ações
  reais no site quando o usuário pede/confirma diretamente — adicionar ou
  concluir item do plano, criar flashcard, salvar entrada de diário, ou
  navegar pra outra página — com feedback em toast.
- **Plano** (`plano.html`) — cronograma de estudos, organizado por dia
  (hoje, atrasados, próximos). Pode ser preenchido manualmente ou pelo chat.
  Exige login.
- **Flashcards** (`flashcards.html`) — revisão espaçada (algoritmo SM-2
  simplificado): os cards voltam a aparecer no dia certo, e cada avaliação
  (Errei / Difícil / Bom / Fácil) recalcula o próximo intervalo. Exige
  login.
- **Foco** (`foco.html`) — timer de pomodoro (25/50 min de foco, 5/15 min de
  pausa) que registra a sessão ao terminar, e um diário de estudo em texto
  livre. Exige login.
- **Perfil** (`perfil.html`) — estatísticas de estudo (plano concluído,
  flashcards pendentes, minutos de foco). As matérias com nível e a árvore
  de skills continuam no Perfil do Treineiro — como é a mesma conta, o
  Professor já lê esses dados para calibrar o que ensina.

Login não é obrigatório para conversar no chat, só para salvar dados —
mesmo padrão do Treineiro.

## 1. Banco de dados (mesmo Supabase do Treineiro)

Este projeto **reaproveita o mesmo projeto Supabase** do Treineiro (mesma
`SUPABASE_URL`/`SUPABASE_ANON_KEY` em `public/js/supabaseClient.js` — copie
os valores de lá). Isso é o que faz os dois sites "conversarem": mesma
conta de login, e as tabelas `profiles`, `materias` e `simulados` já
existem e são usadas aqui também (o Professor só LÊ `materias`/`simulados` —
quem cria/edita essas duas é sempre o Treineiro).

Rode este SQL adicional no mesmo projeto Supabase (SQL editor) para criar as
4 tabelas novas, próprias do Professor:

```sql
create table public.plano_itens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null,
  materia text default '',
  data date not null,
  concluido boolean default false,
  created_at timestamptz default now()
);

create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  materia text default '',
  frente text not null,
  verso text not null,
  facilidade numeric default 2.5,
  intervalo_dias integer default 0,
  repeticoes integer default 0,
  proxima_revisao date default current_date,
  created_at timestamptz default now()
);

create table public.sessoes_foco (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  materia text default '',
  duracao_min integer not null,
  data timestamptz default now()
);

create table public.diario_estudo (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data date default current_date,
  texto text not null,
  created_at timestamptz default now()
);

alter table public.plano_itens enable row level security;
alter table public.flashcards enable row level security;
alter table public.sessoes_foco enable row level security;
alter table public.diario_estudo enable row level security;

create policy "plano_itens: all own" on public.plano_itens for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "flashcards: all own" on public.flashcards for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sessoes_foco: all own" on public.sessoes_foco for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "diario_estudo: all own" on public.diario_estudo for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

Depois de rodar o SQL, edite `public/js/supabaseClient.js` e cole a mesma
`SUPABASE_URL`/`SUPABASE_ANON_KEY` que já está em
`treineiro-html/public/js/supabaseClient.js`.

Se preferir manter os dois sites totalmente separados (contas diferentes),
é só criar um projeto Supabase novo, rodar tanto o SQL do Treineiro quanto
o daqui, e usar as chaves desse projeto — os dois sites funcionam também
assim, só perdem a integração de dados entre eles.

## 2. Rodando localmente

Pré-requisito: [Node.js](https://nodejs.org) 18 ou mais novo.

```bash
cp .env.example .env.local
```

Abra `.env.local` e cole sua chave de API de IA (mesmo processo do
Treineiro — veja o README dele para como conseguir uma chave gratuita do
Google Gemini, Groq, DeepSeek, Qwen ou Kimi).

```bash
node server.js
```

Acesse http://localhost:3000

## 3. Publicando (deploy)

Mesmo processo do Treineiro: suba a pasta para um repositório no GitHub e
importe na [Vercel](https://vercel.com) (plano grátis). Configure
`AI_API_BASE_URL`, `AI_API_MODEL` e `AI_API_KEY` em "Environment Variables".

Se os dois sites (Treineiro e Professor) forem publicados em domínios
separados, tudo bem — a integração entre eles acontece pelo banco (mesma
conta Supabase), não pela URL.

## 4. Estrutura do projeto

```
public/
  login.html                     → página de login/cadastro (mesma conta do Treineiro)
  index.html                     → página Início (chat com o Professor)
  plano.html                     → página Plano de estudos (cronograma)
  flashcards.html                 → página Flashcards (revisão espaçada)
  foco.html                       → página Foco (pomodoro + diário)
  perfil.html                     → página Perfil (estatísticas de estudo)
  css/
    style.css                     → estilos compartilhados por todas as páginas
  js/
    supabaseClient.js             → conexão com o projeto Supabase (mesmo do Treineiro)
    auth.js                        → sessão do usuário (getOptionalUser, requireAuth) e logout
    authGate.js                     → aviso de "entre ou crie conta"
    login.js                        → lógica da página de login/cadastro
    storage.js                     → camada de dados (fala com o Supabase)
    nav.js                          → barra de navegação + botão sair
    chat.js                         → lógica do chat (Início)
    plano.js                        → lógica da página Plano
    flashcards.js                    → lógica da página Flashcards (SM-2 simplificado)
    foco.js                          → lógica da página Foco (timer + diário)
    perfil.js                        → lógica do Perfil / estatísticas

api/
  chat.js                        → função serverless da Vercel (chama lib/chatHandler.js)

lib/
  systemPrompt.js                → TODO o comportamento do Professor, em português simples
  chatHandler.js                  → chamada à API de IA

server.js                      ← servidor local simples (sem dependências)
package.json
.env.example
.gitignore
README.md
```

## 5. Próximos passos sugeridos

- Notificação (e-mail ou push) quando houver flashcards pendentes de revisão.
- Exportar o plano de estudos da semana em PDF.
- Gráfico de minutos de foco por semana no Perfil.
