# Revisão Espaçada (Leitner) + Histórico Persistido

- **Data:** 2026-06-23
- **Status:** Aprovado para planejamento
- **Arquivo afetado:** `index.html` (single-file, vanilla JS, offline)
- **Specs relacionados (futuros):** B2 — curva de evolução no tempo · B3 — metas e streak gamificado

## 1. Contexto e problema

O Simulador Sabre treina comandos crípticos do GDS em três modos (Praticar, Flashcard, PNR completo). Hoje cada sessão é independente: nada persiste entre uma sessão e outra, o `streak` zera ao recarregar, e o deck é sempre embaralhado por igual — não há noção de "o que eu mais erro" nem de "o que eu deveria revisar hoje".

O propósito declarado do produto (PRODUCT.md) é **fluência real / memória muscular**. A técnica certa para isso é repetição espaçada: revisar mais o que se erra e reapresentar cada item em intervalos crescentes. Este spec adiciona essa camada de forma 100% offline (`localStorage`), sem dependências novas e sem diluir a estética de terminal.

## 2. Objetivos e não-objetivos

**Objetivos (v1):**
- Persistir desempenho por comando entre sessões.
- Um motor de repetição espaçada (Leitner) que decide o que revisar.
- Um 4º modo **Revisão**, dirigido pelo motor, em formato de digitação.
- Uma tela enxuta de progresso (snapshot atual) com opção de limpar.
- Lógica crítica verificável via auto-teste no navegador.

**Não-objetivos (v1):**
- Curva de evolução ao longo do tempo (fica para o spec B2).
- Metas diárias configuráveis e streak gamificado além do contador simples (B3).
- Export/import de progresso.
- Sincronização entre dispositivos (exigiria backend — feriria o "100% offline").

## 3. Decisões tomadas (com justificativa)

| # | Decisão | Alternativas descartadas | Por quê |
|---|---|---|---|
| D1 | **Unidade de agendamento = comando/padrão** (~33 skills): cada comando estático é um item; cada gerador é um item de "padrão". | Por módulo inteiro; misto por sub-habilidade. | Granularidade que aponta o ponto fraco real, sem complexidade de modelar variações infinitas. Preserva "ensine o padrão". |
| D2 | **Integração = novo modo "Revisão"** (4º `seg`). | Reponderar os modos atuais; os dois. | Mais discoverável e explícito; mantém os modos atuais intactos; dá sentido ao contador de "vencidos". |
| D3 | **Motor = Leitner** (5 caixas, intervalos `[1,2,4,8,15]` dias). | SM-2 (Anki); peso por fraqueza. | Funciona com binário certo/errado, é espaçamento real no tempo, é transparente ("caixa 3/5") e simples de manter. |
| D4 | **Progresso enxuto** (snapshot agora; curva temporal depois). | Curva de evolução já na v1. | Mantém o primeiro spec focado. `history[]` já é gravado para alimentar B2. |
| D5 | **Testes via `?selftest=1` no navegador.** | Extrair lógica para arquivo `.js` + testes em Node. | Mantém single-file/offline/sem build; ainda assim verifica a lógica crítica. |

## 4. Modelo de dados

Tudo num único blob JSON em `localStorage`, chave **`sabre-srs-v1`**, lido/gravado dentro de `try/catch` (como o código já faz com `sabre-onboarded`). Campo `version` para migração futura: se a versão lida for desconhecida, o estado é descartado com segurança (volta ao zero) em vez de quebrar.

### 4.1 Catálogo canônico de skills

Montado no carregamento a partir de `MODULES` + `STATIC`. Cada skill tem um `id` estável e determinístico:

- **Estático:** `s:<móduloId>:<answer>` — ex.: `s:Sessão:SI`.
- **Gerado:** `g:<gerador>` — um por gerador: `g:availability`, `g:sell`, `g:seat`, `g:cancel`.

Contagem esperada: 29 estáticos + 4 gerados = **33 skills**.

> Cada item do deck (em qualquer modo de catálogo) carrega um campo `skillId` no momento da construção, para que registrar o resultado no SRS seja direto. Itens gerados recebem `skillId` a partir de um campo `skill` adicionado à entrada de `MODULES` (ex.: `skill:"availability"`); itens estáticos derivam `s:<móduloId>:<answer>` no build do deck.

### 4.2 Estado por skill

```
states[id] = {
  box:        1..5,            // caixa Leitner atual
  due:        <timestamp ms>,  // quando fica vencido para revisão
  seen:       <int>,           // total de vezes praticado
  correct:    <int>,           // total de acertos
  lastResult: "ok" | "no",     // último resultado
  lastSeen:   <timestamp ms>
}
```

Skill sem entrada em `states` = "nunca visto".

### 4.3 Estado global

```
{
  version:   1,
  states:    { <id>: {...} },
  dayStreak: { count: <int>, lastDay: "YYYY-MM-DD" },
  history:   [ { day:"YYYY-MM-DD", mode, total, correct, byModule:{<grupo>:{ok,tot}} } ]
}
```

`history` é limitado às ~60 entradas mais recentes (descarta as mais antigas) para não crescer sem fim. Ele já é gravado na v1 para alimentar o spec B2, embora a v1 não desenhe a curva temporal.

## 5. Motor Leitner

Constantes:

```
BOXES      = 5
INTERVALS  = [1, 2, 4, 8, 15]   // dias; índice = box-1
DAY_MS     = 86_400_000
```

Funções puras (alvo dos auto-testes):

- **`isDue(state, now)`** → `state == null || state.due <= now`. Skill nunca visto conta como vencido.
- **`srsNext(state, ok, now)`** → novo estado:
  - novo item começa implicitamente em `box=1`.
  - **acerto:** `box = min(box+1, BOXES)`; `due = now + INTERVALS[box-1] * DAY_MS`.
  - **erro:** `box = 1`; `due = now + INTERVALS[0] * DAY_MS` (1 dia).
  - sempre: `seen++`, `correct += ok?1:0`, `lastResult`, `lastSeen = now`.
- **`dayKey(ts)`** → `"YYYY-MM-DD"` em horário local.
- **`updateStreak(streak, today)`**:
  - `today == lastDay` → inalterado.
  - `today == lastDay + 1 dia` → `count++`, `lastDay = today`.
  - caso contrário → `count = 1`, `lastDay = today`.

Reforço dentro da sessão: ao errar, além de cair para a caixa 1, o item é **re-enfileirado uma vez mais adiante na mesma sessão** (o espaçamento entre dias fica por conta do `due`).

## 6. Montagem do deck no modo Revisão

`buildReviewDeck(catalog, states, now, cap=30)`:

1. **Vencidos primeiro:** todos os skills com `isDue` verdadeiro, ordenados por (a) caixa mais baixa primeiro — prioriza o que mais se erra; (b) `due` mais antigo primeiro como desempate.
2. **Completar se faltar:** se houver menos itens que o `cap`, acrescenta skills nunca vistos, depois os de caixa mais baixa ainda não incluídos — garante sempre uma sessão útil mesmo com "tudo em dia".
3. **Teto:** no máximo `cap = 30` itens por sessão.
4. **Materialização:** para cada skill selecionado:
   - estático → usa o exercício fixo do item.
   - gerado → chama o gerador e cria **uma variação nova na hora**.
5. **Formato:** digitação (estilo Praticar), com o feedback didático atual (resposta certa + explicação). Cada resposta chama `srsNext` e persiste.

Atualização do SRS também acontece nos modos **Praticar** e **Flashcard** (qualquer resposta a um item de catálogo avança a caixa daquele skill). O modo **PNR completo** grava uma entrada de `history`, mas **não** alimenta o SRS por skill na v1 (seus passos são comandos gerados contextualmente; mapeá-los a skills fica fora de escopo agora).

**Quando o estado global é gravado:** o estado por skill (`states`) é persistido a cada resposta. A entrada de `history` e a atualização de `dayStreak` (via `updateStreak`) acontecem **uma vez por sessão concluída**, em `finish()`, em qualquer modo — inclusive PNR completo. Sair pelo meio (confirmação de saída) **não** grava `history` nem mexe no streak, mas os estados de skill já respondidos permanecem salvos.

## 7. Mudanças de UI (reaproveitando a estética)

- **4º `seg` "Revisão"** ao lado de Praticar/Flashcard/PNR. Ao implementar, resolver a pendência do DESIGN.md de tornar os `.seg` **focáveis e operáveis por teclado** (Tab + Enter/Espaço; `aria-pressed` já existe no markup).
- Modo Revisão selecionado: atenua/esconde o grid de módulos (como o PNR já faz com `opacity:.4`) e mostra a nota: *"Revisão usa o sistema de caixas: mostramos o que está vencido e o que você mais erra."*
- Botão primário com contador dinâmico:
  - `N > 0` → **"Revisar (N vencidos)"**.
  - `N == 0` → **"Tudo em dia ✓ — revisar mesmo assim"** (permite revisar adiantado).
- **Linha sóbria no topo do setup** (só se há histórico): `» 12 comandos para revisar hoje · sequência: 4 dias`. O número de vencidos em `--amber` (mesmo papel de "atenção/atual" do DESIGN.md).
- **Fim da sessão de Revisão:** abaixo do placar por módulo, uma linha: *"X subiram de caixa · Y voltaram à caixa 1 · próxima revisão: amanhã"*.

## 8. Tela "Seu progresso" (escopo enxuto)

Link/botão discreto **"ver progresso"** no setup. Mostra, reaproveitando componentes existentes:

- **Distribuição por caixa** (1–5): barras `brk-row` com a contagem de comandos em cada caixa.
- **5 comandos mais fracos:** menor taxa de acerto (`correct/seen`), exigindo `seen >= 1`.
- **Sequência de dias** (`dayStreak.count`) e **total praticado** (soma de `seen`).
- **Botão "limpar progresso"** usando a confirmação inline `.confirm` já existente (não usar `confirm()` nativo), porque o dado é todo local e o usuário precisa poder resetar.

Sem curva temporal na v1 (fica para B2).

## 9. Acessibilidade e estética

- Teclado em primeiro lugar: o 4º `seg` e o botão "ver progresso" totalmente operáveis por teclado, com foco visível.
- Estado nunca comunicado só por cor: números de "vencidos", caixas e mais-fracos sempre acompanham rótulo textual (regra do DESIGN.md).
- Reaproveita tokens (`--amber` vencidos/atenção, `--green` "em dia", `--red` fraco, `brk-row` para barras). Zero dependência nova; continua single-file e offline.
- `prefers-reduced-motion` já tratado globalmente; nada de novo a animar além das barras existentes.

## 10. Testes (`?selftest=1`)

A lógica do SRS é estruturada como **funções puras** num objeto global (ex.: `SRS = { isDue, srsNext, dayKey, updateStreak, buildReviewDeck }`). Com `?selftest=1` na URL, o app roda um bloco de asserções e imprime `PASS/FAIL` no console (e um pequeno banner na tela), sem build e sem dependências.

Casos mínimos a cobrir:

1. `srsNext` acerto sobe uma caixa e teto em 5; `due` cresce conforme `INTERVALS`.
2. `srsNext` erro volta para caixa 1 e `due` = +1 dia.
3. `isDue`: nunca-visto = vencido; `due` futuro = não vencido; `due` passado = vencido.
4. `buildReviewDeck`: ordena vencidos por caixa mais baixa, completa com nunca-vistos quando faltam, respeita o `cap`.
5. `updateStreak`: mesmo dia inalterado; dia seguinte incrementa; lacuna reseta para 1.
6. `dayKey` estável para timestamps do mesmo dia local.

## 11. Critérios de aceitação

- Responder em qualquer modo de catálogo grava o estado do skill em `localStorage` e sobrevive a um reload.
- Entrar em **Revisão** com itens vencidos monta um deck priorizando caixas baixas; com tudo em dia, ainda assim oferece uma sessão.
- Acerto move o item uma caixa acima; erro devolve à caixa 1 e o item reaparece na mesma sessão.
- O contador "N vencidos" e a linha de sequência refletem o estado real e atualizam após a sessão.
- "Ver progresso" mostra distribuição por caixa, 5 mais fracos, sequência e total; "limpar progresso" zera tudo via confirmação inline.
- `?selftest=1` imprime todos os casos como `PASS`.
- Sem novas dependências; `index.html` continua abrindo offline com duplo clique.

## 12. Riscos e mitigação

- **Esquema de `localStorage` evoluir:** `version` + descarte seguro em versão desconhecida.
- **Reordenar arrays `STATIC` muda ids derivados de `answer`:** ids usam `answer` (não índice), então a maioria das edições preserva o histórico; trocar o texto de um `answer` cria um skill novo e aposenta o antigo (aceitável — o antigo simplesmente para de aparecer).
- **`history` crescer demais:** teto de ~60 entradas.
- **Diluir o terminal:** todo elemento novo reusa tokens e componentes existentes; nada de cores/ilustrações fora da paleta.
