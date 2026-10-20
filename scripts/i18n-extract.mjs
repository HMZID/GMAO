// Liste les textes à traduire : <T>…</T>, t("…"), msg("…"), propriétés de texte (title, label…) et chaînes de
// libellés. Sert au test de couverture (src/i18n/__tests__/coverage.test.ts) et à l'écriture des dictionnaires.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const ENTITIES = {
  "&apos;": "'",
  "&amp;": "&",
  "&nbsp;": "\u00a0",
  "&laquo;": "«",
  "&raquo;": "»",
  "&quot;": '"',
  "&lt;": "<",
  "&gt;": ">",
  "&hellip;": "…",
  "&middot;": "·",
};
const decode = (s) => s.replace(/&[a-z]+;/g, (m) => ENTITIES[m] ?? m);
const TEXT_PROPS = new Set([
  "title",
  "label",
  "description",
  "hint",
  "placeholder",
  "aria-label",
  "alt",
  "emptyText",
  "pendingLabel",
  "short",
  "text",
  "name",
]);

/** Textes littéraux d'une expression (branches de ?:, ??, ||, parenthèses, gabarits tpl). */
export function stringLeaves(e) {
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return [e.text];
  if (ts.isParenthesizedExpression(e)) return stringLeaves(e.expression);
  if (ts.isConditionalExpression(e)) return [...stringLeaves(e.whenTrue), ...stringLeaves(e.whenFalse)];
  if (ts.isBinaryExpression(e)) return [...stringLeaves(e.left), ...stringLeaves(e.right)];
  if (ts.isTaggedTemplateExpression(e) && e.tag.getText() === "tpl") {
    const t = e.template;
    return [ts.isNoSubstitutionTemplateLiteral(t) ? t.text : t.head.text + t.templateSpans.map((s, i) => `{${i + 1}}` + s.literal.text).join("")];
  }
  return [];
}

export function jsxTextKey(raw) {
  return decode(
    raw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .join(" "),
  );
}

/** Une chaîne « ressemble » à un texte d'interface (et non à une classe CSS, un chemin, un identifiant). */
export function looksLikeUiText(s) {
  if (s.length < 2 || s.length > 400) return false;
  if (!/[A-Za-zÀ-ÿ]/.test(s)) return false;
  if (/^[a-z0-9_\-:./\[\]#%@!?,=&+*()|^~$ ]+$/.test(s) && !/\s[a-zà-ÿ]{2,}\s/.test(s) && !/[à-ÿ]/.test(s)) return false; // classes, chemins, identifiants
  if (/^[A-Z0-9_]+$/.test(s)) return false;
  // Listes de classes CSS (Tailwind) : jetons en minuscules avec tirets, deux-points ou crochets.
  const tokens = s.split(/\s+/);
  if (
    tokens.length >= 1 &&
    tokens.every((t) => /^[a-z0-9:\[\]\-_/.%()!#,'"=&@*]+$/.test(t)) &&
    tokens.some((t) => /[-:\[\]]/.test(t)) &&
    !/[àâçéèêëîïôùûü]/.test(s)
  )
    return false;
  if (/^(https?:|\/|#|\.|@)/.test(s)) return false;
  if (/^[a-z]+[A-Z]\w*$/.test(s)) return false; // camelCase
  return /[A-ZÀ-Ý]/.test(s[0]) || /\s/.test(s) || /[à-ÿ]/.test(s);
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "__tests__" || name === "i18n") continue;
      walk(p, out);
    } else if (/\.(tsx|ts)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

export function extract(roots) {
  const found = new Map(); // texte → { kind, files:Set }
  const add = (text, kind, file) => {
    if (!text) return;
    const e = found.get(text) ?? { kinds: new Set(), files: new Set() };
    e.kinds.add(kind);
    e.files.add(file.split("\\").join("/"));
    found.set(text, e);
  };
  for (const root of roots) {
    for (const file of walk(root)) {
      const sf = ts.createSourceFile(
        file,
        readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      const isLabels = /lib[\\/]labels\.ts$|domain[\\/](site-defaults|email)\.ts$|nav-items\.ts$|site[\\/]site-data|components[\\/]site/.test(file);
      const visit = (n) => {
        // <T>texte</T>, <T>{"texte"}</T>, <T>{cond ? "a" : "b"}</T>
        if (ts.isJsxElement(n) && n.openingElement.tagName.getText() === "T") {
          const kids = n.children;
          if (kids.length === 1 && ts.isJsxText(kids[0])) add(jsxTextKey(kids[0].text), "T", file);
          else if (kids.length === 1 && ts.isJsxExpression(kids[0]) && kids[0].expression)
            for (const s of stringLeaves(kids[0].expression)) add(s, "T", file);
        }
        // <Tr>{cond ? "a" : "b"}</Tr>
        if (ts.isJsxElement(n) && n.openingElement.tagName.getText() === "Tr") {
          for (const k of n.children) if (ts.isJsxExpression(k) && k.expression) for (const s of stringLeaves(k.expression)) add(s, "Tr", file);
        }
        // tpl`texte ${valeur}` → « texte {1} »
        if (ts.isTaggedTemplateExpression(n) && n.tag.getText() === "tpl") {
          const t = n.template;
          if (ts.isNoSubstitutionTemplateLiteral(t)) add(t.text, "tpl", file);
          else add(t.head.text + t.templateSpans.map((s, i) => `{${i + 1}}` + s.literal.text).join(""), "tpl", file);
        }
        // t("…") / msg("…")
        if (
          ts.isCallExpression(n) &&
          ts.isIdentifier(n.expression) &&
          ["t", "msg"].includes(n.expression.text) &&
          n.arguments[0] &&
          ts.isStringLiteralLike(n.arguments[0])
        ) {
          add(n.arguments[0].text, n.expression.text, file);
        }
        // props de texte
        if (
          ts.isJsxAttribute(n) &&
          TEXT_PROPS.has(n.name.getText()) &&
          n.initializer &&
          ts.isStringLiteral(n.initializer) &&
          looksLikeUiText(n.initializer.text)
        ) {
          if (!(n.name.getText() === "name")) add(decode(n.initializer.text), "prop", file);
        }
        // chaînes de libellés (labels.ts…) : toute chaîne qui ressemble à un texte d'interface
        if (isLabels && ts.isStringLiteralLike(n) && !ts.isImportDeclaration(n.parent) && !ts.isPropertyAssignment(n) && looksLikeUiText(n.text)) {
          const parent = n.parent;
          const isKey = ts.isPropertyAssignment(parent) && parent.name === n;
          if (!isKey) add(n.text, "label", file);
        }
        ts.forEachChild(n, visit);
      };
      visit(sf);
    }
  }
  return found;
}

if (process.argv[1] && process.argv[1].endsWith("i18n-extract.mjs")) {
  const found = extract(["src"]);
  const byKind = {};
  for (const [, e] of found) for (const k of e.kinds) byKind[k] = (byKind[k] ?? 0) + 1;
  console.log(found.size, "textes distincts", byKind);
  if (process.argv.includes("--list")) for (const [t, e] of found) console.log(`${[...e.kinds].join(",")}\t${t}`);
}
