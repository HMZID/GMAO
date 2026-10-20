// Textes à traduire de l'application mobile : t("…"), propriétés de texte (title, label, placeholder, hint) et
// quelques textes d'erreur ou de libellé définis hors des écrans. Sert au test de couverture
// (mobile/src/i18n/__tests__/dictionaries.test.ts). `node scripts/i18n-mobile.mjs` les liste ; `jsx` : textes JSX bruts.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = join(fileURLToPath(new URL("..", import.meta.url)), "mobile", "src");
const PROPS = new Set(["title", "label", "placeholder", "hint"]);

/** Textes que l'extraction ne voit pas : messages d'erreur levés hors des écrans, libellés choisis par une condition. */
const EXTRA_KEYS = [
  "Réseau indisponible : la saisie est conservée et sera envoyée plus tard.",
  "Serveur injoignable : vérifier la connexion.",
  "Courriel ou mot de passe incorrect.",
  "Le serveur n'a pas renvoyé de jeton.",
  "Session expirée : se reconnecter.",
  "Serveur injoignable.",
  "Introuvable ou hors de votre périmètre.",
  "Hors connexion : ces données n'ont pas encore été consultées sur cet appareil.",
  "Autoriser la caméra pour photographier l'intervention.",
  "Connexion impossible.",
  "Temps passé",
  "Pièce consommée",
  "Point de checklist",
  "Compte rendu",
  "Changement de statut",
  "Photo",
  "Relevé de compteur",
  "Demande d'intervention",
  "démarrage",
  "travaux terminés",
  "mise en attente",
  "Redémarrage nécessaire",
  "Fermez puis rouvrez l'application pour appliquer le sens d'écriture.",
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (!/__tests__|i18n$/.test(path)) walk(path, out);
    } else if (/\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

function scan() {
  const keys = new Set(EXTRA_KEYS);
  const jsx = [];
  for (const file of walk(root)) {
    const sf = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const add = (key) => {
      if (/[A-Za-zÀ-ÿ]/.test(key)) keys.add(key);
    };
    (function visit(node) {
      const isCall = ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "t";
      if (isCall && node.arguments[0] && (ts.isStringLiteral(node.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(node.arguments[0])))
        add(node.arguments[0].text);
      if (ts.isJsxAttribute(node) && PROPS.has(node.name.text) && node.initializer && ts.isStringLiteral(node.initializer))
        add(node.initializer.text);
      if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && node.name.text === "label" && ts.isStringLiteral(node.initializer))
        add(node.initializer.text);
      if (ts.isJsxText(node) && !node.containsOnlyTriviaWhiteSpaces && /[A-Za-zÀ-ÿ]{2}/.test(node.text))
        jsx.push(`${file.slice(root.length)} :: ${node.text.trim()}`);
      ts.forEachChild(node, visit);
    })(sf);
  }
  return { keys: [...keys].sort(), jsx };
}

export function collectMobileKeys() {
  return scan().keys;
}

/** Textes écrits en dur dans le JSX (hors marque) : ils ne passeraient par aucune traduction. */
export function collectMobileRawText() {
  return scan().jsx.filter((line) => !line.endsWith(":: GMAO"));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log((process.argv[2] === "jsx" ? collectMobileRawText() : collectMobileKeys()).join("\n"));
}
