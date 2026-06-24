# Design

Sistema visual do Simulador Sabre GDS, capturado do código real em `index.html`. Tema: **terminal GDS** — verde fosfórico sobre preto, monoespaçado, janela de terminal. Estratégia de cor: **Committed** (o verde de fósforo carrega a identidade da superfície inteira).

## Theme

- **Modo:** dark, único (não há tema claro).
- **Atmosfera:** terminal de trabalho real. Fundo com `radial-gradient` sutil verde-escuro no topo, simulando o brilho de um monitor de fósforo.
- **Forma:** cantos arredondados moderados (8–12px), bordas finas verde-acinzentadas, sombra interna preta + sombra de elevação na "tela".

## Color

Tokens reais (`:root`), em hex como no código. Conversão para OKLCH recomendada em refactors futuros.

| Token | Valor | Papel |
|---|---|---|
| `--bg` | `#0a0e0a` | Fundo do corpo (base do gradiente) |
| `--panel` | `#0f160f` | Superfície da "tela"/terminal e cartões |
| `--line` | `#1d2a1d` | Bordas e divisores |
| `--green` | `#3df57a` | **Accent primário** — ações, foco, acertos, títulos, input |
| `--green-dim` | `#1f7a3c` | Verde secundário — bordas ativas, links, detalhes |
| `--amber` | `#ffcc66` | Atenção — eyebrow de tarefa, passo atual, dicas de revisão |
| `--red` | `#ff5d5d` | Erro — feedback negativo, módulos fracos |
| `--txt` | `#cfe8d4` | Texto primário (verde-claro neutro) |
| `--muted` | `#7a9a83` | Texto secundário, legendas, explicações |

**Estado (semântica):**
- **Acerto/sucesso:** `--green` + ícone ✅ + texto. Borda `--green-dim`, fundo `#0a1a0f`.
- **Erro:** `--red` + ícone ❌ + texto. Borda `#5a2020`, fundo `#1a0a0a`.
- **Atual (em foco da tarefa):** `--amber`, com `box-shadow` interno âmbar.
- **Selecionado (módulo/modo):** borda `--green`, fundo `#0d1a10`.

**Contraste (medido):** `--muted` ~6.2–6.8:1 e input ~13.8:1 sobre o fundo (AA OK). `--green` como texto (footer `code`, feedback) rende ~13.5:1. ⚠️ `--green-dim` rende apenas **3.91:1** — não usar como texto pequeno (reservado a bordas/detalhes; o footer foi migrado para `--green`).

> Regra: cor nunca é o único canal de estado — sempre acompanha ícone + texto (acerto/erro/atual).

## Typography

- **Família única (intencional):** `'SF Mono', ui-monospace, 'Cascadia Code', 'Courier New', monospace` (`--mono`). A monoespaçada *é* a identidade do produto; não pareie com display/body.
- **Escala (fixa, em px, não fluida):** logo 18 · h2 15 · pergunta/input 16 · corpo 13 · legenda/explicação 11–12 · resposta do flashcard 20 · score final 34.
- **Peso:** 700 para logo, títulos, botões primários e termos em destaque (`<b>`); 400 para corpo.
- **Tracking:** `letter-spacing` 1–2px em logo, títulos e respostas (reforça a cara de terminal). `text-transform: uppercase` no input e em eyebrows curtos.
- **Altura de linha:** 1.4–1.55 em texto corrido.

## Spacing & Layout

- **Container:** centralizado, `max-width: 780px`, `padding: 24px` no corpo. Largura de produto desktop-first.
- **Ritmo:** padding interno da "tela" 22px; espaçamentos verticais 6/8/12/14/18px.
- **Grids responsivos sem breakpoint:**
  - Módulos: `repeat(auto-fill, minmax(200px, 1fr))`.
  - Ficha do PNR: `repeat(auto-fit, minmax(150px, 1fr))`.
  - Modos: `flex` com `flex:1; min-width:160px` + `flex-wrap`.
- **Responsivo é estrutural:** o conteúdo colapsa para coluna única no mobile via os `minmax`/`flex-wrap`; tipografia permanece fixa.

## Components

Janela de terminal como casca de tudo.

- **Terminal window (`.screen` + `.bar`):** barra superior com três `dot` (vermelho/amarelo/verde) e legenda "sem conexão com sistema real". Borda `--line`, sombra interna preta + elevação.
- **First-run hint (`.firstrun`):** dica de primeira-visita no setup, borda tracejada `--green-dim` (igual à `.task`), com botão `✕` de dispensar. Mostrada só até o usuário iniciar um treino ou dispensar (`localStorage: sabre-onboarded`). Termos-âncora em `--green`.
- **Bulk-select (`.modtools` + `.linkbtn`):** "marcar todos / limpar" acima do grid de módulos. Botões-texto discretos em `--muted`, acendem para `--green` no hover.
- **Module chip (`label.mod`):** checkbox + label + contador à direita. Hover acende borda `--green-dim`; `accent-color: --green` no checkbox.
- **Mode segment (`.seg`):** cartão selecionável de modo (`<button>`, já focável/operável por teclado, com `:focus-visible` em `--green`). Estado `.on` = borda `--green` + fundo `#0d1a10`. Há 4 modos: Praticar, Flashcard, PNR completo e **Revisão** (🔁, dirigido pelo SRS).
- **SRS bar (`.srsbar`):** linha sóbria no setup com o resumo de revisão (`» N comando(s) para revisar hoje · sequência: N dias`, número de vencidos em `--amber`) e o link "ver progresso". Só aparece quando há histórico.
- **Progress panel (`.progress-panel`):** painel "Seu progresso" que reusa `.brk-row` para a distribuição por caixa (Leitner) e os comandos mais fracos, e a confirmação inline `.confirm` (âmbar) para "limpar progresso". Padrão de *recognition over recall* aplicado ao acompanhamento.
- **Prompt input (`.prompt-line`):** prefixo `»` verde + input transparente em caixa escura `#060a06`. Texto em maiúsculas, tracking 1px. *(Pendência: precisa de estado de foco visível.)*
- **Action row (`.row button`):** botões secundários com borda `--line`; `.primary` em `--green` sobre `#04140a`.
- **Primary button (`button.go`):** bloco cheio `--green`, texto escuro, peso 700, full-width. Estado `:disabled` com `opacity:.4`.
- **Feedback (`.fb.ok` / `.fb.no`):** bloco com cabeçalho (ícone + rótulo), comando em `<code>` realçado e explicação em `--muted`.
- **Exit confirm (`.confirm`):** barra inline (não modal nativo) no topo do treino, borda `--amber`, mensagem + "Continuar treino" (primary) / "Sair sem salvar". Só aparece ao apertar Esc com progresso (`tot>0`); `role="alertdialog"`, foco inicial no botão seguro, Esc cancela. Substitui o `confirm()` nativo.
- **PNR ficha (`.ficha`) + checklist (`.chip`):** dados da reserva em grid + chips de passo (`done` ✓ / `cur` ▶ / pendente ○). Padrão de *recognition over recall*.
- **Breakdown bars (`.brk-row`):** nome + barra proporcional + valor; cor da barra por faixa (verde ≥80%, âmbar ≥50%, vermelho abaixo).
- **kbd / code:** `kbd` com borda inferior dupla para teclas; `code` em caixa escura com texto verde.

## Motion

- **Princípio:** discreta, comunica estado, nunca decorativa. Transições de 150ms em hover/seleção (`.15s`), 300–400ms em barras de progresso/breakdown.
- **Reduced motion:** tratado via `@media (prefers-reduced-motion: reduce)` (zera transições/animações).
- **Pendência de perf (P3, baixo impacto):** as barras (`#prog`, `.brk-bar`) animam `width`; `transform: scaleX()` evitaria layout thrash, mas o ganho é nulo com 1–2 barras.

## Icons & Imagery

- Sem imagens; emojis funcionais como ícones (⌨️ 🃏 📋 💡 ✅ ❌ 🎉 ⚠️) e os três `dot` da barra de terminal. Mantê-los como reforço de rótulo textual, nunca como único portador de significado.
