// Enveloppe les textes JSX en français dans <T>…</T> (src/i18n/client.tsx). À relancer sans risque : un texte déjà
// enveloppé est ignoré. Les éléments qui mêlent texte et expressions sont listés pour une conversion manuelle.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const roots = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const dry = process.argv.includes("--dry");
const manual = [];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(name)) out.push(p);
  }
  return out;
}

const LETTER = /[A-Za-zÀ-ÿ]/;
const SKIP_TAGS = new Set(["style", "script", "code", "pre", "T"]);

function tagName(node) {
  const el = ts.isJsxElement(node) ? node.openingElement : node;
  return el.tagName.getText();
}

function isAcronym(text) {
  return /^[A-Z0-9 .\-/+&%()]+$/.test(text) && text.length <= 6;
}

/** Texte JSX nettoyé comme le fait React (lignes rognées, jointes par une espace). */
function cleanJsxText(text) {
  const lines = text.split(/\r\n|\n|\r/);
  let last = 0;
  lines.forEach((l, i) => { if (/[^ \t]/.test(l)) last = i; });
  let out = "";
  lines.forEach((line, i) => {
    let t = line.replace(/\t/g, " ");
    if (i !== 0) t = t.replace(/^[ ]+/, "");
    if (i !== lines.length - 1) t = t.replace(/[ ]+$/, "");
    if (t) {
      if (i !== last) t += " ";
      out += t;
    }
  });
  return out;
}

function containsJsx(node) {
  let found = false;
  (function walk(n) {
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) found = true;
    else ts.forEachChild(n, walk);
  })(node);
  return found;
}

const FORMAT_NAMES = { formatDate: "date", formatDateTime: "date", formatNumber: "n", formatCurrency: "amount", formatDay: "date" };

function paramName(expr, used) {
  let base = "v";
  if (ts.isIdentifier(expr)) base = expr.text;
  else if (ts.isPropertyAccessExpression(expr)) base = expr.name.text;
  else if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)) base = FORMAT_NAMES[expr.expression.text] ?? "v";
  else if (ts.isElementAccessExpression(expr)) base = "v";
  base = base.replace(/[^A-Za-z0-9_]/g, "") || "v";
  let name = base, i = 1;
  while (used.has(name)) name = `${base}${++i}`;
  used.add(name);
  return name;
}

/** Fusionne texte et expressions en un seul <T params={{…}}>{"texte {param}"}</T> ; null si un enfant est un élément JSX. */
function buildTemplate(children) {
  let template = "";
  const params = [];
  const used = new Set();
  for (const c of children) {
    if (ts.isJsxText(c)) template += cleanJsxText(c.text);
    else if (ts.isJsxExpression(c)) {
      const e = c.expression;
      if (!e) continue;
      if (ts.isStringLiteral(e) && e.text.trim() === "") { template += e.text; continue; }
      if (containsJsx(e)) return null;
      const name = paramName(e, used);
      params.push(`${name}: ${e.getText()}`);
      template += `{${name}}`;
    } else return null;
  }
  template = template.replace(/&(apos|amp|nbsp|laquo|raquo|quot|hellip|middot);/g, (m, n) => ({ apos: "'", amp: "&", nbsp: " ", laquo: "«", raquo: "»", quot: '"', hellip: "…", middot: "·" })[n]);
  if (!LETTER.test(template.replace(/\{\w+\}/g, ""))) return null;
  return `<T params={{ ${params.join(", ")} }}>{${JSON.stringify(template)}}</T>`;
}

let touched = 0, wrapped = 0;
for (const root of roots) {
  for (const file of walk(root)) {
    if (/src[\/]i18n/.test(file)) continue;
    const source = readFileSync(file, "utf8");
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const edits = [];

    function visit(node) {
      if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
        const name = ts.isJsxElement(node) ? tagName(node) : "";
        if (!SKIP_TAGS.has(name)) {
          const children = node.children;
          const texts = children.filter((c) => ts.isJsxText(c) && !c.containsOnlyTriviaWhiteSpaces && LETTER.test(c.text));
          const exprs = children.filter((c) => ts.isJsxExpression(c) && !(c.expression && ts.isStringLiteral(c.expression) && c.expression.text.trim() === ""));
          // Texte entre deux expressions ({a} texte {b}) : l'ordre des mots change d'une langue à l'autre.
          if (texts.length > 0 && exprs.length > 0) {
            const hasSentence = texts.some((t) => t.text.trim().split(/\s+/).length > 1 || /[a-zà-ÿ]{3,}/i.test(t.text));
            const template = hasSentence ? buildTemplate(children) : null;
            if (template) edits.push({ start: children.pos, end: children.end, replacement: template });
            else if (hasSentence) manual.push(`${file}:${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1}  <${name || "fragment"}> ${JSON.stringify(texts.map((t) => t.text.trim()).join(" … ").slice(0, 80))}`);
          } else {
            for (const t of texts) {
              const raw = t.text;
              const lead = raw.match(/^\s*/)[0].length;
              const trail = raw.match(/\s*$/)[0].length;
              const inner = raw.slice(lead, raw.length - trail);
              if (isAcronym(inner)) continue;
              edits.push({ start: t.pos + lead, end: t.pos + lead + inner.length, inner });
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(sf);
    if (edits.length === 0) continue;

    let out = source;
    const fixed = edits.sort((a, b) => b.start - a.start);
    for (const e of fixed) {
      if (e.start < 0) continue;
      const piece = e.replacement ?? `<T>${out.slice(e.start, e.end)}</T>`;
      out = out.slice(0, e.start) + piece + out.slice(e.end);
      wrapped++;
    }
    if (!/from "@\/i18n\/client"/.test(out)) {
      // Après les imports existants (ou après "use client").
      const lines = out.split("\n");
      let at = 0;
      for (let i = 0; i < lines.length; i++) if (/^import .* from /.test(lines[i]) || /^} from /.test(lines[i])) at = i + 1;
      lines.splice(at, 0, `import { T } from "@/i18n/client";`);
      out = lines.join("\n");
    }
    touched++;
    if (!dry) writeFileSync(file, out);
  }
}
console.log(`${dry ? "(simulation) " : ""}${touched} fichiers, ${wrapped} textes enveloppés`);
console.log(`\n${manual.length} éléments à convertir à la main :`);
console.log(manual.join("\n"));
