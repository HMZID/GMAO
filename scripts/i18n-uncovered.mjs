import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { looksLikeUiText } from "./i18n-extract.mjs";
const TR_PROPS = new Set(["title", "label", "description", "hint", "placeholder", "emptyText", "pendingLabel", "short", "text"]);
const SKIP_ATTR = new Set([
  "className",
  "href",
  "key",
  "type",
  "name",
  "id",
  "htmlFor",
  "method",
  "target",
  "rel",
  "role",
  "autoComplete",
  "inputMode",
  "value",
  "defaultValue",
  "variant",
  "size",
  "tone",
  "src",
  "action",
  "mode",
  "accept",
  "pattern",
  "step",
  "min",
  "max",
  "style",
  "dir",
  "lang",
  "icon",
  "kind",
  "scope",
  "data-label",
  "list",
  "form",
  "formAction",
  "autoFocus",
  "tabIndex",
  "colSpan",
  "rows",
  "cols",
]);
function walk(d, o = []) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) {
      if (n !== "__tests__") walk(p, o);
    } else if (/\.tsx?$/.test(n) && !/\.test\./.test(n)) o.push(p);
  }
  return o;
}
const roots = process.argv.slice(2);
const out = [];
for (const r of roots)
  for (const f of walk(r)) {
    const sf = ts.createSourceFile(f, readFileSync(f, "utf8"), ts.ScriptTarget.Latest, true, f.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    (function v(n) {
      if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) return;
      const lit =
        ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n);
      if (lit && looksLikeUiText(n.text.trim())) {
        const p = n.parent;
        let skip = false;
        if (ts.isJsxAttribute(p) && SKIP_ATTR.has(p.name.getText())) skip = true;
        // Propriétés de texte des composants : traduites par le composant lui-même (Tr).
        if (ts.isJsxAttribute(p) && TR_PROPS.has(p.name.getText())) {
          const tag = p.parent.parent.tagName.getText();
          if (/^[A-Z]/.test(tag) && !["Link", "ButtonLink", "Image"].includes(tag)) skip = true;
        }
        if (ts.isPropertyAssignment(p) && p.name === n) skip = true;
        // Valeurs de propriétés de texte (libellés d'objets) : traduites par les composants qui les affichent.
        if (ts.isPropertyAssignment(p) && p.initializer === n && TR_PROPS.has(p.name.getText())) skip = true;
        if (ts.isJsxAttribute(p) && ["what", "label"].includes(p.name.getText())) skip = true;
        // Messages renvoyés par les Server Actions : traduits à l'affichage (FormMessage) ; dictionnaire seulement.
        if (/actions\.ts$/.test(f.split("\\").join("/"))) skip = true;
        if (
          ts.isCallExpression(p) &&
          ts.isIdentifier(p.expression) &&
          ["t", "msg", "cn", "require", "withParams", "redirect", "revalidatePath"].includes(p.expression.text)
        )
          skip = true;
        if (ts.isElementAccessExpression(p) && p.argumentExpression === n) skip = true;
        if (ts.isJsxExpression(p) && ts.isJsxElement(p.parent) && p.parent.openingElement.tagName.getText() === "T") skip = true;
        if (
          ts.isBinaryExpression(p) &&
          [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(p.operatorToken.kind)
        )
          skip = true;
        if (ts.isCaseClause(p)) skip = true;
        if (/^(console|throw)/.test(p.getText().slice(0, 7))) skip = true;
        if (!skip) out.push(`${f.split("\\").join("/")}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}\t${n.text.trim().slice(0, 110)}`);
      }
      ts.forEachChild(n, v);
    })(sf);
  }
console.log(out.length);
console.log(out.join("\n"));
