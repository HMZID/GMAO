// Liste les gabarits (`texte ${valeur}`) et les paramètres <T params> qui mêlent un texte français à une valeur :
// à convertir en t("texte {valeur}", { valeur }) pour que l'ordre des mots puisse changer d'une langue à l'autre.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { looksLikeUiText } from "./i18n-extract.mjs";
function walk(d, o = []) { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) { if (!["__tests__", "i18n", "db"].includes(n)) walk(p, o); } else if (/\.tsx?$/.test(n) && !/\.test\./.test(n)) o.push(p); } return o; }
const rows = [];
for (const root of process.argv.slice(2)) for (const f of walk(root)) {
  const sf = ts.createSourceFile(f, readFileSync(f, "utf8"), ts.ScriptTarget.Latest, true, f.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  (function v(n) {
    if (ts.isTemplateExpression(n)) {
      const text = [n.head.text, ...n.templateSpans.map((s) => s.literal.text)].join("");
      const parent = n.parent;
      const ignore = ts.isCallExpression(parent) && ts.isIdentifier(parent.expression) && ["cn", "withParams", "redirect"].includes(parent.expression.text);
      if (!ignore && /[A-Za-zÀ-ÿ]{3,}/.test(text) && looksLikeUiText(text.trim())) {
        const ctx = ts.isJsxAttribute(parent) ? `attr ${parent.name.getText()}` : ts.isJsxExpression(parent) ? "jsx" : ts.isPropertyAssignment(parent) ? `prop ${parent.name.getText()}` : ts.isCallExpression(parent) ? "call" : "other";
        if (!/^(className|href|key)/.test(ctx.replace("attr ", ""))) rows.push(`${f.split("\\").join("/")}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}\t${ctx}\t${n.getText().slice(0, 150).replace(/\s+/g, " ")}`);
      }
    }
    ts.forEachChild(n, v);
  })(sf);
}
console.log(rows.length);
console.log(rows.join("\n"));
