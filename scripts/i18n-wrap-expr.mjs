// Enveloppe dans <Tr>…</Tr> les expressions JSX dont le résultat est un texte français littéral :
// {cond ? "Oui" : "Non"}, {valeur ?? "—"}, {"Texte"}. Tr traduit les chaînes et laisse passer le reste.
// À relancer sans risque : une expression déjà dans <T> ou <Tr> est ignorée.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { looksLikeUiText } from "./i18n-extract.mjs";

const roots = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const dry = process.argv.includes("--dry");
// --members : contenu venant de la base (site commercial) : {s["hero.title"]}, {item.title}… sont aussi enveloppés.
const members = process.argv.includes("--members");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(name)) out.push(p);
  }
  return out;
}

const SKIP_TAGS = new Set(["T", "Tr", "style", "script", "code", "pre", "title"]);

/** Une feuille de l'expression est-elle un texte d'interface littéral ? (branches de ?:, ??, ||, &&) */
function hasUiLeaf(e) {
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return looksLikeUiText(e.text.trim()) && !/gmk_|curl |mcp add|Authorization|^(GET|POST) /.test(e.text);
  if (ts.isParenthesizedExpression(e)) return hasUiLeaf(e.expression);
  if (ts.isTaggedTemplateExpression(e)) return e.tag.getText() === "tpl";
  if (ts.isConditionalExpression(e)) return hasUiLeaf(e.whenTrue) || hasUiLeaf(e.whenFalse);
  if (ts.isBinaryExpression(e)) {
    const k = e.operatorToken.kind;
    if (k === ts.SyntaxKind.QuestionQuestionToken || k === ts.SyntaxKind.BarBarToken) return hasUiLeaf(e.left) || hasUiLeaf(e.right);
    if (k === ts.SyntaxKind.AmpersandAmpersandToken) return hasUiLeaf(e.right);
  }
  return false;
}

function isMemberRead(e) {
  if (ts.isParenthesizedExpression(e)) return isMemberRead(e.expression);
  if (ts.isNonNullExpression(e)) return isMemberRead(e.expression);
  return ts.isPropertyAccessExpression(e) || ts.isElementAccessExpression(e) || ts.isIdentifier(e);
}

function containsJsx(node) {
  let found = false;
  (function w(n) {
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) found = true;
    else ts.forEachChild(n, w);
  })(node);
  return found;
}

let touched = 0, wrapped = 0;
for (const root of roots) {
  for (const file of walk(root)) {
    if (/src[\\/]i18n/.test(file)) continue;
    const source = readFileSync(file, "utf8");
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const edits = [];
    (function visit(node) {
      if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
        const name = ts.isJsxElement(node) ? node.openingElement.tagName.getText() : "";
        if (!SKIP_TAGS.has(name)) {
          for (const c of node.children) {
            if (ts.isJsxExpression(c) && c.expression && (hasUiLeaf(c.expression) || (members && isMemberRead(c.expression))) && !containsJsx(c.expression)) {
              edits.push({ start: c.getStart(), end: c.end });
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    })(sf);
    if (edits.length === 0) continue;
    let out = source;
    for (const e of edits.sort((a, b) => b.start - a.start)) {
      out = out.slice(0, e.start) + `<Tr>${out.slice(e.start, e.end)}</Tr>` + out.slice(e.end);
      wrapped++;
    }
    if (/import \{([^}]*)\} from "@\/i18n\/client"/.test(out)) {
      out = out.replace(/import \{([^}]*)\} from "@\/i18n\/client"/, (m, names) => {
        const list = names.split(",").map((s) => s.trim()).filter(Boolean);
        if (!list.includes("Tr")) list.push("Tr");
        return `import { ${list.join(", ")} } from "@/i18n/client"`;
      });
    } else {
      const lines = out.split("\n");
      let at = 0;
      for (let i = 0; i < lines.length; i++) if (/^import .* from /.test(lines[i]) || /^} from /.test(lines[i])) at = i + 1;
      lines.splice(at, 0, `import { Tr } from "@/i18n/client";`);
      out = lines.join("\n");
    }
    touched++;
    if (!dry) writeFileSync(file, out);
  }
}
console.log(`${dry ? "(simulation) " : ""}${touched} fichiers, ${wrapped} expressions enveloppées`);
