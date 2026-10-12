/**
 * Vidéo de démonstration de A à Z : parcours filmé de l'application, profil par profil, avec
 * sous-titres en français. Prérequis : `npm run db:reset`, `npm run build`, puis `npx next start -p 3100`.
 * Lancement : `node scripts/demo-video.mjs` (sortie : docs/demo-video/).
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.env.DEMO_URL ?? "http://localhost:3100";
const OUT = path.resolve("docs/demo-video");
const RAW = path.join(OUT, "brut");
const PASSWORD = "Demo-Gmao-2026";
const STAMP = String(Date.now()).slice(-6);

rmSync(RAW, { recursive: true, force: true });
mkdirSync(RAW, { recursive: true });

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** Attend la fin du chargement : plus aucun squelette visible (les pages déjà visitées restent montées, masquées). */
async function settle(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page
    .waitForFunction(() => [...document.querySelectorAll('[aria-busy="true"]')].every((el) => !el.checkVisibility()), null, { timeout: 15_000 })
    .catch(() => {});
  await pause(400);
}

/** Bandeau de sous-titre en bas de l'écran (titre du chapitre + explication). */
async function say(page, title, text, ms = 3200) {
  await settle(page);
  await page.evaluate(
    ([t, x]) => {
      let el = document.getElementById("demo-caption");
      if (!el) {
        el = document.createElement("div");
        el.id = "demo-caption";
        el.style.cssText =
          "position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483647;max-width:min(1100px,92vw);" +
          "background:rgba(14,40,65,.94);color:#fff;border-radius:14px;padding:14px 22px;font:500 20px/1.35 system-ui,Segoe UI,sans-serif;" +
          "box-shadow:0 10px 30px rgba(0,0,0,.35);pointer-events:none;text-align:center";
        document.body.appendChild(el);
      }
      el.innerHTML = `<div style="font-size:14px;letter-spacing:.08em;text-transform:uppercase;color:#5eead4;margin-bottom:4px">${t}</div>${x}`;
    },
    [title, text],
  );
  await pause(ms);
}

/** Écran de titre plein écran. */
async function card(page, title, subtitle, ms = 3500) {
  await page.evaluate(
    ([t, s]) => {
      document.getElementById("demo-caption")?.remove();
      const el = document.createElement("div");
      el.id = "demo-card";
      el.style.cssText =
        "position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;" +
        "background:linear-gradient(135deg,#0e2841,#0f766e);color:#fff;font-family:system-ui,Segoe UI,sans-serif;text-align:center;padding:40px";
      el.innerHTML = `<div style="font-size:64px;font-weight:700">${t}</div><div style="margin-top:18px;font-size:26px;opacity:.9;max-width:1000px">${s}</div>`;
      document.body.appendChild(el);
    },
    [title, subtitle],
  );
  await pause(ms);
  await page.evaluate(() => document.getElementById("demo-card")?.remove());
}

async function login(page, email, next = "/") {
  await page.context().clearCookies();
  await page.goto(`${BASE}/login${next === "/" ? "" : `?next=${encodeURIComponent(next)}`}`);
  await page.getByLabel("Courriel").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
  await page.waitForLoadState("networkidle").catch(() => {});
}

async function go(page, url) {
  await page.goto(`${BASE}${url}`);
  await page.waitForLoadState("networkidle").catch(() => {});
}

async function scroll(page, pixels, ms = 1500) {
  await page.mouse.wheel(0, pixels);
  await pause(ms);
}

/** Un chapitre ne bloque jamais le film : une étape impossible est signalée et l'on passe à la suite. */
async function chapter(name, fn) {
  try {
    await fn();
    console.log(`OK  ${name}`);
  } catch (error) {
    console.log(`ÉCHEC ${name} : ${error.message.split("\n")[0]}`);
  }
}

const browser = await chromium.launch({ slowMo: 120 });

/* ------------------------------------------------------------------ */
/* Partie ordinateur                                                    */
/* ------------------------------------------------------------------ */

const desktop = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  locale: "fr-FR",
  timezoneId: "Europe/Paris",
  recordVideo: { dir: RAW, size: { width: 1440, height: 900 } },
});
const page = await desktop.newPage();
const desktopVideo = page.video();
page.setDefaultTimeout(20_000);
await page.goto(`${BASE}/login`);
await card(page, "GMAO", "Maintenance des engins, véhicules et équipements — démonstration de A à Z, profil par profil", 4500);

let workOrderUrl = "";
let requestUrl = "";

await chapter("Plateforme", async () => {
  await card(page, "1. Administrateur de la plateforme", "Organisations clientes, démonstrations, comptes, connexion « en tant que »");
  await login(page, "admin@demo.gmao");
  await say(page, "Administrateur de la plateforme", "Il gère toutes les organisations clientes : démonstrations, abonnements, suspensions.");
  await page.getByText("Nouvelle démonstration").click();
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Ouvrir la démonstration" }) });
  await form.getByLabel("Organisation (client)").fill(`Travaux Publics Démo ${STAMP}`);
  await form.getByRole("combobox", { name: "Durée" }).selectOption("30");
  await form.getByLabel("Direction du client (premier compte)").fill("Claire Dupont");
  await form.getByLabel("Courriel (identifiant)").fill(`client.${STAMP}@exemple.test`);
  await form.getByLabel("Mot de passe initial").fill("Client-Demo-2026");
  await say(page, "Ouvrir une démonstration", "Nom du client, durée (7 à 60 jours) et premier compte « Direction » du client.");
  await form.getByRole("button", { name: "Ouvrir la démonstration" }).click();
  await say(
    page,
    "Démonstration ouverte",
    "Le client est prêt : société, site, atelier, magasin et catégories de départ. Seul l'administrateur donne la période.",
  );
  await page
    .locator("table")
    .getByRole("link", { name: /Groupe Démo BTP/ })
    .click();
  await page.waitForLoadState("networkidle").catch(() => {});
  await say(page, "Fiche d'une organisation", "Ses sociétés, ses sites et tous ses comptes. L'administrateur peut y créer des comptes.");
  await scroll(page, 600);
  await say(page, "Se connecter en tant que", "L'administrateur voit et agit exactement comme l'utilisateur choisi — ici, le conducteur.");
  await page.getByRole("row").filter({ hasText: "conducteur@demo.gmao" }).getByRole("button", { name: "Se connecter en tant que" }).click();
  await page.waitForURL(/\/$/);
  await say(page, "Connecté en tant que le conducteur", "Bandeau rouge permanent ; chaque action est tracée au journal au nom de l'administrateur.");
  await page.getByRole("button", { name: "Revenir à mon compte" }).click();
  await page.waitForURL(/plateforme/);
  await say(page, "Retour", "Un clic pour revenir à son propre compte.", 2000);
});

await chapter("Direction", async () => {
  await card(page, "2. Direction", "Elle gère son organisation : structure, accès des membres, données, indicateurs");
  await login(page, "direction@demo.gmao");
  await say(
    page,
    "Tableau de bord",
    "Situation du parc : immobilisés, en maintenance, demandes à qualifier, ordres de travail ouverts, coûts du mois.",
  );
  await go(page, "/administration");
  await say(
    page,
    "Administration",
    "Organisation, utilisateurs, techniciens, référentiel, circuits de validation, courriels, journal, export, connecteur.",
  );
  await go(page, "/administration/organisation");
  await say(page, "Identité de l'organisation", "Nom affiché et logo sous « GMAO », repris sur les fiches imprimées.");
  await scroll(page, 500, 600);
  await say(page, "Sociétés, sites, ateliers, magasins", "Chaque société a ses sites ; chaque site a ses ateliers et ses magasins.");
  await scroll(page, 700, 2000);
  await go(page, "/administration/utilisateurs");
  await say(page, "Accès des membres", "La Direction crée les comptes et donne à chacun un rôle et un périmètre (groupe, société ou site).");
  await page.getByText("Nouveau compte").click();
  const create = page.locator("form").filter({ has: page.getByRole("button", { name: "Créer le compte" }) });
  await create.getByLabel("Nom et prénom").fill("Léa Martin");
  await create.getByLabel("Courriel (identifiant)").fill(`lea.martin.${STAMP}@demo.gmao`);
  await create.getByLabel("Mot de passe initial").fill("Lea-Martin-2026");
  await create.getByRole("combobox", { name: "Rôle" }).selectOption("TECHNICIAN");
  await create.getByRole("combobox", { name: "Périmètre" }).selectOption({ label: "Site — Dépôt Lyon" });
  await create.getByRole("button", { name: "Créer le compte" }).click();
  await say(page, "Compte créé", "Léa Martin, technicienne sur le site de Lyon : elle ne verra que sa partie.");
  await go(page, "/imports");
  await say(
    page,
    "Imports Excel",
    "Engins, articles, stocks, fournisseurs et ouvriers : modèle, simulation ligne par ligne, puis import sans doublon.",
  );
  await go(page, "/administration/export");
  await say(page, "Export des données", "Toute l'organisation ou une seule société, en Excel ou en CSV.");
  await go(page, "/administration/connecteur");
  await page.getByText("Nouvelle clé").click();
  const key = page.locator("form").filter({ has: page.getByRole("button", { name: "Créer la clé" }) });
  await key.getByLabel("Nom").fill("Entrepôt de données");
  await key.getByRole("button", { name: "Créer la clé" }).click();
  await say(page, "Connecteur ETL et IA", "Clé d'API par outil (lecture, import ou assistant IA par MCP), affichée une seule fois, révocable.");
  await go(page, "/indicateurs/personnalises");
  await say(
    page,
    "Indicateurs personnalisés",
    "Chaque organisation compose ses indicateurs : nombre, total ou moyenne, regroupés par statut, site, technicien, mois…",
  );
  await scroll(page, 500);
});

await chapter("Conducteur", async () => {
  await card(page, "3. Conducteur", "Il signale une panne en quelques secondes");
  await login(page, "conducteur@demo.gmao", "/demandes/nouvelle");
  await page.getByLabel("Équipement").selectOption({ label: "CA-101 — Camion benne 8x4" });
  await page.getByLabel("Symptôme").fill("Fuite d'air sur le circuit de freinage");
  await page.getByLabel("Description").fill("Sifflement à l'arrêt, pression qui chute en quelques minutes.");
  await page.getByLabel("La machine est arrêtée").check();
  await say(page, "Signaler une panne", "Équipement, symptôme, machine arrêtée ou risque sécurité : la priorité est proposée automatiquement.");
  await page.getByRole("button", { name: "Envoyer le signalement" }).click();
  await page.getByText("Signalement enregistré").waitFor();
  requestUrl = page.url().replace(/\?.*$/, "");
  await say(page, "Signalement enregistré", "Le chef d'atelier du site est prévenu.");
});

await chapter("Chef d'atelier", async () => {
  await card(page, "4. Chef d'atelier", "Il qualifie la demande, crée et planifie l'ordre de travail");
  await login(page, "chef.lyon@demo.gmao", new URL(requestUrl).pathname);
  await page.getByLabel("Priorité").selectOption("P2");
  await page.getByLabel("Immobiliser l'équipement").check();
  await say(page, "Qualifier", "Il confirme la priorité et immobilise l'engin, devenu inapte à l'exploitation.");
  await page.getByRole("button", { name: "Qualifier" }).click();
  await page.getByText("Demande qualifiée.").waitFor();
  await page.getByRole("button", { name: "Transformer en ordre de travail" }).click();
  await page.waitForURL(/\/ordres-de-travail\/[0-9a-f-]{36}$/);
  workOrderUrl = new URL(page.url()).pathname;
  await say(page, "Ordre de travail créé", "Numéroté par société ; il reprend l'équipement, le symptôme et la priorité.");
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel("Début prévu").fill(`${tomorrow}T08:00`);
  await page.getByLabel("Durée estimée (minutes)").fill("90");
  await page.getByLabel("Julien Moreau").check();
  await say(page, "Planification", "Date, durée et intervenant : une absence bloque, un chevauchement est signalé.");
  await page.getByRole("button", { name: "Enregistrer la planification" }).click();
  await page.getByText("Planification enregistrée.").waitFor();
  await page.getByRole("button", { name: "Planifier" }).click();
  await page.getByText("Planifier : effectué.").waitFor();
  await say(page, "Planifié", "Le technicien est prévenu de son affectation.", 2200);
});

await chapter("Technicien", async () => {
  await card(page, "5. Technicien", "Il réalise l'intervention : temps, compte rendu, compteur");
  await login(page, "tech.lyon@demo.gmao", workOrderUrl);
  await page.getByRole("button", { name: "Démarrer / reprendre" }).click();
  await page.getByText("Démarrer / reprendre : effectué.").waitFor();
  await say(page, "Démarrer", "Le chronomètre démarre ; les conditions de fin de travaux restantes sont listées.");
  await page.getByLabel("Travaux réalisés").fill("Raccord de flexible de frein remplacé, essai d'étanchéité conforme.");
  await page.getByRole("button", { name: "Enregistrer le compte rendu" }).click();
  await page.getByText("Compte rendu enregistré.").waitFor();
  const id = workOrderUrl.split("/").pop();
  const { data } = await (await page.request.get(`${BASE}/api/v1/work-orders/${id}`)).json();
  await page.getByLabel("Relevé (km)").fill(String(Number(data.meters[0].lastValue) + 3));
  await page.getByRole("button", { name: "Enregistrer le relevé" }).click();
  await page.getByText("Relevé enregistré.").waitFor();
  await page.getByText("Saisir une durée").click();
  await page.getByLabel("Durée (minutes)").fill("75");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await page.getByText("Temps enregistré.").waitFor();
  await say(page, "Compte rendu, compteur, temps", "Tout est saisi sur l'ordre de travail, depuis l'ordinateur ou l'application mobile.");
  await page.getByRole("button", { name: "Terminer les travaux" }).click();
  await page.getByText("Terminer les travaux : effectué.").waitFor();
  await say(page, "Travaux terminés", "Le chef d'atelier valide ensuite la remise en service.");
});

await chapter("Remise en service et fiche à signer", async () => {
  await card(page, "6. Remise en service", "Validation du chef d'atelier et fiche d'intervention à signer");
  await login(page, "chef.lyon@demo.gmao", workOrderUrl);
  await page.getByLabel("Essais de remise en service conformes").check();
  await page.getByRole("button", { name: "Valider la remise en service" }).click();
  await page.getByText("Valider la remise en service : effectué.").waitFor();
  await say(page, "Remis en service", "L'engin redevient exploitable ; les coûts (main-d'œuvre, pièces, prestataire) sont calculés.");
  await page.getByRole("link", { name: "Fiche à signer" }).click();
  await page.waitForURL(/impression/);
  await page.getByRole("link", { name: "Afficher les coûts" }).waitFor();
  await say(
    page,
    "Fiche d'intervention",
    "État A4 avec le logo de l'organisation et trois cadres de signature (intervenant, prestataire, responsable).",
  );
  await page.getByRole("link", { name: "Afficher les coûts" }).click();
  await page.getByRole("link", { name: "Masquer les coûts" }).waitFor();
  await say(page, "Avec ou sans les coûts", "La fiche s'imprime ou s'enregistre en PDF depuis le navigateur.", 2500);
  await scroll(page, 900, 2500);
});

await chapter("Responsable maintenance", async () => {
  await card(page, "7. Responsable maintenance", "Préventif, planning, validations et indicateurs");
  await login(page, "resp.maintenance@demo.gmao", "/preventif/echeances");
  await say(page, "Échéances préventives", "À venir, en pré-alerte, échues, en retard ; génération des ordres de travail en un clic.");
  await go(page, "/preventif");
  await say(page, "Plans d'entretien", "Par catégorie ou modèle, à la date ou au compteur (heures, kilomètres).");
  await go(page, "/planning");
  await say(page, "Planning de la semaine", "Charge de chaque technicien, absences, interventions planifiées et à planifier.");
  await go(page, "/validations");
  await say(page, "Validations", "Dépenses au-delà du seuil et demandes en attente de sa décision.");
  await go(page, "/indicateurs");
  await say(page, "Indicateurs", "Disponibilité, MTBF, MTTR, respect du préventif, coûts par catégorie et par équipement.");
  await scroll(page, 700, 2500);
});

await chapter("Magasinier", async () => {
  await card(page, "8. Magasinier", "Articles, stocks, mouvements et demandes d'achat");
  await login(page, "magasin@demo.gmao", "/stock");
  await say(page, "Pièces et stocks", "Catalogue, stock par magasin, articles sous le point de commande.");
  await go(page, "/stock/mouvements");
  await say(page, "Mouvements de stock", "Réceptions, sorties sur ordre de travail, transferts, inventaires ; jamais de stock négatif.");
  await go(page, "/demandes-achat/nouvelle");
  await page.getByLabel("Objet de la demande").fill("Jeu de filtres hydrauliques");
  await page.getByLabel("Quantité").fill("4");
  await page.getByLabel("Prix unitaire estimé (€)").fill("85");
  await page.getByLabel("Équipement").selectOption({ label: "CH-012 — Chargeuse sur pneus 950M" });
  await say(page, "Demande d'achat", "Rattachée à un équipement, un ordre de travail ou un centre de coût ; elle suit le circuit de validation.");
  await page.getByRole("button", { name: "Soumettre la demande" }).click();
  await page.waitForURL(/\/demandes-achat\/[0-9a-f-]{36}/);
  await say(page, "Demande soumise", "Le responsable achats la valide ; au-delà du seuil, la direction aussi.");
});

await chapter("Responsable achats", async () => {
  await card(page, "9. Responsable achats", "Fournisseurs et validation des achats");
  await login(page, "achats@demo.gmao", "/achats");
  await say(page, "Fournisseurs et prestataires", "Référentiel unique ; un identifiant fiscal ne peut être enregistré qu'une fois.");
  await go(page, "/validations");
  await say(page, "Valider les achats", "Il valide ou refuse, avec un commentaire ; le demandeur ne valide jamais sa propre demande.");
  await scroll(page, 500, 2000);
});

await page.goto(`${BASE}/login`);
await card(page, "10. Sur téléphone et tablette", "La même application, adaptée aux petits écrans", 3000);
await desktop.close();

/* ------------------------------------------------------------------ */
/* Partie téléphone                                                     */
/* ------------------------------------------------------------------ */

const phone = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: "fr-FR",
  timezoneId: "Europe/Paris",
  recordVideo: { dir: RAW, size: { width: 390, height: 844 } },
});
const mobile = await phone.newPage();
const phoneVideo = mobile.video();
mobile.setDefaultTimeout(20_000);
await chapter("Téléphone", async () => {
  await login(mobile, "resp.maintenance@demo.gmao");
  await say(mobile, "Téléphone", "Barre d'onglets en bas, tuiles sur deux colonnes.");
  await scroll(mobile, 600, 1500);
  await go(mobile, "/planning");
  await say(mobile, "Planning jour par jour", "Un jour à la fois, une carte par technicien.");
  await scroll(mobile, 500, 1500);
  await go(mobile, "/ordres-de-travail");
  await say(mobile, "Listes en cartes", "Plus de défilement horizontal : chaque ligne devient une carte.");
  await scroll(mobile, 600, 1500);
  await say(mobile, "Fin de la démonstration", "GMAO — maintenance des engins, véhicules et équipements.", 3500);
});
await phone.close();
await browser.close();

// Assemblage : séquence ordinateur puis séquence téléphone, centrée sur un fond aux couleurs de l'application.
const parts = [await desktopVideo.path(), await phoneVideo.path()];
const output = path.join(OUT, "gmao-demo.mp4");
const ffmpeg = process.env.FFMPEG ?? "ffmpeg";
const result = spawnSync(
  ffmpeg,
  [
    "-y",
    "-i",
    parts[0],
    "-i",
    parts[1],
    "-filter_complex",
    "[0:v]scale=1440:900,setsar=1,fps=25[a];" +
      "[1:v]scale=-2:880:flags=lanczos,pad=1440:900:(ow-iw)/2:(oh-ih)/2:color=0x0e2841,setsar=1,fps=25[b];" +
      "[a][b]concat=n=2:v=1:a=0[v]",
    "-map",
    "[v]",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "22",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    output,
  ],
  { stdio: "inherit" },
);
if (result.status !== 0) throw new Error("Assemblage ffmpeg en échec.");
console.log(`Vidéo : ${output}`);
