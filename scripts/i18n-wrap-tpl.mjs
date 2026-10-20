// Remplace les gabarits français (`texte ${valeur}`) par tpl`texte ${valeur}` (src/i18n/translate.ts) : la phrase
// complète devient la clé du dictionnaire, les valeurs sont replacées dans l'ordre de la langue cible.
// Contextes traités : propriétés JSX de texte, enfants JSX (ajoute <Tr>), propriétés d'objet (message, label, title…).
// Les autres contextes sont listés pour une conversion manuelle.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { looksLikeUiText } from "./i18n-extract.mjs";

const roots = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const dry = process.argv.includes("--dry");

function walk(d, o = []) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) {
      if (!["__tests__", "i18n", "db"].includes(n)) walk(p, o);
    } else if (/\.tsx?$/.test(n) && !/\.test\./.test(n)) o.push(p);
  }
  return o;
}

const NOISE_ATTRS = new Set(["className", "href", "key", "id", "htmlFor", "name", "type", "value", "defaultValue", "src", "action", "style", "role", "autoComplete"]);
const TEXT_PROPS = new Set(["message", "label", "title", "description", "hint", "summary", "text", "absolute", "placeholder", "short", "pendingLabel", "what"]);
const TECHNICAL = /^(GET|POST|PUT|curl|claude) |gmk_|\/api\/|^COMPANY:|^SITE:/;

const manual = [];
let touched = 0, wrapped = 0;
for (const root of roots) {
  for (const file of walk(root)) {
    const isTsx = file.endsWith("x");
    const source = readFileSync(file, "utf8");
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, isTsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const edits = [];
    (function visit(n, insideTemplate) {
      if (ts.isTemplateExpression(n) && !insideTemplate && !(n.parent && ts.isTaggedTemplateExpression(n.parent))) {
        const text = [n.head.text, ...n.templateSpans.map((s) => s.literal.text)].join("");
        if (/[A-Za-zÀ-ÿ]{3,}/.test(text) && looksLikeUiText(text.trim()) && !TECHNICAL.test(text.trim())) {
          // Contexte réel : on remonte à travers ?:, ??, || et les parenthèses.
          let p = n.parent;
          while (
            ts.isParenthesizedExpression(p) ||
            (ts.isConditionalExpression(p) && p.condition !== n) ||
            (ts.isBinaryExpression(p) && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken].includes(p.operatorToken.kind))
          )
            p = p.parent;
          const line = `${file.split("\\").join("/")}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
          if (ts.isJsxAttribute(p) || (ts.isJsxExpression(p) && ts.isJsxAttribute(p.parent))) {
            const attr = ts.isJsxAttribute(p) ? p : p.parent;
            if (!NOISE_ATTRS.has(attr.name.getText())) edits.push({ start: n.getStart(), kind: "tpl" });
          } else if (ts.isJsxExpression(p) && !ts.isJsxAttribute(p.parent)) {
            edits.push({ start: n.getStart(), kind: "child" });
          } else if (ts.isPropertyAssignment(p) && TEXT_PROPS.has(p.name.getText())) {
            edits.push({ start: n.getStart(), kind: "tpl" });
          } else {
            manual.push(`${line}\t${n.getText().slice(0, 140).replace(/\s+/g, " ")}`);
          }
        }
        ts.forEachChild(n, (c) => visit(c, true));
        return;
      }
      ts.forEachChild(n, (c) => visit(c, insideTemplate));
    })(sf, false);
    if (edits.length === 0) continue;
    let out = source;
    for (const e of edits.sort((a, b) => b.start - a.start)) {
      out = out.slice(0, e.start) + "tpl" + out.slice(e.start);
      wrapped++;
    }
    // Enfants JSX : {tpl`…`} → <Tr>{tpl`…`}</Tr> (positions recalculées après insertion de « tpl »).
    const children = edits.filter((e) => e.kind === "child");
    if (children.length > 0) {
      const sf2 = ts.createSourceFile(file, out, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const spans = [];
      (function v(n) {
        if (ts.isJsxExpression(n) && !ts.isJsxAttribute(n.parent) && n.expression && ts.isTaggedTemplateExpression(n.expression) && n.expression.tag.getText() === "tpl") spans.push([n.getStart(), n.end]);
        ts.forEachChild(n, v);
      })(sf2);
      for (const [s, e] of spans.sort((a, b) => b[0] - a[0])) out = out.slice(0, s) + "<Tr>" + out.slice(s, e) + "</Tr>" + out.slice(e);
      if (/import \{([^}]*)\} from "@\/i18n\/client"/.test(out)) {
        out = out.replace(/import \{([^}]*)\} from "@\/i18n\/client"/, (m, names) => {
          const list = names.split(",").map((s) => s.trim()).filter(Boolean);
          if (!list.includes("Tr")) list.push("Tr");
          return `import { ${list.join(", ")} } from "@/i18n/client"`;
        });
      } else {
        out = addImport(out, `import { Tr } from "@/i18n/client";`);
      }
    }
    if (!/from "@\/i18n\/translate"/.test(out)) out = addImport(out, `import { tpl } from "@/i18n/translate";`);
    else if (!/\btpl\b[^"]*from "@\/i18n\/translate"/.test(out)) out = out.replace(/import \{([^}]*)\} from "@\/i18n\/translate"/, (m, names) => `import { ${names.trim()}, tpl } from "@/i18n/translate"`);
    touched++;
    if (!dry) writeFileSync(file, out);
  }
}

function addImport(src, line) {
  const lines = src.split("\n");
  let at = 0;
  for (let i = 0; i < lines.length; i++) if (/^import .* from /.test(lines[i]) || /^} from /.test(lines[i])) at = i + 1;
  lines.splice(at, 0, line);
  return lines.join("\n");
}

console.log(`${dry ? "(simulation) " : ""}${touched} fichiers, ${wrapped} gabarits convertis`);
console.log(`\n${manual.length} gabarits à convertir à la main :`);
console.log(manual.join("\n"));
