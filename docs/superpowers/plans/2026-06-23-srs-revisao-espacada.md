# Revisão Espaçada (Leitner) + Histórico Persistido — Plano de Implementação

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking. Veja também @superpowers:test-driven-development e @superpowers:verification-before-completion.

**Goal:** Adicionar repetição espaçada (Leitner) e histórico persistido ao Simulador Sabre, com um novo modo "Revisão", mantendo single-file/offline/sem dependências.

**Architecture:** Toda a lógica do SRS vive como funções puras num objeto global `SRS` dentro do `<script>` de `index.html`, verificadas por um auto-teste acionado por `?selftest=1`. Uma camada fina de persistência (`localStorage`, chave `sabre-srs-v1`) grava o estado por skill a cada resposta e o histórico/streak ao fim de cada sessão. A UI reaproveita componentes existentes (`.seg`, `.brk-row`, `.confirm`) e tokens de cor.

**Tech Stack:** HTML + CSS + JavaScript vanilla, único arquivo `index.html`. Sem build, sem framework, sem libs. Testes via bloco de asserções no navegador (`?selftest=1`).

**Spec de referência:** `docs/superpowers/specs/2026-06-23-srs-revisao-espacada-design.md`

---

## Pré-requisito: como rodar e testar

O auto-teste e a persistência precisam de uma origem real (em `file://` o `localStorage` é inconsistente entre navegadores). Antes de começar, sirva o arquivo localmente:

```bash
cd "/Users/felipewilliams/Projetos/Anhangá.tech/simulador-sabre"
python3 -m http.server 8000
```

- **Rodar o auto-teste:** abrir `http://localhost:8000/index.html?selftest=1`. Esperado no console (DevTools): `SELFTEST: N passed, 0 failed` e um banner verde no topo. Qualquer falha aparece em vermelho com a mensagem do caso.
- **Testar a UI manualmente:** abrir `http://localhost:8000/index.html` (sem o parâmetro).
- Agentic workers com browser automation podem navegar até a URL e ler o console (`read_console_messages`, filtrando por `SELFTEST`).

> Os números de linha citados são do estado atual de `index.html` (758 linhas) e servem de âncora; após cada edição eles deslocam — localize pelos trechos de código citados, não só pela linha.

---

## Chunk 1: Motor SRS puro + arnês de auto-teste

Cria as funções puras do Leitner e o bloco `?selftest=1` que as valida. Nenhuma UI ainda. Ao fim, o auto-teste passa para os casos do motor.

### Task 1.1: Adicionar o objeto `SRS` (funções puras)

**Files:**
- Modify: `index.html` — inserir logo após a definição de `MODULES` (atual linha 498, antes do bloco `/* ===== ESTADO ===== */` na linha 500).

- [ ] **Step 1: Escrever o arnês de auto-teste primeiro (falha esperada)**

Inserir, imediatamente antes de `</script>` (atual linha 756), o bloco abaixo. Ele referencia `SRS`, que ainda não existe → o auto-teste vai quebrar com `SRS is not defined`, que é o "teste vermelho".

```javascript
/* ============================ AUTO-TESTE (?selftest=1) ============================ */
function runSelfTest(){
  let pass=0, fail=0; const fails=[];
  const ok=(cond,msg)=>{ if(cond){pass++;} else {fail++; fails.push(msg); console.error("FAIL:",msg);} };
  const eq=(a,b,msg)=>ok(JSON.stringify(a)===JSON.stringify(b), msg+" (got "+JSON.stringify(a)+", want "+JSON.stringify(b)+")");
  const NOW=1000000000000, D=SRS.DAY_MS;

  // 1. acerto sobe caixa, teto em 5, due cresce conforme INTERVALS
  let s=SRS.srsNext(null,true,NOW);
  eq(s.box,2,"novo acerto vai para caixa 2");
  eq(s.due,NOW+SRS.INTERVALS[1]*D,"due da caixa 2 = +2 dias");
  let t=s; for(let i=0;i<10;i++) t=SRS.srsNext(t,true,NOW);
  eq(t.box,5,"teto de caixa em 5");

  // 2. erro volta para caixa 1 e due = +1 dia
  let e=SRS.srsNext(t,false,NOW);
  eq(e.box,1,"erro volta para caixa 1");
  eq(e.due,NOW+SRS.INTERVALS[0]*D,"due pos-erro = +1 dia");

  // 3. isDue
  ok(SRS.isDue(null,NOW),"nunca-visto e vencido");
  ok(!SRS.isDue({box:1,due:NOW+D},NOW),"due futuro nao vencido");
  ok(SRS.isDue({box:1,due:NOW-1},NOW),"due passado vencido");

  // 4. buildReviewDeck: vencidos por caixa asc, completa com unseen, respeita cap
  const cat=[{id:"a"},{id:"b"},{id:"c"},{id:"d"}];
  const st={ a:{box:3,due:NOW-1}, b:{box:1,due:NOW-1}, d:{box:2,due:NOW+D} };
  eq(SRS.buildReviewDeck(cat,st,NOW,10).map(x=>x.id),["b","a","c","d"],"ordem: box1 vencido, box3 vencido, unseen, nao-vencido");
  eq(SRS.buildReviewDeck(cat,st,NOW,2).length,2,"respeita o cap");

  // 5. updateStreak
  eq(SRS.updateStreak({count:3,lastDay:"2026-06-23"},"2026-06-23"),{count:3,lastDay:"2026-06-23"},"mesmo dia inalterado");
  eq(SRS.updateStreak({count:3,lastDay:"2026-06-22"},"2026-06-23"),{count:4,lastDay:"2026-06-23"},"dia seguinte incrementa");
  eq(SRS.updateStreak({count:3,lastDay:"2026-06-20"},"2026-06-23"),{count:1,lastDay:"2026-06-23"},"lacuna reseta para 1");
  eq(SRS.updateStreak(null,"2026-06-23"),{count:1,lastDay:"2026-06-23"},"streak inicial");

  // 6. dayKey estável no mesmo dia local
  eq(SRS.dayKey(NOW),SRS.dayKey(NOW+1000),"dayKey estavel em ts proximos");

  // 7. catálogo com 33 skills (validado a partir do Chunk 2)
  if(typeof SKILLS!=="undefined") eq(SKILLS.length,33,"catalogo com 33 skills");

  const summary="SELFTEST: "+pass+" passed, "+fail+" failed";
  console.log(summary);
  const b=document.createElement("div");
  b.style.cssText="position:fixed;top:0;left:0;right:0;z-index:9999;padding:8px;text-align:center;font:13px monospace;"+(fail?"background:#1a0a0a;color:#ff5d5d":"background:#0a1a0f;color:#3df57a");
  b.textContent=summary+(fail?" — "+fails.join(" | "):" PASS");
  document.body.appendChild(b);
}
if(new URLSearchParams(location.search).get("selftest")==="1") runSelfTest();
```

- [ ] **Step 2: Rodar o auto-teste e confirmar a falha**

Abrir `http://localhost:8000/index.html?selftest=1`.
Esperado: console mostra erro `SRS is not defined` (nenhum `SELFTEST:` é impresso). É a falha esperada.

- [ ] **Step 3: Implementar o objeto `SRS`**

Inserir após `MODULES` (após a atual linha 498):

```javascript
/* ============================ SRS (Leitner) — funções puras ============================ */
const SRS = (function(){
  const BOXES=5, INTERVALS=[1,2,4,8,15], DAY_MS=86400000;
  function isDue(state, now){ return !state || state.due<=now; }
  function srsNext(state, ok, now){
    const box = state ? state.box : 1;
    const nbox = ok ? Math.min(box+1, BOXES) : 1;
    return {
      box: nbox,
      due: now + INTERVALS[nbox-1]*DAY_MS,
      seen: (state? state.seen:0) + 1,
      correct: (state? state.correct:0) + (ok?1:0),
      lastResult: ok ? "ok" : "no",
      lastSeen: now
    };
  }
  function dayKey(ts){ const d=new Date(ts), p=n=>String(n).padStart(2,"0");
    return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate()); }
  function nextDayKey(key){ const [y,m,d]=key.split("-").map(Number);
    return dayKey(new Date(y, m-1, d+1).getTime()); }
  function updateStreak(streak, today){
    if(!streak || !streak.lastDay) return {count:1, lastDay:today};
    if(streak.lastDay===today) return {count:streak.count, lastDay:today};
    if(nextDayKey(streak.lastDay)===today) return {count:streak.count+1, lastDay:today};
    return {count:1, lastDay:today};
  }
  function buildReviewDeck(catalog, states, now, cap){
    const seenDue=[], unseen=[], notDue=[];
    catalog.forEach(sk=>{
      const s=states[sk.id];
      if(!s) unseen.push(sk);
      else if(s.due<=now) seenDue.push(sk);
      else notDue.push(sk);
    });
    seenDue.sort((a,b)=>{ const sa=states[a.id], sb=states[b.id]; return sa.box-sb.box || sa.due-sb.due; });
    notDue.sort((a,b)=> states[a.id].box - states[b.id].box);
    return seenDue.concat(unseen, notDue).slice(0, cap);
  }
  return { BOXES, INTERVALS, DAY_MS, isDue, srsNext, dayKey, nextDayKey, updateStreak, buildReviewDeck };
})();
```

- [ ] **Step 4: Rodar o auto-teste e confirmar que passa**

Recarregar `http://localhost:8000/index.html?selftest=1`.
Esperado: console mostra `SELFTEST: 15 passed, 0 failed` (o caso 7 do catálogo é pulado por enquanto, pois `SKILLS` ainda não existe) e banner verde no topo. Conferir que abrir `http://localhost:8000/index.html` (sem o parâmetro) não mostra banner nem erros no console.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: motor SRS Leitner (funções puras) + auto-teste ?selftest

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Chunk 2: Persistência, catálogo de skills e gravação de resultados

Liga o motor à realidade: catálogo de ~33 skills, leitura/gravação em `localStorage`, e registro do resultado a cada resposta nos modos existentes (Praticar e Flashcard). Ao fim, praticar grava progresso que sobrevive a reload.

### Task 2.1: Marcar os geradores e montar o catálogo `SKILLS`

**Files:**
- Modify: `index.html` — `MODULES` (atual linhas 484-498) e logo após ele.

- [ ] **Step 1: Adicionar o campo `skill` às entradas geradas de `MODULES`**

Em cada entrada com `type:"gen"`, acrescentar `skill:"<nome>"`:

```javascript
  {id:"Disponibilidade", label:"Disponibilidade de voos", type:"gen", gen:genAvailability, n:6, skill:"availability"},
  {id:"Venda", label:"Venda de assentos", type:"gen", gen:genSell, n:6, skill:"sell"},
  ...
  {id:"Assentos", label:"Assentos (seat map)", type:"gen", gen:genSeat, n:5, skill:"seat"},
  ...
  {id:"Itinerário · modificar", label:"Itinerário (cancelar/alterar)", type:"gen", gen:genCancel, n:5, skill:"cancel"},
```

- [ ] **Step 2: Montar o catálogo `SKILLS` após `MODULES`**

Inserir após a definição de `MODULES` (e após o objeto `SRS` do Chunk 1):

```javascript
/* ============================ CATÁLOGO DE SKILLS ============================ */
const SKILLS = [];
MODULES.forEach(m=>{
  if(m.type==="gen") SKILLS.push({id:"g:"+m.skill, module:m.id, type:"gen", gen:m.gen, skill:m.skill});
  else STATIC[m.id].forEach(it=> SKILLS.push({id:"s:"+m.id+":"+it.answer, module:m.id, type:"static", item:it}));
});
```

- [ ] **Step 3: Rodar o auto-teste e confirmar o caso do catálogo**

Recarregar `http://localhost:8000/index.html?selftest=1`.
Esperado: `SELFTEST: 16 passed, 0 failed` (agora o caso 7 — `catalogo com 33 skills` — roda e passa). Se falhar com outro número, conferir a contagem: 29 estáticos + 4 gerados = 33.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: catálogo canônico de skills do SRS (33 itens)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 2.2: Camada de persistência e `recordSkill`

**Files:**
- Modify: `index.html` — bloco de estado (atual linhas 500-504) e após ele.

- [ ] **Step 1: Adicionar contadores de sessão ao estado**

No bloco `/* ===== ESTADO ===== */` (após a linha 504, junto de `modStats`), acrescentar:

```javascript
let sessBoxUp = 0, sessBoxReset = 0;   // para a linha-resumo da revisão
```

- [ ] **Step 2: Adicionar carregamento/gravação e `recordSkill`**

Inserir logo após o bloco de estado:

```javascript
/* ============================ PERSISTÊNCIA SRS ============================ */
const SRS_KEY = "sabre-srs-v1";
function emptySrs(){ return { version:1, states:{}, dayStreak:{count:0,lastDay:null}, history:[] }; }
function loadSRS(){
  try{ const raw=localStorage.getItem(SRS_KEY); if(raw){ const d=JSON.parse(raw); if(d && d.version===1) return d; } }catch(e){}
  return emptySrs();
}
function saveSRS(){ try{ localStorage.setItem(SRS_KEY, JSON.stringify(srsData)); }catch(e){} }
let srsData = loadSRS();

function recordSkill(skillId, ok){
  if(!skillId) return;
  const now = Date.now();
  const prev = srsData.states[skillId];
  const next = SRS.srsNext(prev, ok, now);
  srsData.states[skillId] = next;
  if(prev && next.box > prev.box) sessBoxUp++;
  if(prev && !ok && prev.box > 1) sessBoxReset++;
  saveSRS();
}
```

- [ ] **Step 3: Anexar `skillId` aos itens em `buildDeck`**

Substituir o corpo do `forEach` em `buildDeck` (atual linhas 545-546):

```javascript
    if(m.type==="gen"){ for(let i=0;i<m.n;i++){ const it=m.gen(); it.cat=m.id; it.skillId="g:"+m.skill; d.push(it);} }
    else STATIC[m.id].forEach(it=>d.push({...it, cat:m.id, skillId:"s:"+m.id+":"+it.answer}));
```

- [ ] **Step 4: Registrar resultado no Praticar, Flashcard e Pular**

Em `submitOrNext` (atual linha 661), logo após `recordStat(groupOf(it), ok);`, adicionar:

```javascript
  recordSkill(it.skillId, ok);
```

No handler do `#skip` (atual linha 644), no ramo que revela como pulado, após `recordStat(groupOf(deck[idx]),false);` adicionar:

```javascript
recordSkill(deck[idx].skillId,false);
```

Nos handlers de flashcard `#hit` (linha 690) e `#miss` (linha 691), após cada `recordStat(...)` adicionar respectivamente:

```javascript
// #hit:
recordSkill(deck[idx].skillId,true);
// #miss:
recordSkill(deck[idx].skillId,false);
```

- [ ] **Step 5: Gravar histórico e streak em `finish`**

Em `finish()`, imediatamente antes de `show("done");` (atual linha 725), inserir:

```javascript
  // persiste a sessão: histórico + streak (uma vez por sessão concluída)
  const today = SRS.dayKey(Date.now());
  srsData.dayStreak = SRS.updateStreak(srsData.dayStreak, today);
  srsData.history.push({day:today, mode:MODE, total:tot, correct:score, byModule:JSON.parse(JSON.stringify(modStats))});
  if(srsData.history.length>60) srsData.history = srsData.history.slice(-60);
  saveSRS();
```

- [ ] **Step 6: Resetar contadores de sessão em `start`**

Em `start()`, na linha de reset de estado (atual linha 560, `idx=0; score=0; ...`), acrescentar ao final:

```javascript
  sessBoxUp=0; sessBoxReset=0;
```

- [ ] **Step 7: Verificar a persistência manualmente**

Abrir `http://localhost:8000/index.html`, fazer uma rodada curta no modo Praticar (acertar e errar pelo menos um). No DevTools → Application → Local Storage, confirmar a chave `sabre-srs-v1` com `states` populado, `history` com 1 entrada e `dayStreak.count` ≥ 1. Recarregar a página e confirmar que a chave persiste.

- [ ] **Step 8: Rodar o auto-teste de novo (regressão)**

Recarregar `http://localhost:8000/index.html?selftest=1` → `SELFTEST: 16 passed, 0 failed`.

- [ ] **Step 9: Commit**

```bash
git add index.html
git commit -m "feat: persistência do SRS em localStorage e registro por skill

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Chunk 3: Modo Revisão (UI + deck dirigido pelo SRS)

Adiciona o 4º modo, o deck materializado a partir do `SRS.buildReviewDeck`, o contador na tela de setup e a linha-resumo ao fim da sessão.

### Task 3.1: Markup do modo Revisão e do resumo de setup

**Files:**
- Modify: `index.html` — bloco de modos (atual linhas 186-198) e bloco de setup (linhas 170-201) e tela `#done` (linhas 266-273).

- [ ] **Step 1: Adicionar o 4º `seg` "Revisão"**

Dentro de `<div class="modes" ...>`, após o botão do modo PNR (atual linha 195), antes de `</div>`:

```html
        <button type="button" class="seg" data-mode="review" aria-pressed="false">
          <b>🔁  Revisão</b><span>O sistema escolhe o que revisar: o que está vencido e o que você mais erra.</span>
        </button>
```

- [ ] **Step 2: Adicionar a barra de resumo do SRS no setup**

Logo após o `<p class="lead">…memória muscular de verdade.</p>` (atual linha 172), inserir:

```html
      <div class="srsbar hidden" id="srsBar">
        <span id="srsSummary"></span>
        <button type="button" class="linkbtn" id="progressLink">ver progresso</button>
      </div>
```

- [ ] **Step 3: Adicionar a nota do modo Revisão**

Logo após o `<p ... id="pnrNote" ...>` (atual linha 198), inserir:

```html
      <p class="lead hidden" id="reviewNote" style="margin-top:-8px; color:var(--amber)">No modo <b>Revisão</b>, a seleção de módulos é ignorada — o simulador monta a sessão com o que está vencido e o que você mais erra, em formato de digitação.</p>
```

- [ ] **Step 4: Adicionar a linha-resumo da revisão na tela `#done`**

Na `<div class="end">`, logo após `<div class="sub" id="e-sub"></div>` (atual linha 270), inserir:

```html
        <div class="sub hidden" id="e-srs"></div>
```

- [ ] **Step 5: Adicionar o CSS da barra de resumo**

No bloco `<style>`, junto das regras de `.modtools` (atual linha 138), adicionar:

```css
  .srsbar{display:flex; gap:10px; align-items:center; justify-content:space-between; flex-wrap:wrap; margin:-4px 0 12px; font-size:12px; color:var(--muted)}
  .srsbar b{color:var(--green)}
```

- [ ] **Step 6: Verificar o markup**

Abrir `http://localhost:8000/index.html`. Confirmar que aparece o 4º botão "Revisão" e que clicar nele o marca como selecionado (borda verde). Ainda sem comportamento de deck — vem na próxima task.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat: markup do modo Revisão, barra de resumo e linha de fim de sessão

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 3.2: Comportamento do modo Revisão

**Files:**
- Modify: `index.html` — handler de `.seg` (atual linhas 530-538), `start` (555-565), `show` (568-573), `finish` (696-726), e um ponto de inicialização.

- [ ] **Step 1: Adicionar `refreshSrsUI` e `buildReviewSessionDeck`**

Inserir logo após `buildDeck` (após a atual linha 550):

```javascript
function buildReviewSessionDeck(){
  const picked = SRS.buildReviewDeck(SKILLS, srsData.states, Date.now(), 30);
  return picked.map(sk=>{
    if(sk.type==="gen"){ const it=sk.gen(); it.cat=sk.module; it.skillId=sk.id; return it; }
    return {...sk.item, cat:sk.module, skillId:sk.id};
  });
}
function dueCount(){ const now=Date.now(); return SKILLS.filter(sk=>SRS.isDue(srsData.states[sk.id], now)).length; }
function hasSrsHistory(){ return srsData.history.length>0 || Object.keys(srsData.states).length>0; }
function refreshSrsUI(){
  const has = hasSrsHistory();
  $("#srsBar").classList.toggle("hidden", !has);
  if(has){
    const n = dueCount();
    $("#srsSummary").innerHTML = `» <b style="color:var(--amber)">${n}</b> comando(s) para revisar hoje · sequência: <b>${srsData.dayStreak.count}</b> dia(s)`;
  }
  if(MODE==="review"){
    const n = dueCount();
    $("#start").textContent = n>0 ? `REVISAR (${n} VENCIDOS)` : "TUDO EM DIA ✓ — REVISAR MESMO ASSIM";
  } else {
    $("#start").textContent = "INICIAR TREINO";
  }
}
```

- [ ] **Step 2: Atualizar o handler de troca de modo**

No handler de `.seg` (atual linhas 535-536), substituir as duas linhas de `pnrNote`/`mods` por:

```javascript
    $("#pnrNote").classList.toggle("hidden", MODE!=="pnr");
    $("#reviewNote").classList.toggle("hidden", MODE!=="review");
    $("#mods").style.opacity = (MODE==="pnr" || MODE==="review") ? .4 : 1;
    refreshSrsUI();
```

- [ ] **Step 3: Montar o deck de revisão em `start`**

Substituir a primeira linha de `start()` (atual linha 556) por:

```javascript
  if(MODE==="review") deck = buildReviewSessionDeck();
  else deck = (MODE==="pnr") ? buildPnrDeck(3) : buildDeck();
```

> O `typed = (MODE!=="flash")` já existente cobre a revisão (entrada digitada). Nenhuma mudança ali.

- [ ] **Step 4: Atualizar o resumo ao voltar ao setup**

Em `show()`, no ramo do setup (atual linha 571), trocar por:

```javascript
  if(id==="setup"){ $("#start").focus(); refreshSrsUI(); }
```

- [ ] **Step 5: Mostrar a linha-resumo da revisão em `finish`**

Em `finish()`, logo após o bloco de persistência adicionado no Chunk 2 e antes de `show("done");`, inserir:

```javascript
  if(MODE==="review"){
    $("#e-srs").classList.remove("hidden");
    $("#e-srs").innerHTML = `${sessBoxUp} subiram de caixa · ${sessBoxReset} voltaram à caixa 1 · próxima revisão: amanhã`;
  } else $("#e-srs").classList.add("hidden");
```

- [ ] **Step 6: Inicializar a UI do SRS no carregamento**

No fim do bloco de setup da UI (após o handler de `.seg`, perto da atual linha 538), adicionar uma chamada inicial:

```javascript
refreshSrsUI();
```

- [ ] **Step 7: Verificar o fluxo de revisão**

Abrir `http://localhost:8000/index.html`. Se for a primeira vez, fazer uma rodada de Praticar para criar estado. Voltar ao setup → a barra `» N comando(s) para revisar hoje` deve aparecer. Selecionar **Revisão** → o botão vira `REVISAR (N VENCIDOS)` e os módulos ficam atenuados. Iniciar → digitar respostas; ao concluir, a tela de fim mostra a linha `X subiram de caixa · Y voltaram à caixa 1 · próxima revisão: amanhã`. Conferir no console que não há erros.

- [ ] **Step 8: Rodar o auto-teste (regressão)**

`http://localhost:8000/index.html?selftest=1` → `SELFTEST: 16 passed, 0 failed`.

- [ ] **Step 9: Commit**

```bash
git add index.html
git commit -m "feat: modo Revisão dirigido pelo SRS com contador e resumo de sessão

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Chunk 4: Tela "Seu progresso" + limpar progresso

Painel enxuto com distribuição por caixa, comandos mais fracos, sequência e total, mais o reset com confirmação inline.

### Task 4.1: Markup do painel de progresso

**Files:**
- Modify: `index.html` — bloco de setup, antes do botão `#start` (atual linha 201); CSS.

- [ ] **Step 1: Adicionar o painel**

Logo antes de `<button class="go" id="start">INICIAR TREINO</button>` (atual linha 201), inserir:

```html
      <div class="progress-panel hidden" id="progressPanel">
        <div id="progressBody"></div>
        <div class="confirm hidden" id="clearConfirm" role="alertdialog" aria-labelledby="clearMsg">
          <span id="clearMsg" style="color:var(--amber)">Apagar todo o histórico e progresso? Não dá para desfazer.</span>
          <div class="confirm-row">
            <button type="button" class="primary" id="clearStay">Manter</button>
            <button type="button" id="clearLeave">Apagar tudo</button>
          </div>
        </div>
        <div class="row">
          <button type="button" id="clearProgress">Limpar progresso</button>
          <button type="button" id="progressClose">Fechar</button>
        </div>
      </div>
```

- [ ] **Step 2: Adicionar o CSS do painel**

Junto das regras de breakdown (atual linha 122), adicionar:

```css
  .progress-panel{border:1px solid var(--line); border-radius:10px; padding:16px; margin-bottom:14px; background:var(--panel)}
```

- [ ] **Step 3: Verificar o markup**

Abrir a página; o painel não deve aparecer (está `hidden`). Sem erros no console.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: markup do painel Seu progresso com confirmação de limpeza

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 4.2: Render e ações do progresso

**Files:**
- Modify: `index.html` — após `refreshSrsUI` (Chunk 3) e na zona de handlers de setup.

- [ ] **Step 1: Adicionar `renderProgress` e `skillLabel`**

Inserir após `refreshSrsUI`:

```javascript
function skillLabel(sk){
  if(sk.type==="gen") return ({availability:"Disponibilidade",sell:"Venda",seat:"Mapa de assentos",cancel:"Cancelar segmento"})[sk.skill] || sk.module;
  return sk.item.answer;
}
function renderProgress(){
  const states=srsData.states;
  const boxes=[0,0,0,0,0]; let totalSeen=0;
  SKILLS.forEach(sk=>{ const st=states[sk.id]; if(st){ boxes[st.box-1]++; totalSeen+=st.seen; } });
  const seenSkills = boxes.reduce((a,b)=>a+b,0);
  const unseen = SKILLS.length - seenSkills;
  let html = `<div class="brk-title">Distribuição por caixa (Leitner)</div>`;
  boxes.forEach((c,i)=>{
    const w=Math.round(c/SKILLS.length*100);
    html += `<div class="brk-row"><div class="brk-name">Caixa ${i+1}</div>`+
      `<div class="brk-bar"><i style="width:${w}%;background:var(--green-dim)"></i></div>`+
      `<div class="brk-val">${c} cmd</div></div>`;
  });
  html += `<div class="brk-row"><div class="brk-name">Nunca vistos</div>`+
    `<div class="brk-bar"><i style="width:${Math.round(unseen/SKILLS.length*100)}%;background:var(--line)"></i></div>`+
    `<div class="brk-val">${unseen} cmd</div></div>`;
  const weak = SKILLS.map(sk=>({sk, st:states[sk.id]}))
    .filter(x=>x.st && x.st.seen>=1)
    .map(x=>({label:skillLabel(x.sk), acc:Math.round(x.st.correct/x.st.seen*100), seen:x.st.seen}))
    .sort((a,b)=> a.acc-b.acc || b.seen-a.seen).slice(0,5);
  if(weak.length){
    html += `<div class="brk-title" style="margin-top:14px">Comandos mais fracos</div>`;
    html += weak.map(w=>{ const col=w.acc>=80?"var(--green)":w.acc>=50?"var(--amber)":"var(--red)";
      return `<div class="brk-row"><div class="brk-name">${w.label}</div>`+
        `<div class="brk-bar"><i style="width:${w.acc}%;background:${col}"></i></div>`+
        `<div class="brk-val">${w.acc}%</div></div>`; }).join("");
  }
  html += `<div class="brk-tip">Sequência: ${srsData.dayStreak.count} dia(s) · total praticado: ${totalSeen} resposta(s).</div>`;
  $("#progressBody").innerHTML=html;
}
```

- [ ] **Step 2: Ligar os botões do painel**

Junto dos handlers de setup (perto do `#selAll`/`#selNone`, atual linha 521), adicionar:

```javascript
$("#progressLink").addEventListener("click",()=>{ renderProgress(); $("#clearConfirm").classList.add("hidden"); $("#progressPanel").classList.remove("hidden"); $("#progressClose").focus(); });
$("#progressClose").addEventListener("click",()=>$("#progressPanel").classList.add("hidden"));
$("#clearProgress").addEventListener("click",()=>{ $("#clearConfirm").classList.remove("hidden"); $("#clearStay").focus(); });
$("#clearStay").addEventListener("click",()=>{ $("#clearConfirm").classList.add("hidden"); $("#clearProgress").focus(); });
$("#clearLeave").addEventListener("click",()=>{ srsData=emptySrs(); saveSRS(); $("#clearConfirm").classList.add("hidden"); renderProgress(); refreshSrsUI(); });
```

- [ ] **Step 3: Verificar o painel**

Abrir a página com algum progresso existente. Clicar em **ver progresso** → painel abre com distribuição por caixa, comandos mais fracos (se houver `seen≥1`), sequência e total. Clicar **Limpar progresso** → confirmação inline aparece (foco em "Manter"); **Apagar tudo** zera (barras vão a 0, barra de resumo some); **Fechar** esconde o painel. Operar tudo só pelo teclado (Tab + Enter) e confirmar foco visível.

- [ ] **Step 4: Rodar o auto-teste (regressão)**

`http://localhost:8000/index.html?selftest=1` → `SELFTEST: 16 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: painel Seu progresso (caixas, mais fracos, sequência) e limpar progresso

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Chunk 5: Documentação e verificação final

### Task 5.1: Atualizar docs

**Files:**
- Modify: `README.md` (seções de funcionalidades e "Próximos passos", linhas 7-16 e 64-68), `DESIGN.md` (seção Components).

- [ ] **Step 1: README — registrar o novo modo e o histórico**

Em "✨ Funcionalidades", adicionar ao bloco de modos a linha do modo Revisão e um item sobre repetição espaçada/histórico. Em "🗺️ Próximos passos", remover o item "Salvar histórico das sessões no navegador (localStorage)" (agora entregue) e, se desejar, mencionar a curva de evolução (spec B2) como próximo passo.

- [ ] **Step 2: DESIGN.md — documentar os componentes novos**

Na seção "Components", adicionar entradas curtas para: o 4º `seg` "Revisão", a `.srsbar` (resumo de vencidos + sequência), o `.progress-panel` (distribuição por caixa reusando `.brk-row` e confirmação inline `.confirm` para limpar).

- [ ] **Step 3: Commit**

```bash
git add README.md DESIGN.md
git commit -m "docs: documenta modo Revisão, histórico persistido e painel de progresso

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 5.2: Verificação de aceitação (checklist do spec)

- [ ] **Step 1: Conferir cada critério de aceitação do spec**

Servindo via `python3 -m http.server 8000`, validar:
- [ ] Responder em Praticar/Flashcard grava o skill e sobrevive a reload (DevTools → Local Storage).
- [ ] Revisão com vencidos prioriza caixas baixas; com tudo em dia ainda oferece sessão.
- [ ] Acerto sobe a caixa; erro volta à caixa 1 e o item reaparece na mesma sessão.
- [ ] Contador "N vencidos" e linha de sequência refletem o estado e atualizam após a sessão.
- [ ] "Ver progresso" mostra caixas, 5 mais fracos, sequência e total; "limpar progresso" zera via confirmação inline.
- [ ] `?selftest=1` imprime `SELFTEST: 16 passed, 0 failed`.
- [ ] `index.html` continua sem dependências (nenhum `<script src>`/`<link href>` externo novo).

- [ ] **Step 2: Confirmar ausência de regressões nos modos antigos**

Rodar uma sessão completa em Praticar, Flashcard e PNR completo; confirmar que funcionam como antes (placar por módulo, checklist do PNR, confirmação de saída por Esc) e que cada um grava 1 entrada de `history`.

- [ ] **Step 3: Commit final (se houver ajustes) e fechamento**

Usar @superpowers:verification-before-completion antes de declarar concluído: colar no resumo a linha real do console do auto-teste como evidência.

---

## Resumo de arquivos tocados

| Arquivo | Responsabilidade da mudança |
|---|---|
| `index.html` | Todo o código: objeto `SRS` puro, auto-teste `?selftest`, catálogo `SKILLS`, persistência, modo Revisão, painel de progresso, CSS dos componentes novos. |
| `README.md` | Documentar modo Revisão + histórico; atualizar "Próximos passos". |
| `DESIGN.md` | Documentar `.seg` Revisão, `.srsbar`, `.progress-panel`. |

## Fora de escopo (não fazer neste plano)
Curva de evolução no tempo (spec B2), metas configuráveis/streak gamificado (B3), export/import, sincronização entre dispositivos.
