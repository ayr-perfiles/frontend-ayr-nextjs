#!/usr/bin/env node
// Docs-checker v1. Grep-based, no new deps. Read-only unless --fix-lines.
// Run: `npm run check:docs` (or `node scripts/check-docs.cjs --help`).
//
// QUE CHEQUEA (4 tipos, contra el codigo real del repo):
//  1. file:line — el archivo existe y la linea citada (o, si hay un simbolo
//     atribuible en el MISMO contenedor sintactico que la cita — misma celda
//     de tabla, mismo item ·/;/,/fin-de-oracion, mismo par de parentesis —,
//     ese simbolo) calza dentro de +-3 lineas; si no, barre el archivo entero
//     antes de rendirse.
//  2. rutas de archivo sin linea — existencia; bare filenames se buscan por
//     basename en todo el repo (AMBIGUO si hay 2+ candidatos).
//  3. `npm run X` — el script existe en package.json o functions/package.json.
//  4. hashes de commit en backtick — SOLO si "commit(s)" aparece cerca (misma
//     oracion acotada, o inmediatamente antes); el resto queda como tipo
//     separado `hex (no confirmado como commit)`, sin verificar contra git.
//
// QUE NO CHEQUEA (fuera de alcance, no es un bug que falte):
//  - Conteos citados en prosa ("44 archivos", "959 llamadas", "6+ redeclara-
//    ciones") — no recalcula estadisticas de codigo.
//  - Estado de git mas alla de existencia de commit: ramas huerfanas, si un
//    archivo esta trackeado o no, terminadores de linea (CRLF/LF).
//  - Datos de prod/test (colecciones vacias, counts de Firestore).
//  - Semantica o staleness de contenido: si una cita apunta a una linea que
//    EXISTE pero cuyo contenido real ya no coincide con lo que el doc afirma
//    (mas alla de "el simbolo esta/no esta ahi"), el checker no lo sabe.
//  - Reglas desplegadas (firestore.rules real en Firebase) vs el archivo del
//    repo — solo lee el archivo local.
//  - Symbols sueltos sin una cita file:line acompañante (ej. un nombre de
//    funcion mencionado en prosa sin `archivo.ts:N` al lado) — no hace grep
//    de identificadores arbitrarios sobre todo el codebase.
//
// LIMITES CONOCIDOS (medidos, no adivinados — ver scripts/check-docs.allow
// para las excepciones ya confirmadas 1x1):
//  - SIN_SIMBOLO es el veredicto mas comun de file:line (216/326 en la
//    corrida de referencia 2026-08-27): la mayoria son citas legitimas sin
//    ningun simbolo en backtick en su propia clausula (el nombre de funcion
//    solo aparece en un bloque de codigo de ejemplo debajo, no en la prosa)
//    — no es cobertura perdida, es "no hay nada que verificar mas alla de
//    archivo+linea".
//  - Clausulas encadenadas por coma sin ningun simbolo propio pueden perder
//    un simbolo legitimo que si vive en un contenedor mas amplio (costo de
//    cobertura aceptado a proposito: preferible SIN_SIMBOLO que atribuir
//    mal — medido 1/30 en la auditoria de PASO 4).
//  - Sufijos genericos sin nombre de archivo delante (".algo.test.ts" men-
//    cionado como PATRON, no como cita de un archivo puntual) requieren que
//    el primer caracter tras el backtick sea alfanumerico para no capturarse
//    como cita — un sufijo realmente pegado a un nombre real SI se verifica.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const FIX_LINES = process.argv.includes('--fix-lines');
const SHOW_HELP = process.argv.includes('--help') || process.argv.includes('-h');

const HELP_TEXT = `check-docs.cjs — verifica referencias citadas en los .md del repo contra el codigo real.

Uso:
  node scripts/check-docs.cjs [--fix-lines] [--help]

Corpus: los .md de la raiz (menos GEMINI.md, espejo auto-generado de CLAUDE.md)
+ docs/** (menos docs/_archive/**).

Veredictos:
  OK            La cita calza (archivo+linea, o archivo+linea+simbolo).
  DRIFT         El simbolo esta a +-3 lineas de la citada — casi siempre
                significa que la linea se corrio un poco. Es el UNICO
                veredicto que --fix-lines toca.
  MOVIDO        El simbolo NO esta cerca de la linea citada, pero SI existe
                en OTRA parte del archivo (barrido completo). NO se
                autocorrige: si el simbolo se repite en el archivo no hay
                forma mecanica de saber si el barrido encontro la
                ocurrencia correcta — aplicar el fix a ciegas arriesga
                apuntar a la ocurrencia equivocada. Requiere revision
                humana antes de tocar la linea.
  AMBIGUO       2+ archivos/candidatos calzan igual de bien; no se adivina.
  ROTO          El simbolo/archivo no aparece en ninguna parte. Es el
                UNICO veredicto que rompe el exit code — salvo que la cita
                este en scripts/check-docs.allow (ver abajo), o que su
                contenedor sintactico narre su propia historia (ver HISTORICA).
  HISTORICA     Seria ROTO, pero el MISMO contenedor sintactico que la
                atribucion de simbolo (celda/clausula/parentesis — ver
                computeContainer) narra explicitamente que el archivo/simbolo
                fue borrado/eliminado/renombrado/reemplazado/movido/
                consolidado/corregido ("muerto"), en participio O en
                preterito (borró/eliminó/renombró/etc — agregado PASO 2), o
                menciona un hash de commit ("en <hash>") o una version del
                proyecto ("en vX.Y.Z"/
                "desde vX.Y.Z"). NO rompe el exit code — la cita es correcta,
                esta narrando codigo muerto a proposito. Se cuenta aparte de
                ROTO en el resumen. Riesgo aceptado: un verbo de muerte
                ajeno en el MISMO contenedor de una cita rota de verdad la
                silenciaria — el contenedor angosto (no la linea/vinieta
                entera) existe para acotar ese riesgo.
  NO_PARSEABLE  Cita compuesta (dos citas comprimidas en una linea, ej.
                "A"/"B" (file:R1 y :R2)) que no calza con el patron
                reconocido — no se adivina el simbolo, se muestra el texto
                crudo para revision humana.

Flags:
  --fix-lines   Reescribe SOLO el numero de linea de los hallazgos DRIFT
                (nunca la prosa, nunca MOVIDO/AMBIGUO/ROTO/NO_PARSEABLE).
                Default: OFF (solo lectura).
  --help, -h    Muestra esta ayuda y termina sin correr nada.

Allowlist (scripts/check-docs.allow, opcional, una linea por cita):
  Formato:  doc | tipo | referencia | simbolo | motivo
  SIN numero de linea a proposito (v6.74.0/PASO 6, [DOCS-CHECKER]): una
  entrada anclada por linea se huerfana entera cuando una tanda de docs
  inserta texto arriba de la cita, aunque el hallazgo real no haya
  cambiado en nada (medido: 20 de 40 entradas volaron de una sola vez
  por esto). El match ahora es la tupla (doc, tipo, referencia, simbolo)
  — lo que NO se mueve con una edicion. Para tipos sin concepto de
  simbolo (path/npm command/commit hash) esa columna va vacia; doc+tipo+
  referencia ya es inequivoco para esos casos. Una sola entrada cubre
  TODAS las ocurrencias de esa tupla en ese doc (si la misma cita ROTA
  aparece 3 veces en el mismo archivo, 1 fila la tapa a las 3).
  Un ROTO que matchea la tupla EXACTA con una fila del allowlist se
  sigue reportando en el listado (marcado [ALLOWLISTED]) pero no rompe
  el exit code — pensado para el bucket CAUSAL: citas cuyo "simbolo" es
  vocabulario de runtime/contexto (codigos de error tipo
  PERMISSION_DENIED, labels de recon como Q1/Q2, RUCs) que nunca va a
  vivir como texto en el archivo citado, así que ningun barrido lo va a
  encontrar jamas. NO es el lugar para tapar bugs del propio heuristico
  de deteccion de simbolo (esos se arreglan en el codigo del checker, no
  se silencian en el allowlist) ni para citas REALMENTE rotas (esas se
  arreglan en el doc).
`;

// ---------- corpus ----------

function listRootMdFiles() {
  return fs
    .readdirSync(REPO_ROOT)
    .filter((f) => f.endsWith('.md') && f !== 'GEMINI.md')
    .map((f) => f);
}

function walkMd(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '_archive') continue;
      walkMd(full, out);
    } else if (entry.name.endsWith('.md')) {
      out.push(full);
    }
  }
}

function buildCorpus() {
  const files = listRootMdFiles().map((f) => path.join(REPO_ROOT, f));
  const docsRoot = path.join(REPO_ROOT, 'docs');
  const docsFiles = [];
  walkMd(docsRoot, docsFiles);
  return files.concat(docsFiles).map((f) => path.relative(REPO_ROOT, f).split(path.sep).join('/'));
}

// ---------- repo-wide file index (for bare-filename / suffix resolution) ----------

const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'coverage', '.vercel', '.turbo', 'out', 'dist']);

function buildFileIndex() {
  const byBasename = new Map(); // basename -> [relPath,...]
  (function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.gitignore') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(full);
      } else {
        const rel = path.relative(REPO_ROOT, full).split(path.sep).join('/');
        const base = entry.name;
        if (!byBasename.has(base)) byBasename.set(base, []);
        byBasename.get(base).push(rel);
      }
    }
  })(REPO_ROOT);
  return { byBasename };
}

// ---------- banner / strikethrough handling ----------

const BANNER_TRIGGER = /no se re-verific|sin re-verificar|no re-verificad|no corresponde al.{0,60}real|alcance:\s*solo este banner/i;
const DEPRECATED_TRIGGER = /DEPRECAD[OA]/;
const BANNER_SCAN_WINDOW = 20;

function computeSkipBodyStart(lines) {
  const limit = Math.min(BANNER_SCAN_WINDOW, lines.length);
  for (let i = 0; i < limit; i++) {
    const line = lines[i];
    if (!/^>/.test(line)) continue;
    if (!BANNER_TRIGGER.test(line)) continue;
    let end = i;
    while (end + 1 < lines.length && /^>/.test(lines[end + 1])) end++;
    return end + 2; // 1-indexed line number where skip starts
  }
  return null;
}

function maskStrikethrough(line) {
  return line.replace(/~~[^~]*~~/g, (m) => ' '.repeat(m.length));
}

// ---------- shared helpers ----------

function readLines(relPath) {
  const full = path.join(REPO_ROOT, relPath);
  const raw = fs.readFileSync(full, 'utf8');
  return raw.split(/\r\n|\n/);
}

const fileLineCache = new Map(); // relPath -> lines[] | null
function getFileLines(relPath) {
  if (!fileLineCache.has(relPath)) {
    try {
      fileLineCache.set(relPath, readLines(relPath));
    } catch {
      fileLineCache.set(relPath, null);
    }
  }
  return fileLineCache.get(relPath);
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function scanWholeFile(lines, symbol) {
  const re = new RegExp('\\b' + escapeRegExp(symbol) + '\\b');
  const hits = [];
  for (let i = 0; i < lines.length; i++) if (re.test(lines[i])) hits.push(i + 1);
  return hits;
}

// Window of +-3 lines (closest offset first). Symbol not in window but
// present ELSEWHERE in the file -> MOVIDO (soft: not an error, real line
// reported, --fix-lines can act on it). Symbol absent from the WHOLE file
// -> ROTO (that is a real problem). No symbol given -> existence-only check.
function checkWindow(lines, targetLine, symbol) {
  const len = lines.length;
  const offsets = [0, 1, -1, 2, -2, 3, -3];
  if (symbol) {
    const re = new RegExp('\\b' + escapeRegExp(symbol) + '\\b');
    for (const off of offsets) {
      const idx = targetLine - 1 + off;
      if (idx < 0 || idx >= len) continue;
      if (re.test(lines[idx])) {
        if (off === 0) return { verdict: 'OK', foundAt: targetLine };
        return {
          verdict: 'DRIFT',
          foundAt: targetLine + off,
          note: `simbolo \`${symbol}\` esta en la linea ${targetLine + off}, no en la ${targetLine} citada`,
        };
      }
    }
    const hits = scanWholeFile(lines, symbol);
    if (hits.length > 0) {
      let best = hits[0];
      for (const h of hits) if (Math.abs(h - targetLine) < Math.abs(best - targetLine)) best = h;
      return { verdict: 'MOVIDO', foundAt: best, note: `simbolo \`${symbol}\` no esta a ±3 de ${targetLine}, pero SI aparece en la linea ${best}` };
    }
    return { verdict: 'ROTO', foundAt: null, note: `simbolo \`${symbol}\` no aparece en ninguna parte del archivo (citado en linea ${targetLine})` };
  }
  // No symbol was attributable inside the citation's own container — that is
  // NOT an error. Verify existence of file+line only, nothing else.
  if (targetLine <= len) return { verdict: 'SIN_SIMBOLO', foundAt: targetLine, note: 'sin simbolo atribuible en el mismo contenedor sintactico; solo se verifico existencia de archivo+linea' };
  return { verdict: 'ROTO', foundAt: null, note: `archivo tiene ${len} lineas, se cito la linea ${targetLine} (sin simbolo atribuible para buscar cerca)` };
}

// ---------- symbol attribution: same syntactic container, never proximity alone ----------
//
// v1/v2 picked the nearest backtick token by raw character distance on the
// whole line — wrong whenever two "`symbol` (citation)" pairs sat close
// together and the names had different lengths, or a citation shared a
// long run-on sentence with unrelated facts. A symbol must now live in the
// SAME syntactic container as the citation: same table cell, same
// ·/;/sentence-separated list item, same parenthesis pairing (either
// "`symbol` (`citation`)" or "`citation` (`symbol`)"). No symbol
// attributable inside that container -> SIN_SIMBOLO, never a guess.

const ID_RE_SRC = '`([A-Za-z_$][A-Za-z0-9_$]*)`';
// `[searchQ]`, `[router, quotes]` -> first element. Requires the identifier
// to be immediately followed by "," or "]" (a real array boundary) — NOT a
// hyphen, or this also fires on bracketed slugs like
// `[QUOTATION-APPROVE-UNREACHABLE]`, truncating to a meaningless
// "QUOTATION" fragment at the first hyphen.
const ID_BRACKET_RE_SRC = '`\\[([A-Za-z_$][A-Za-z0-9_$]*)\\s*[,\\]]';

function isLabelLike(name) {
  return /^L\d+$/.test(name); // "L81" cross-reference label (line number shorthand), never a code symbol
}

// Table cell: `| a | b:199 | c |` jams unrelated identifiers into one
// physical line, one per column.
function cellBounds(line, start, end) {
  if (!/^\s*\|.*\|\s*$/.test(line)) return { start: 0, end: line.length };
  let leftBoundary = -1;
  let rightBoundary = line.length;
  for (let i = 0; i < line.length; i++) {
    if (line[i] !== '|') continue;
    if (i <= start) leftBoundary = i;
    if (i >= end) {
      rightBoundary = i;
      break;
    }
  }
  return { start: leftBoundary + 1, end: rightBoundary };
}

// ·/;-separated list items, and sentence boundaries (". "/"! "/"? ") — this
// corpus chains several independent "cita (simbolo)" facts on one physical
// line separated by any of these.
function endsSentence(line, i) {
  const c = line[i];
  if (c !== '.' && c !== '!' && c !== '?') return false;
  let j = i + 1;
  while (j < line.length && (line[j] === '*' || line[j] === '_')) j++; // skip **bold**/_italic_ closers
  return /\s/.test(line[j] || '');
}

function clauseBounds(line, pos) {
  const seps = [0, line.length];
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    // "," is a soft/risky separator in Spanish prose (appositives, lists
    // inside one fact) — but comma-chained independent facts ("`A` (`file:N`),
    // `B` (`file:M`)") are common enough in this corpus that NOT splitting on
    // it causes real misattribution (BUG DEL CHECKER). Between "misattribute"
    // and "lose some legitimate cross-comma attributions", the spec is
    // explicit: prefer SIN_SIMBOLO over a wrong guess.
    if (c === '·' || c === ';' || c === '—' || c === ',' || endsSentence(line, i)) seps.push(i + 1);
  }
  let start = 0;
  let end = line.length;
  for (const s of seps) {
    if (s <= pos) start = s;
    if (s > pos && s < end) end = s;
  }
  return { start, end };
}

// Innermost paren pair containing `pos`, if any (inner span, `)` excluded).
function findParenAt(line, pos) {
  const stack = [];
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '(') stack.push(i);
    else if (line[i] === ')') {
      const start = stack.pop();
      if (start !== undefined && pos >= start && pos <= i) return { start: start + 1, end: i };
    }
  }
  return null;
}

function findParenImmediatelyAfter(line, endPos) {
  let i = endPos;
  while (i < line.length && /\s/.test(line[i])) i++;
  if (line[i] !== '(') return null;
  let depth = 1;
  let j = i + 1;
  while (j < line.length && depth > 0) {
    if (line[j] === '(') depth++;
    else if (line[j] === ')') depth--;
    j++;
  }
  return { start: i + 1, end: j - 1 };
}

function findBacktickTokenImmediatelyBefore(line, pos) {
  let i = pos - 1;
  while (i >= 0 && /\s/.test(line[i])) i--;
  if (line[i] !== '`') return null;
  let j = i - 1;
  while (j >= 0 && line[j] !== '`') j--;
  if (j < 0) return null;
  return { start: j, end: i + 1 };
}

// "mismo par de parentesis": either the citation is INSIDE a paren — in
// which case a backtick token immediately before that paren's own "(" is
// the paired symbol ("`symbol` (`citation`)") — or the citation is OUTSIDE
// any paren but immediately followed by one ("`citation` (`symbol`)").
function parenBounds(line, matchStart, matchEnd) {
  const inner = findParenAt(line, matchStart);
  if (inner) {
    // Only a MEANINGFUL paren-pairing signal narrows anything: a citation
    // sitting bare inside a paren with nothing special right before it
    // ("...la transaccion (`split.ts:273`) y...") is not itself a container
    // boundary — forcing one there would cut off a real symbol earlier in
    // the same clause ("`reverseCoilSplit` lee ... (`split.ts:273`)").
    // Defer to clause/cell bounds instead (return null = no constraint).
    const parenOpenPos = inner.start - 1;
    const before = findBacktickTokenImmediatelyBefore(line, parenOpenPos);
    if (before) return { start: before.start, end: inner.end };
    return null;
  }
  const after = findParenImmediatelyAfter(line, matchEnd);
  if (after) return { start: matchStart, end: after.end };
  return null; // no paren-based narrowing available on this citation
}

function computeContainer(line, matchStart, matchEnd) {
  let start = 0;
  let end = line.length;
  const cell = cellBounds(line, matchStart, matchEnd);
  start = Math.max(start, cell.start);
  end = Math.min(end, cell.end);
  const clause = clauseBounds(line, matchStart);
  start = Math.max(start, clause.start);
  end = Math.min(end, clause.end);
  const paren = parenBounds(line, matchStart, matchEnd);
  if (paren) {
    start = Math.max(start, paren.start);
    end = Math.min(end, paren.end);
  }
  // Never let the container exclude the citation itself (defensive).
  if (start > matchStart) start = matchStart;
  if (end < matchEnd) end = matchEnd;
  if (start > end) {
    start = matchStart;
    end = matchEnd;
  }
  return { start, end };
}

function attributedSymbol(line, matchStart, matchEnd) {
  const { start, end } = computeContainer(line, matchStart, matchEnd);
  const container = line.slice(start, end);
  const candidates = [];
  let m;
  const bareRe = new RegExp(ID_RE_SRC, 'g');
  while ((m = bareRe.exec(container))) {
    if (isLabelLike(m[1])) continue;
    candidates.push({ name: m[1], pos: m.index + start });
  }
  const bracketRe = new RegExp(ID_BRACKET_RE_SRC, 'g');
  while ((m = bracketRe.exec(container))) {
    candidates.push({ name: m[1], pos: m.index + start });
  }
  if (candidates.length === 0) return null;
  const refCenter = (matchStart + matchEnd) / 2;
  candidates.sort((a, b) => Math.abs(a.pos - refCenter) - Math.abs(b.pos - refCenter));
  return candidates[0].name;
}

// ---------- HISTORICA: la cita narra un borrado/rename/consolidacion a
// proposito, no es un bug de documentacion ----------
//
// Reusa el MISMO contenedor sintactico que la atribucion de simbolo
// (computeContainer: celda de tabla + clausula ·/;/—/,/fin-de-oracion +
// pareja de parentesis) — nunca la linea entera, para no silenciar una cita
// rota de verdad que solo comparte bullet con un verbo de muerte ajeno.
//
// Patrones EXACTOS (reportados en PASO 1/A1 y ampliados en PASO 2/1 de
// [DOCS-STALE-SWEEP]):
//  1. Verbo de muerte, PARTICIPIO con genero: borrado/borrada,
//     eliminado/eliminada, renombrado/renombrada, reemplazado/reemplazada,
//     movido/movida, consolidado/consolidada, muerto/muerta,
//     corregido/corregida.
//  1b. Verbo de muerte, PRETERITO (agregado PASO 2 — "se borró"/"se eliminó"
//     no matcheaba el participio): borró/eliminó/renombró/reemplazó/movió/
//     consolidó/corrigió.
//  2. "en <hash hex 8-40>" — ligado a un commit real (ej. "borrado en f88cbb02").
//  3. "en vX.Y.Z" / "desde vX.Y.Z" — ligado a una version del proyecto.
// `\b` de JS es ASCII-only (su `\w` no incluye vocales acentuadas) — un
// patron terminado en "ó" con `\b` detras NUNCA matchea, porque JS no ve
// frontera entre "ó" y el espacio siguiente (ninguno de los dos es "\w"
// para el motor). Confirmado con test aislado: `/\bborr[oó]\b/i` da FALSE
// contra "se borró", `/\bborro\b/i` (sin tilde) da TRUE. Fix: reemplazar
// `\b` por lookaround explicito sobre un rango de letras latinas que SI
// incluye acentuadas (A-Za-zÀ-ÖØ-öø-ÿ), para los preteritos con tilde.
const LATIN_LETTER_CLASS = 'A-Za-zÀ-ÖØ-öø-ÿ';
const HISTORICA_DEATH_VERB_RE = new RegExp(
  `(?<![${LATIN_LETTER_CLASS}])(borrad[oa]|eliminad[oa]|renombrad[oa]|reemplazad[oa]|movid[oa]|consolidad[oa]|muert[oa]|corregid[oa]|borr[oó]|elimin[oó]|renombr[oó]|reemplaz[oó]|movi[oó]|consolid[oó]|corrig[ioó])(?![${LATIN_LETTER_CLASS}])`,
  'i',
);
const HISTORICA_HASH_RE = /\ben\s+[0-9a-f]{8,40}\b/i;
const HISTORICA_VERSION_RE = /\b(?:en|desde)\s+v\d+\.\d+\.\d+\b/i;

function isHistoricaContainer(line, matchStart, matchEnd) {
  const { start, end } = computeContainer(line, matchStart, matchEnd);
  const container = line.slice(start, end);
  return (
    HISTORICA_DEATH_VERB_RE.test(container) ||
    HISTORICA_HASH_RE.test(container) ||
    HISTORICA_VERSION_RE.test(container)
  );
}

// Solo degrada ROTO -> HISTORICA. Nunca toca OK/DRIFT/MOVIDO/AMBIGUO/SIN_SIMBOLO
// -- HISTORICA es una explicacion de POR QUE algo esta ROTO, no un verdict que
// compita con los demas.
function maybeHistorica(result, line, matchStart, matchEnd) {
  if (result.verdict !== 'ROTO') return result;
  if (!isHistoricaContainer(line, matchStart, matchEnd)) return result;
  return {
    ...result,
    verdict: 'HISTORICA',
    detail: `${result.detail} [contenedor narra historia: verbo de muerte o hash/version de proyecto]`,
  };
}

// ---------- compound citations: "`A`/`B` (... file:R1 y :R2 ...)" ----------
// Two symbols share one file, cited as two ranges, the second one a bare
// ":N" shorthand. Picking "nearest backtick" for the FIRST range often grabs
// the SECOND symbol (whichever sits closer). Detect the shape explicitly;
// if the expected two-backticked-names-joined-by-/ pattern isn't there,
// don't guess — report NO_PARSEABLE with the raw text instead.

const CONTINUATION_RE = /^(`?\s*y\s*`?)(:(\d+)(?:-(\d+))?)/;
const SLASH_PAIR_RE = /`([A-Za-z_$][A-Za-z0-9_$]*)`\/`([A-Za-z_$][A-Za-z0-9_$]*)`/g;

function detectContinuation(line, matchEnd) {
  const tail = line.slice(matchEnd, matchEnd + 30);
  const m = CONTINUATION_RE.exec(tail);
  if (!m) return null;
  return {
    range2Start: m[3],
    range2End: m[4],
    totalConsumed: m[0].length,
    citeAbsoluteStart: matchEnd + m[1].length,
    citeText: m[2],
  };
}

function detectSlashPairBefore(line, matchStart) {
  const windowStart = Math.max(0, matchStart - 150);
  const before = line.slice(windowStart, matchStart);
  let lastMatch = null;
  let m;
  SLASH_PAIR_RE.lastIndex = 0;
  while ((m = SLASH_PAIR_RE.exec(before))) lastMatch = m;
  if (!lastMatch) return null;
  return { symbolA: lastMatch[1], symbolB: lastMatch[2] };
}

// ---------- check 1: file:line ----------

const FILE_LINE_RE = /((?:[A-Za-z0-9_][A-Za-z0-9_./-]*\/)?[A-Za-z0-9_.-]+\.[A-Za-z]{1,5}):(\d+)(?:-(\d+))?/g;

// Resolve a cited path (qualified or bare) to 0..N candidate real paths,
// evaluate each against the target line/symbol, and decide the single
// finding-level verdict. Centralizes what used to be 3 near-duplicate
// code paths (qualified/bare/multi-candidate).
function resolveAndEvaluate(citedPath, startLine, symbol, fileIndex) {
  const hasSlash = citedPath.includes('/');
  let candidates;
  let mode;
  if (hasSlash) {
    const norm = citedPath.replace(/\\/g, '/');
    if (fs.existsSync(path.join(REPO_ROOT, norm))) {
      candidates = [norm];
      mode = 'exact';
    } else {
      const base = norm.split('/').pop();
      candidates = (fileIndex.byBasename.get(base) || []).filter((p) => p.endsWith('/' + norm) || p === norm);
      mode = 'suffix';
    }
  } else {
    candidates = fileIndex.byBasename.get(citedPath) || [];
    mode = 'bare';
  }

  if (candidates.length === 0) {
    return {
      verdict: 'ROTO',
      detail: hasSlash ? `archivo no existe (ni exacto ni por sufijo): ${citedPath}` : `ningun archivo llamado ${citedPath} en el repo`,
      resolvedPath: null,
      candidates: null,
      foundAt: null,
    };
  }

  const evaluated = candidates.map((c) => {
    const lines = getFileLines(c);
    if (!lines) return { path: c, res: { verdict: 'ROTO', note: `no se pudo leer ${c}` } };
    return { path: c, res: checkWindow(lines, startLine, symbol) };
  });
  const hits = evaluated.filter((e) => e.res.verdict !== 'ROTO');

  if (hits.length === 0) {
    return {
      verdict: 'ROTO',
      detail:
        candidates.length === 1
          ? evaluated[0].res.note
          : `no calza en ninguno de ${candidates.length} candidatos: ${candidates.join(', ')}`,
      resolvedPath: null,
      candidates: null,
      foundAt: null,
    };
  }
  if (hits.length > 1) {
    return {
      verdict: 'AMBIGUO',
      detail: `${hits.length} candidatos calzan: ${hits.map((h) => h.path).join(', ')}`,
      resolvedPath: null,
      candidates: hits.map((h) => h.path),
      foundAt: null,
    };
  }

  const { path: p, res } = hits[0];
  const pathNote =
    mode === 'suffix'
      ? `[ruta resuelta por sufijo -> ${p}] `
      : mode === 'bare' && candidates.length > 1
      ? `[desambiguado entre ${candidates.length} candidatos -> ${p}] `
      : '';
  let verdict = res.verdict;
  if (mode === 'suffix' && (verdict === 'OK' || verdict === 'SIN_SIMBOLO')) verdict = 'DRIFT'; // path itself was incomplete
  const symbolNote = symbol ? (res.verdict === 'OK' ? `simbolo \`${symbol}\` confirmado` : res.note || '') : res.note || 'linea existe';
  return {
    verdict,
    detail: pathNote + symbolNote,
    resolvedPath: p,
    candidates: null,
    foundAt: res.foundAt,
  };
}

function pushResolved(findings, docFile, docLineNo, reference, result, fixBase, symbol) {
  const fixInfo =
    (result.verdict === 'DRIFT' || result.verdict === 'MOVIDO') && result.foundAt != null && fixBase
      ? { ...fixBase, newLine: String(result.foundAt) }
      : null;
  findings.push({
    doc: docFile,
    line: docLineNo,
    type: 'file:line',
    reference,
    symbol: symbol || null,
    verdict: result.verdict,
    detail: result.detail,
    resolvedPath: result.resolvedPath,
    candidates: result.candidates,
    fixInfo,
  });
}

function pushNoParseable(findings, docFile, docLineNo, reference, rawText) {
  findings.push({
    doc: docFile,
    line: docLineNo,
    type: 'file:line',
    reference,
    verdict: 'NO_PARSEABLE',
    detail: `cita compuesta ("A"/"B" con 2 rangos) sin el patron \`A\`/\`B\` inmediatamente antes; no se adivina el simbolo. Crudo: ${rawText.trim()}`,
    resolvedPath: null,
    candidates: null,
    fixInfo: null,
  });
}

// Returns how many extra characters (beyond the base match) were consumed,
// so the caller can blank out the right span before running check 2.
function checkFileLine(docFile, docLineNo, maskedLine, match, fileIndex, findings) {
  const citedPath = match[1];
  const range1 = match[2];
  const range1End = match[3];
  const matchStart = match.index;
  const matchEnd = match.index + match[0].length;
  const ref1 = `${citedPath}:${range1}${range1End ? '-' + range1End : ''}`;

  const continuation = detectContinuation(maskedLine, matchEnd);
  if (continuation) {
    const ref2 = `${citedPath}:${continuation.range2Start}${continuation.range2End ? '-' + continuation.range2End : ''}`;
    const rawText = maskedLine.slice(matchStart, matchEnd + continuation.totalConsumed);
    const pair = detectSlashPairBefore(maskedLine, matchStart);
    if (!pair) {
      pushNoParseable(findings, docFile, docLineNo, ref1, rawText);
      pushNoParseable(findings, docFile, docLineNo, ref2, rawText);
      return continuation.totalConsumed;
    }
    const r1raw = resolveAndEvaluate(citedPath, parseInt(range1, 10), pair.symbolA, fileIndex);
    const r1 = maybeHistorica(r1raw, maskedLine, matchStart, matchEnd);
    pushResolved(findings, docFile, docLineNo, ref1, r1, {
      docFile,
      docLineNo,
      matchIndex: matchStart,
      matchText: match[0],
      oldLine: range1,
    }, pair.symbolA);
    const r2raw = resolveAndEvaluate(citedPath, parseInt(continuation.range2Start, 10), pair.symbolB, fileIndex);
    const r2 = maybeHistorica(r2raw, maskedLine, continuation.citeAbsoluteStart, continuation.citeAbsoluteStart + continuation.citeText.length);
    pushResolved(findings, docFile, docLineNo, ref2, r2, {
      docFile,
      docLineNo,
      matchIndex: continuation.citeAbsoluteStart,
      matchText: continuation.citeText,
      oldLine: continuation.range2Start,
    }, pair.symbolB);
    return continuation.totalConsumed;
  }

  const symbol = attributedSymbol(maskedLine, matchStart, matchEnd);
  const resultRaw = resolveAndEvaluate(citedPath, parseInt(range1, 10), symbol, fileIndex);
  const result = maybeHistorica(resultRaw, maskedLine, matchStart, matchEnd);
  pushResolved(findings, docFile, docLineNo, ref1, result, {
    docFile,
    docLineNo,
    matchIndex: matchStart,
    matchText: match[0],
    oldLine: range1,
  }, symbol);
  return 0;
}

// ---------- check 2: bare/qualified paths without a line ----------

// Require a recognizable repo-root prefix so we don't chase prose fragments
// like "import/page.tsx" (shorthand for a fuller path mentioned earlier in
// the same sentence) or paths that are explicitly outside the repo
// (~/ayr-scratch/...) — those aren't citations meant to resolve standalone.
const QUALIFIED_PATH_RE = /(?:src|functions|functions-sunat|scripts|docs)\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.(?:ts|tsx|js|cjs|json|md)\b/g;
// Requires a real filename char before the suffix — ".parity.test.ts" or
// ".rules.test.ts" mentioned bare (no name in front) is a SUFFIX PATTERN
// description ("un `.parity.test.ts` no se puede conservar si..."), not a
// citation of one specific file. A leading "." or "-" means there's no name.
const BARE_BACKTICK_PATH_RE = /`([A-Za-z0-9_][A-Za-z0-9_.-]*\.(?:ts|tsx|js|cjs|json))`/g;

function checkPathNoLine(docFile, docLineNo, maskedLine, fileIndex, findings) {
  let m;
  QUALIFIED_PATH_RE.lastIndex = 0;
  while ((m = QUALIFIED_PATH_RE.exec(maskedLine))) {
    const p = m[0];
    const exists = fs.existsSync(path.join(REPO_ROOT, p));
    let verdict = exists ? 'OK' : 'ROTO';
    let detail = exists ? 'existe' : 'archivo no existe';
    if (!exists && isHistoricaContainer(maskedLine, m.index, m.index + m[0].length)) {
      verdict = 'HISTORICA';
      detail = `${detail} [contenedor narra historia: verbo de muerte o hash/version de proyecto]`;
    }
    findings.push({
      doc: docFile,
      line: docLineNo,
      type: 'path (sin linea)',
      reference: p,
      verdict,
      detail,
      resolvedPath: exists ? p : null,
      candidates: null,
      fixInfo: null,
    });
  }
  BARE_BACKTICK_PATH_RE.lastIndex = 0;
  while ((m = BARE_BACKTICK_PATH_RE.exec(maskedLine))) {
    const base = m[1];
    const candidates = fileIndex.byBasename.get(base) || [];
    let verdict, detail;
    if (candidates.length === 0) {
      verdict = 'ROTO';
      detail = 'ningun archivo con ese nombre en el repo';
      if (isHistoricaContainer(maskedLine, m.index, m.index + m[0].length)) {
        verdict = 'HISTORICA';
        detail = `${detail} [contenedor narra historia: verbo de muerte o hash/version de proyecto]`;
      }
    } else if (candidates.length === 1) {
      verdict = 'OK';
      detail = candidates[0];
    } else {
      verdict = 'AMBIGUO';
      detail = `${candidates.length} candidatos: ${candidates.join(', ')}`;
    }
    findings.push({
      doc: docFile,
      line: docLineNo,
      type: 'path (sin linea, basename)',
      reference: base,
      verdict,
      detail,
      resolvedPath: candidates.length === 1 ? candidates[0] : null,
      candidates: candidates.length > 1 ? candidates : null,
      fixInfo: null,
    });
  }
}

// ---------- check 3: npm commands ----------

const NPM_RUN_RE = /npm run ([A-Za-z0-9:_-]+)/g;
const NPM_BUILTIN_RE = /\bnpm (test|ci|install|audit)\b/g;

function loadPackageScripts(relPath) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8'));
    return pkg.scripts || {};
  } catch {
    return {};
  }
}

function checkNpmCommands(docFile, docLineNo, maskedLine, scripts, findings) {
  let m;
  NPM_RUN_RE.lastIndex = 0;
  while ((m = NPM_RUN_RE.exec(maskedLine))) {
    const name = m[1];
    let where = null;
    if (scripts.root[name]) where = 'package.json';
    else if (scripts.functions[name]) where = 'functions/package.json';
    findings.push({
      doc: docFile,
      line: docLineNo,
      type: 'npm command',
      reference: `npm run ${name}`,
      verdict: where ? 'OK' : 'ROTO',
      detail: where ? `definido en ${where}` : 'no existe en package.json ni functions/package.json',
      resolvedPath: null,
      candidates: null,
      fixInfo: null,
    });
  }
  NPM_BUILTIN_RE.lastIndex = 0;
  while ((m = NPM_BUILTIN_RE.exec(maskedLine))) {
    findings.push({
      doc: docFile,
      line: docLineNo,
      type: 'npm command',
      reference: `npm ${m[1]}`,
      verdict: 'OK',
      detail: 'subcomando built-in de npm',
      resolvedPath: null,
      candidates: null,
      fixInfo: null,
    });
  }
}

// ---------- check 4: commit hashes ----------

const HASH_RE = /`([0-9a-f]{8,40})`/g;

function checkGitAvailable() {
  try {
    execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    return true;
  } catch {
    return false;
  }
}

// Only treat a hex string as a commit-hash CANDIDATE when the doc itself
// says so: "commit" appearing anywhere in the same sentence, or the hex
// immediately preceded by commit/en/desde in ref-like position. Everything
// else (ruleset ids, blob hashes, deploy revision ids — all hex-shaped,
// none of them git commits) is a different, unverified type: HEX_NO_COMMIT.
const NON_COMMIT_PAREN_HINT = /\b(blob|hash-object|ruleset|deploy|generation|revision|artefacto)\b/i;
const ENV_LABEL_IMMEDIATELY_BEFORE = /\b(test|prod|ayrsteel-test|ayrsteel-2026)\s*`?\s*$/i;

function hashContextIsCommit(line, matchStart, matchEnd) {
  // "misma oracion" per spec, via the same ·/;/—/.!?-bounded clause used for
  // symbol attribution — but with 2 overrides, both observed as real cases
  // in this corpus: (a) a hash sitting inside a paren that ITSELF describes
  // it as a blob/ruleset/deploy id ("(`git hash-object` = `2d301aad`...)")
  // is never a commit even if "commit" appears earlier in the clause;
  // (b) a hash immediately labeled by an environment ("test `X`, prod `Y`,
  // ... commit `Z`") belongs to that env, not to the commit named later in
  // the same clause.
  const immediate = line.slice(Math.max(0, matchStart - 20), matchStart);
  if (ENV_LABEL_IMMEDIATELY_BEFORE.test(immediate)) return false;
  const paren = findParenAt(line, matchStart);
  if (paren && NON_COMMIT_PAREN_HINT.test(line.slice(paren.start, paren.end))) return false;
  if (/\b(commits?|en|desde)\s*$/i.test(immediate)) return true;
  const clause = clauseBounds(line, matchStart);
  if (/\bcommits?\b/i.test(line.slice(clause.start, clause.end))) return true;
  return false;
}

function collectHashOccurrences(docFile, docLineNo, maskedLine, hashLocations, findings) {
  let m;
  HASH_RE.lastIndex = 0;
  while ((m = HASH_RE.exec(maskedLine))) {
    const hash = m[1];
    if (!/[a-f]/.test(hash)) continue; // pure-decimal (RUC, epoch generation numbers) is not a plausible sha
    if (!hashContextIsCommit(maskedLine, m.index, m.index + m[0].length)) {
      findings.push({
        doc: docFile,
        line: docLineNo,
        type: 'hex (no confirmado como commit)',
        reference: hash,
        verdict: 'AMBIGUO',
        detail:
          'no aparece "commit" en la misma oracion ni esta precedido por commit/en/desde -- no se verifico contra git (probable hash de blob/ruleset/deploy)',
        resolvedPath: null,
        candidates: null,
        fixInfo: null,
      });
      continue;
    }
    if (!hashLocations.has(hash)) hashLocations.set(hash, []);
    hashLocations.get(hash).push({ doc: docFile, line: docLineNo });
  }
}

function resolveHashes(hashLocations, gitAvailable, findings) {
  for (const [hash, locs] of hashLocations) {
    let verdict, detail;
    if (!gitAvailable) {
      verdict = 'AMBIGUO';
      detail = 'git no disponible, no se pudo verificar';
    } else {
      try {
        execFileSync('git', ['cat-file', '-e', hash + '^{commit}'], { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
        verdict = 'OK';
        detail = 'commit existe en el historial';
      } catch {
        verdict = 'ROTO';
        detail = 'hash no resuelve a un commit en este repo (puede ser un hash de blob/ruleset/deploy, no de commit)';
      }
    }
    for (const loc of locs) {
      findings.push({
        doc: loc.doc,
        line: loc.line,
        type: 'commit hash',
        reference: hash,
        verdict,
        detail,
        resolvedPath: null,
        candidates: null,
        fixInfo: null,
      });
    }
  }
}

// ---------- main per-file processing ----------

function processFile(relPath, fileIndex, scripts, hashLocations, findings, skippedFiles) {
  const raw = fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
  const lines = raw.split(/\r\n|\n/);

  if (lines.length && DEPRECATED_TRIGGER.test(lines[0])) {
    skippedFiles.push({ file: relPath, reason: 'DEPRECADO en linea 1' });
    return;
  }

  const skipBodyStart = computeSkipBodyStart(lines);

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    if (skipBodyStart && lineNo >= skipBodyStart) continue;
    const rawLine = lines[i];
    const maskedLine = maskStrikethrough(rawLine);

    FILE_LINE_RE.lastIndex = 0;
    let m;
    const consumedSpans = [];
    while ((m = FILE_LINE_RE.exec(maskedLine))) {
      const extra = checkFileLine(relPath, lineNo, maskedLine, m, fileIndex, findings);
      consumedSpans.push([m.index, m.index + m[0].length + extra]);
    }

    let remainder = maskedLine;
    for (const [s, e] of consumedSpans.slice().reverse()) {
      remainder = remainder.slice(0, s) + ' '.repeat(e - s) + remainder.slice(e);
    }
    checkPathNoLine(relPath, lineNo, remainder, fileIndex, findings);
    checkNpmCommands(relPath, lineNo, maskedLine, scripts, findings);
    collectHashOccurrences(relPath, lineNo, maskedLine, hashLocations, findings);
  }

  if (skipBodyStart) {
    skippedFiles.push({ file: relPath, reason: `banner de staleness en linea <=${BANNER_SCAN_WINDOW}; cuerpo omitido desde linea ${skipBodyStart}` });
  }
}

// ---------- fix-lines ----------

// DRIFT-only. MOVIDO is deliberately excluded: it means the symbol was
// found somewhere in the file via a whole-file scan, not confirmed to be
// THE occurrence the citation meant — if the symbol repeats, blindly
// rewriting the line risks pointing at the wrong one. MOVIDO needs a human
// to pick the right occurrence; DRIFT (found within +-3 lines) doesn't.
function applyFixLines(findings) {
  const byFile = new Map();
  for (const f of findings) {
    if (f.verdict !== 'DRIFT' || !f.fixInfo) continue;
    if (!byFile.has(f.fixInfo.docFile)) byFile.set(f.fixInfo.docFile, []);
    byFile.get(f.fixInfo.docFile).push(f.fixInfo);
  }
  let filesChanged = 0;
  let citationsChanged = 0;
  for (const [docFile, fixes] of byFile) {
    const full = path.join(REPO_ROOT, docFile);
    const raw = fs.readFileSync(full, 'utf8');
    const eol = raw.includes('\r\n') ? '\r\n' : '\n';
    const lines = raw.split(/\r\n|\n/);
    const byLine = new Map();
    for (const fx of fixes) {
      if (!byLine.has(fx.docLineNo)) byLine.set(fx.docLineNo, []);
      byLine.get(fx.docLineNo).push(fx);
    }
    let changed = false;
    for (const [lineNo, fxs] of byLine) {
      let line = lines[lineNo - 1];
      fxs.sort((a, b) => b.matchIndex - a.matchIndex); // rightmost first, indices stay valid
      for (const fx of fxs) {
        const oldText = fx.matchText;
        const newText = oldText.replace(new RegExp(':' + fx.oldLine + '(?!\\d)'), ':' + fx.newLine);
        const at = fx.matchIndex;
        if (line.slice(at, at + oldText.length) === oldText) {
          line = line.slice(0, at) + newText + line.slice(at + oldText.length);
          changed = true;
          citationsChanged++;
        }
      }
      lines[lineNo - 1] = line;
    }
    if (changed) {
      fs.writeFileSync(full, lines.join(eol));
      filesChanged++;
    }
  }
  return { filesChanged, citationsChanged };
}

// ---------- allowlist ----------

const ALLOWLIST_PATH = path.join(REPO_ROOT, 'scripts', 'check-docs.allow');

// Ancla por lo que NO se mueve con una edicion de docs: doc + tipo + referencia
// citada + simbolo (si el tipo lo tiene). Deliberadamente SIN numero de linea —
// una tanda que inserta texto arriba corre todo lo de abajo, y una entrada
// anclada por linea queda huerfana de un dia para el otro sin que el hallazgo
// real haya cambiado en nada (medido en v6.74.0: 20 de 40 entradas volaron por
// esto). Para tipos sin concepto de simbolo (path/npm command/commit hash),
// `f.symbol` es undefined -> se normaliza a cadena vacia, y el match queda
// dado por doc+tipo+referencia solamente (ya inequivoco para esos tipos).
function findingKey(f) {
  return `${f.doc}|${f.type}|${f.reference}|${f.symbol || ''}`;
}

function loadAllowlist() {
  const present = fs.existsSync(ALLOWLIST_PATH);
  const entries = []; // {key, raw, motivo}
  if (present) {
    const lines = fs.readFileSync(ALLOWLIST_PATH, 'utf8').split(/\r\n|\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const parts = trimmed.split('|').map((p) => p.trim());
      if (parts.length < 4) continue; // need at least doc | type | reference | simbolo
      const symbol = parts[3] || '';
      entries.push({ key: `${parts[0]}|${parts[1]}|${parts[2]}|${symbol}`, raw: trimmed, motivo: parts[4] || '' });
    }
  }
  return { present, entries };
}

function applyAllowlist(findings, allowlist) {
  const usedKeys = new Set();
  for (const f of findings) {
    if (f.verdict !== 'ROTO') continue;
    const key = findingKey(f);
    const hit = allowlist.entries.find((e) => e.key === key);
    if (hit) {
      f.allowlisted = true;
      f.allowlistMotivo = hit.motivo;
      usedKeys.add(hit.key);
    }
  }
  const unused = allowlist.entries.filter((e) => !usedKeys.has(e.key));
  return { usedCount: usedKeys.size, unused };
}

// ---------- report ----------

function formatFinding(f) {
  const suffix = f.allowlisted ? ` [ALLOWLISTED: ${f.allowlistMotivo || 'sin motivo'}]` : '';
  return `${f.doc}:${f.line} | ${f.type} | ${f.reference} | ${f.verdict} | ${f.detail}${suffix}`;
}

function buildSummary(findings, skippedFiles, gitAvailable, allowlist, allowlistResult) {
  const byType = {};
  const byVerdict = {};
  for (const f of findings) {
    byType[f.type] = (byType[f.type] || 0) + 1;
    byVerdict[f.verdict] = (byVerdict[f.verdict] || 0) + 1;
  }
  const rotoAllowlisted = findings.filter((f) => f.verdict === 'ROTO' && f.allowlisted).length;
  const rotoBlocking = (byVerdict.ROTO || 0) - rotoAllowlisted;
  const lines = [];
  lines.push('=== RESUMEN ===');
  lines.push(`Total hallazgos: ${findings.length}`);
  lines.push('Por tipo:');
  for (const [k, v] of Object.entries(byType)) lines.push(`  ${k}: ${v}`);
  lines.push('Por veredicto:');
  for (const [k, v] of Object.entries(byVerdict)) lines.push(`  ${k}: ${v}`);
  lines.push(`git disponible: ${gitAvailable}`);
  lines.push(`Archivos saltados/parcialmente saltados: ${skippedFiles.length}`);
  for (const s of skippedFiles) lines.push(`  ${s.file}: ${s.reason}`);
  lines.push('');
  lines.push('=== ALLOWLIST (scripts/check-docs.allow) ===');
  lines.push(`Archivo presente: ${allowlist.present}`);
  lines.push(`Entradas: ${allowlist.entries.length}`);
  lines.push(`ROTO allowlisted (no cuentan para el exit code): ${rotoAllowlisted}`);
  lines.push(`ROTO que SI rompen el exit: ${rotoBlocking}`);
  if (allowlistResult.unused.length > 0) {
    lines.push(`ALLOWLIST_STALE (entradas que ya no matchean ningun ROTO actual, no rompen el exit): ${allowlistResult.unused.length}`);
    for (const u of allowlistResult.unused) lines.push(`  ${u.raw}`);
  }
  return lines.join('\n');
}

function main() {
  if (SHOW_HELP) {
    console.log(HELP_TEXT);
    return;
  }

  const corpus = buildCorpus();
  const fileIndex = buildFileIndex();
  const scripts = {
    root: loadPackageScripts('package.json'),
    functions: loadPackageScripts('functions/package.json'),
  };
  const gitAvailable = checkGitAvailable();
  const allowlist = loadAllowlist();

  const findings = [];
  const skippedFiles = [];
  const hashLocations = new Map();

  for (const relPath of corpus) {
    processFile(relPath, fileIndex, scripts, hashLocations, findings, skippedFiles);
  }
  resolveHashes(hashLocations, gitAvailable, findings);

  findings.sort((a, b) => (a.doc === b.doc ? a.line - b.line : a.doc.localeCompare(b.doc)));

  const allowlistResult = applyAllowlist(findings, allowlist);

  const outLines = [];
  outLines.push(`# check-docs.cjs — corpus: ${corpus.length} archivos`);
  outLines.push('');
  for (const f of findings) outLines.push(formatFinding(f));
  outLines.push('');
  outLines.push(buildSummary(findings, skippedFiles, gitAvailable, allowlist, allowlistResult));

  if (FIX_LINES) {
    const { filesChanged, citationsChanged } = applyFixLines(findings);
    outLines.push('');
    outLines.push(`--fix-lines: ${citationsChanged} citas DRIFT corregidas en ${filesChanged} archivos (MOVIDO nunca se autocorrige).`);
  }

  const report = outLines.join('\n');
  console.log(report);

  const today = new Date().toISOString().slice(0, 10);
  const outDir = path.join(os.homedir(), 'ayr-scratch', today);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'check-docs-out.txt'), report);

  const hasBlockingRoto = findings.some((f) => f.verdict === 'ROTO' && !f.allowlisted);
  process.exitCode = hasBlockingRoto ? 1 : 0;
}

main();
