// Liste complète des textes français à traduire (pour écrire ou compléter les dictionnaires) :
//   node scripts/i18n-keys.mjs > clés.json
// Réunit les textes déjà enveloppés (<T>, t(), msg()), les propriétés de texte, les libellés (labels.ts…), les
// chaînes d'interface des écrans et les messages des services (erreurs métier, validations).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { extract, looksLikeUiText } from "./i18n-extract.mjs";

const STOPWORDS = /\b(le|la|les|de|des|du|un|une|est|sont|pas|ne|doit|doivent|obligatoire|impossible|ou|et|au|aux|sur|pour|avec|sans|dans|par|ce|cette|votre|vos|déjà|plus|aucun|aucune)\b/i;
const TECHNICAL = /gmk_|curl |mcp add|Authorization|select |insert |update |delete |from |where |SELECT|\bAPI\b.*http|^[A-Z_]+:$|COMPANY:|SITE:|^Europe\/|\.xlsx|\.csv|%s|\$\{/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "__tests__" || name === "i18n" || name === "db") continue;
      walk(p, out);
    } else if (/\.(tsx?)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

/** Tous les textes français à traduire, triés. */
export function collectKeys() {
  const keys = new Map();
  const add = (text) => {
    const t = text.replace(/\s+/g, " ").trim();
    if (!t || TECHNICAL.test(t)) return;
    keys.set(t, (keys.get(t) ?? 0) + 1);
  };

  for (const [text] of extract(["src"])) add(text);

  const UI_ROOTS = [["src/app", false], ["src/components", false], ["src/lib", false], ["src/server", true]];
  const NOISE_ATTRS = new Set(["className", "href", "key", "type", "name", "id", "htmlFor", "method", "target", "rel", "role", "autoComplete", "inputMode", "value", "defaultValue", "variant", "size", "tone", "src", "action", "mode", "accept", "pattern", "step", "min", "max", "style", "dir", "lang", "icon", "kind", "scope", "form", "formAction", "tabIndex", "colSpan"]);
  for (const [root, serverSide] of UI_ROOTS) {
    for (const file of walk(root)) {
      if (/server[\/](db|auth|storage|mcp|api)[\/]|server[\/]validation|server[\/]errors/.test(file) && !/validation/.test(file)) continue;
      const sf = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      (function v(n) {
        if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) return;
        // Les gabarits (tpl`…`) sont traités par extract() avec leurs valeurs {1}, {2}… : on ignore leurs morceaux.
        const lit = ts.isStringLiteral(n) || (ts.isNoSubstitutionTemplateLiteral(n) && !(n.parent && ts.isTaggedTemplateExpression(n.parent)));
        if (lit) {
          const text = n.text;
          const p = n.parent;
          let skip = false;
          if (ts.isJsxAttribute(p) && NOISE_ATTRS.has(p.name.getText())) skip = true;
          if (ts.isPropertyAssignment(p) && p.name === n) skip = true;
          if (ts.isElementAccessExpression(p) && p.argumentExpression === n) skip = true;
          if (ts.isCaseClause(p)) skip = true;
          if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(p.operatorToken.kind)) skip = true;
          if (ts.isCallExpression(p) && ts.isIdentifier(p.expression) && ["cn", "withParams", "redirect", "revalidatePath", "require"].includes(p.expression.text)) skip = true;
          if (/^(console\.)/.test(p.getText().slice(0, 8))) skip = true;
          const candidate = looksLikeUiText(text.trim());
          // Serveur : seulement les phrases françaises (messages d'erreur, avertissements, libellés d'événements).
          const sentence = !serverSide || (/[A-ZÀ-Ý]/.test(text.trim()[0] ?? "") && (STOPWORDS.test(text) || /[à-ÿ]/.test(text)) && text.trim().length > 6);
          if (!skip && candidate && sentence) add(text);
        }
        ts.forEachChild(n, v);
      })(sf);
    }
  }


  const sorted = [...keys.keys()].sort((a, b) => a.localeCompare(b, "fr"));
  return sorted;
}

if (process.argv[1] && process.argv[1].endsWith("i18n-keys.mjs")) console.log(JSON.stringify(collectKeys()));
