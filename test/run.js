/*
 * Testes do Simulador Sabre.
 *
 * O app é um único index.html sem dependências de runtime. Aqui ele é carregado
 * num DOM (jsdom) para verificar três coisas:
 *   1. o auto-teste embutido (?selftest=1) das funções puras do SRS;
 *   2. integração: catálogo, deck de revisão e painel de progresso;
 *   3. fluxo real de jogo + persistência em localStorage, sem regredir os modos antigos.
 *
 * Uso: `npm test` (ou `node test/run.js`). Sai com código != 0 se algo falhar.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { JSDOM, VirtualConsole } = require("jsdom");

const HTML_PATH = path.join(__dirname, "..", "index.html");
const html = fs.readFileSync(HTML_PATH, "utf8");

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.error("  ✗ " + msg); } };

function load(url) {
  return new JSDOM(html, { runScripts: "dangerously", url, pretendToBeVisual: true }).window;
}

/* ---- 0. Sintaxe do <script> e ausência de dependências externas ---- */
(function syntaxAndDeps() {
  const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
  try { new vm.Script(script); ok(true, "sintaxe do <script>"); }
  catch (e) { ok(false, "sintaxe do <script>: " + e.message); }
  ok(!/<script\s+src=/i.test(html), "sem <script src> externo");
  ok(!/<link[^>]+href=/i.test(html), "sem <link href> externo");
})();

/* ---- 1. Auto-teste embutido (?selftest=1) ---- */
(function selftest() {
  const logs = [];
  const vc = new VirtualConsole();
  vc.on("log", t => logs.push(t)).on("error", t => logs.push("ERR:" + t));
  new JSDOM(html, { runScripts: "dangerously", url: "http://localhost/index.html?selftest=1", virtualConsole: vc });
  const line = logs.find(l => /^SELFTEST:/.test(l)) || "(nenhuma linha SELFTEST)";
  ok(line === "SELFTEST: 16 passed, 0 failed", "auto-teste do navegador: " + line);
})();

/* ---- 2. Integração: catálogo, deck de revisão, painel ---- */
(function integration() {
  const w = load("http://localhost/index.html");
  const SKILLS = w.eval("SKILLS"), SRS = w.eval("SRS");
  ok(SKILLS.length === 33, "catálogo com 33 skills (" + SKILLS.length + ")");
  ok(new Set(SKILLS.map(s => s.id)).size === 33, "ids de skill únicos");
  ok(SRS.buildReviewDeck(SKILLS, {}, Date.now(), 30).length === 30, "deck de revisão respeita cap 30");
  const mat = w.eval("buildReviewSessionDeck()");
  ok(mat.length === 30 && mat.every(it => it.skillId && it.q && it.answer), "deck materializado com skillId/q/answer");
  // painel de progresso abre e renderiza
  const d = w.document;
  d.getElementById("progressLink").click();
  ok(!d.getElementById("progressPanel").classList.contains("hidden"), "painel de progresso abre");
  ok(/Distribuição por caixa/.test(d.getElementById("progressBody").innerHTML), "painel renderiza caixas");
})();

/* ---- 3. Fluxo real de Praticar + persistência ---- */
(function practiceFlow() {
  const w = load("http://localhost/index.html"); const d = w.document;
  d.querySelectorAll("#mods input").forEach(c => c.checked = (c.value === "Sessão"));
  d.getElementById("start").click();
  const n = w.eval("deck.length");
  ok(n === 4, "deck de Sessão tem 4 (" + n + ")");
  for (let i = 0; i < n; i++) {
    const ans = w.eval("deck[idx].answer");
    d.getElementById("answer").value = (i % 2 === 0) ? ans : "ERRADO";
    d.getElementById("check").click(); // verifica
    d.getElementById("check").click(); // avança
  }
  ok(!d.getElementById("done").classList.contains("hidden"), "sessão conclui");
  const data = JSON.parse(w.localStorage.getItem("sabre-srs-v1"));
  ok(Object.keys(data.states).length === 4, "4 skills persistidos");
  ok(data.history.length === 1 && data.history[0].mode === "practice", "1 histórico (practice)");
  ok(data.dayStreak.count === 1, "streak = 1");
  const boxes = Object.values(data.states).map(s => s.box).sort();
  ok(JSON.stringify(boxes) === "[1,1,2,2]", "caixas refletem 2 acertos/2 erros (" + boxes + ")");
  d.getElementById("again").click();
  ok(!d.getElementById("srsBar").classList.contains("hidden"), "barra de resumo aparece após a sessão");
})();

/* ---- 4. Regressão: Flashcard e PNR ainda gravam; PNR não alimenta SRS por skill ---- */
(function regression() {
  // Flashcard
  let w = load("http://localhost/index.html"), d = w.document;
  d.querySelector('.seg[data-mode="flash"]').click();
  d.querySelectorAll("#mods input").forEach(c => c.checked = (c.value === "Sessão"));
  d.getElementById("start").click();
  let n = w.eval("deck.length");
  for (let i = 0; i < n; i++) { d.getElementById("revealBtn").click(); (i % 2 ? d.getElementById("miss") : d.getElementById("hit")).click(); }
  let data = JSON.parse(w.localStorage.getItem("sabre-srs-v1"));
  ok(data.history.length === 1 && data.history[0].mode === "flash", "flashcard grava histórico");
  ok(Object.keys(data.states).length === 4, "flashcard grava 4 skills");

  // PNR
  w = load("http://localhost/index.html"); d = w.document;
  d.querySelector('.seg[data-mode="pnr"]').click();
  d.getElementById("start").click();
  n = w.eval("deck.length");
  for (let i = 0; i < n; i++) { const a = w.eval("deck[idx].answer"); d.getElementById("answer").value = a; d.getElementById("check").click(); d.getElementById("check").click(); }
  data = JSON.parse(w.localStorage.getItem("sabre-srs-v1"));
  ok(data.history.length === 1 && data.history[0].mode === "pnr", "PNR grava histórico");
  ok(Object.keys(data.states).length === 0, "PNR não alimenta SRS por skill");
})();

/* ---- 5. Limpar progresso zera tudo ---- */
(function clearProgress() {
  const w = load("http://localhost/index.html"), d = w.document;
  d.querySelectorAll("#mods input").forEach(c => c.checked = (c.value === "Sessão"));
  d.getElementById("start").click();
  const n = w.eval("deck.length");
  for (let i = 0; i < n; i++) { const a = w.eval("deck[idx].answer"); d.getElementById("answer").value = a; d.getElementById("check").click(); d.getElementById("check").click(); }
  d.getElementById("again").click();
  d.getElementById("progressLink").click();
  d.getElementById("clearProgress").click();
  d.getElementById("clearLeave").click();
  const data = JSON.parse(w.localStorage.getItem("sabre-srs-v1"));
  ok(Object.keys(data.states).length === 0 && data.history.length === 0 && data.dayStreak.count === 0, "limpar progresso zera tudo");
  ok(d.getElementById("srsBar").classList.contains("hidden"), "barra de resumo some após limpar");
})();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
