/**
 * Vidéo de démonstration en arabe tunisien (derja) : parcours complet du responsable maintenance
 * (resp.maintenance@demo.gmao) sur le jeu de démonstration du Groupe Démo BTP, avec voix off et sous-titres.
 *
 * Prérequis : `npm run db:reset`, `npm run worker -- --once` (notifications), `npm run build`,
 * puis `npx next start -p 3100` ; Python avec `edge-tts` (voix ar-TN-ReemNeural) et ffmpeg.
 * Lancement : `node scripts/demo-video-ar.mjs` (sortie : docs/demo-video/gmao-demo-ar.mp4).
 * `DRY=1` : tournage sans voix (pauses fixes), pour vérifier le parcours.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.env.DEMO_URL ?? "http://localhost:3100";
const OUT = path.resolve("docs/demo-video");
const RAW = path.join(OUT, "brut-ar");
const VOICE_DIR = path.join(OUT, "voix-ar");
const PASSWORD = "Demo-Gmao-2026";
const MANAGER = "resp.maintenance@demo.gmao";
const VOICE = process.env.VOICE ?? "ar-TN-ReemNeural";
const DRY = process.env.DRY === "1";
const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const FFPROBE = process.env.FFPROBE ?? "ffprobe";
const PYTHON = process.env.PYTHON ?? "python";

/* ------------------------------------------------------------------ */
/* Narration : titre, sous-titre affiché (c) et texte lu (v, si différent) */
/* ------------------------------------------------------------------ */

const LINES = {
  intro: {
    t: "جولة كاملة في التطبيقة",
    c: "عسلامة! في الفيديو هذا باش نعملو جولة كاملة في تطبيقة GMAO، مع كريم، مسؤول الصيانة في مجموعة Démo BTP. باش نشوفو كيفاش يتبع الماكينات والكراهب، الصيانة الوقائية، الأعطال، البياسات والمصاريف، الكل في بلاصة وحدة.",
    v: "عسلامة! في الفيديو هذا باش نعملو جولة كاملة في تطبيقة جي إم آ أو، مع كريم، مسؤول الصيانة في مجموعة ديمو بي تي بي. باش نشوفو كيفاش يتبع الماكينات والكراهب، الصيانة الوقائية، الأعطال، البياسات والمصاريف، الكل في بلاصة وحدة.",
  },
  login: {
    t: "الدخول",
    c: "نبداو بالدخول: كريم يكتب الإيمايل وكلمة السر متاعو. وكان يحب، ينجم يزيد حماية الحساب بكود يجيه على التليفون.",
  },
  dash1: {
    t: "لوحة القيادة",
    c: "هاذي لوحة القيادة. من أول نظرة، كريم يشوف الماكينات الواقفة، اللي في الصيانة واللي خدامة، طلبات التدخل اللي تستنى، أوامر العمل المفتوحة، والكلفة متاع الشهر.",
  },
  dash2: {
    t: "التنبيهات الإدارية",
    c: "والبانو الأحمر هذا ينبهو للتأمين، والفيزيت التقنية، والفينيات اللي قرب وقتها ولا فات.",
  },
  dash3: {
    t: "المتابعة اليومية",
    c: "وتحت، يلقى أوامر العمل مرتبة حسب الأولوية، والصيانات الوقائية اللي لازمها تتعمل.",
  },
  fleet1: {
    t: "حظيرة المعدات",
    c: "في قائمة المعدات عندنا ستة وعشرين معدة: كميونات، بالات، شارجوزات، كومباكتورات، شاريوات، جينيراتورات وكراهب خدمة، موزعين على ثلاثة مواقع.",
  },
  fleet2: {
    t: "البحث والفلترة",
    c: "نجمو نلوجو بالكود ولا بالماتريكول، ولا نفلترو حسب الحالة، الموقع، النوع والأهمية. مثلا هوني الكميونات برك.",
  },
  eq1: {
    t: "فيشة المعدة",
    c: "نحلو فيشة الكميون CA-101: الكونتور بالكيلومترات، وتاريخ القراءات الكل.",
    v: "نحلو فيشة الكميون متاع ليون: الكونتور بالكيلومترات، وتاريخ القراءات الكل.",
  },
  eq2: {
    t: "الصيانة الوقائية والتدخلات",
    c: "تحت، نلقاو الصيانة الوقائية متاعو: الفيدانج كل ثلاثين ألف كيلومتر ولا كل عام، والفيزيت التقنية السنوية، والتدخلات اللي صارت عليه بالكلفة متاعها.",
  },
  dl1: {
    t: "التأمين، الفيزيت والفينيات",
    c: "وهوني الآجال الإدارية: التأمين، والفيزيت التقنية، والفينيات. التطبيقة تبعث تنبيه وإيمايل لمسؤول الحظيرة قبل ثلاثين يوم، قبل سبعة أيام، ونهار الأجل، ومن بعد كل جمعة كان مازال ما تجددش.",
  },
  dl2: {
    t: "تجديد التأمين",
    c: "التأمين متاع الكميون باقيلو اثناش يوم. نجددوه: نحطو التاريخ الجديد ونومرو البوليصة.",
  },
  dl3: {
    t: "تم التجديد",
    c: "يزي! التأمين الجديد ولا هو المتبع، والقديم يتحفظ في التاريخ.",
  },
  dl4: {
    t: "آجال الحظيرة الكل",
    c: "وفي الصفحة هذي، الآجال متاع الحظيرة الكل، من الأقرب للأبعد: شنوة فات، وشنوة لازم يتجدد في الثلاثين يوم الجايين.",
  },
  notif: {
    t: "الإشعارات",
    c: "الإشعارات توصل في التطبيقة وبالإيمايل: الفيدانج وتبديل الفيلترات، التأمين، الفيزيت، الأعطال المستعجلة. وكل واحد يوصلو كان اللي يخص الموقع متاعو.",
  },
  prev1: {
    t: "برامج الصيانة الوقائية",
    c: "الصيانة الوقائية: لكل نوع معدات برنامج صيانة، بالتاريخ ولا بالكونتور، بالساعات ولا بالكيلومترات.",
  },
  prev2: {
    t: "مثال: الفيدانج والفيلترات",
    c: "مثلا الشارجوز: فيدانج، وتبديل فيلتر الزيت وفيلتر القازوال، كل ميتين وخمسين ساعة ولا كل ثلاثة شهور، اللي يجي الأول.",
  },
  prev3: {
    t: "آجال الصيانة",
    c: "قائمة الآجال: الجاية، اللي في التنبيه المسبق، اللي حلت، واللي فات وقتها. وبنقرة وحدة، التطبيقة تولد أوامر العمل الناقصة، من غير ما تعاود نفس الأمر مرتين.",
  },
  r1a: {
    t: "السيناريو 1: صيانة دورية",
    c: "السيناريو الأول: صيانة دورية حل وقتها. أمر العمل متاع الشارجوز CH-012 مبرمج مع جوليان. كريم يبدا الخدمة.",
    v: "السيناريو الأول: صيانة دورية حل وقتها. أمر العمل متاع الشارجوز متاع ليون مبرمج مع جوليان. كريم يبدا الخدمة.",
  },
  r1b: {
    t: "قائمة المراقبة",
    c: "نعمرو قائمة المراقبة: الفيدانج، الفيلترات، المستويات، الشحم والعجلات. كل نقطة إجبارية لازمها تتعمر.",
  },
  r1c: {
    t: "البياسات، الوقت والكونتور",
    c: "نخرجو البياسات من المخزن: فيلتر الزيت والزيت. ونسجلو الوقت اللي تعدى، والكونتور، والتقرير متاع الخدمة.",
  },
  r1d: {
    t: "انتهاء الأشغال",
    c: "الخدمة كملت. التطبيقة تثبت اللي حتى شرط ما نقص: التقرير، القائمة، الكونتور والوقت.",
  },
  r1e: {
    t: "الرجوع للخدمة",
    c: "التجارب مزيانة: الماكينة ترجع للخدمة. والكلفة تتحسب وحدها: اليد العاملة، البياسات، والمقاول كان فما. والأجل الجاي يتحسب أوتوماتيكيا.",
  },
  r1f: {
    t: "ورقة التدخل",
    c: "وهاذي ورقة التدخل للإمضاء، بالشعار متاع الشركة، تتطبع ولا تتسجل PDF.",
    v: "وهاذي ورقة التدخل للإمضاء، بالشعار متاع الشركة، تتطبع ولا تتسجل بي دي آف.",
  },
  r2a: {
    t: "السيناريو 2: عطب",
    c: "السيناريو الثاني: عطب. الشوفور ولا الفني يبعث طلب تدخل من التليفون ولا من الحاسوب. وكريم يلقى الطلبات الجديدة الكل هوني.",
  },
  r2b: {
    t: "تقييم الطلب",
    c: "طلب على الكميون CA-104: صوت في الفرانات. كريم يعطيه أولوية عالية، ويوقف الكميون حتى يتصلح.",
    v: "طلب على كميون مرسيليا: صوت في الفرانات. كريم يعطيه أولوية عالية، ويوقف الكميون حتى يتصلح.",
  },
  r2c: {
    t: "من الطلب لأمر العمل",
    c: "بنقرة وحدة، الطلب يولي أمر عمل، بالمعدة والأعراض والأولوية.",
  },
  r2d: {
    t: "البرمجة",
    c: "نبرمجوه غدوة الصباح مع سمير، الفني متاع مرسيليا. كان الفني غايب، التطبيقة ما تخليناش، وكان فما تداخل في الوقت، تنبهنا.",
  },
  r2e: {
    t: "مبرمج",
    c: "أمر العمل تبرمج، وسمير يوصلو إشعار بالخدمة متاعو.",
  },
  r3a: {
    t: "السيناريو 3: بياسة ناقصة",
    c: "السيناريو الثالث: بياسة ناقصة. الشاريو CE-031 واقف، يستنى في بومبة هيدروليك.",
    v: "السيناريو الثالث: بياسة ناقصة. الشاريو متاع ليون واقف، يستنى في بومبة هيدروليك.",
  },
  r3b: {
    t: "حجز مستحيل",
    c: "نحاولو نحجزو البومبة من مخزن ليون: التطبيقة ترفض، خاطر ما فماش. أما تورينا اللي فما وحدة في مخزن مرسيليا.",
  },
  r3c: {
    t: "تحويل بين المخازن",
    c: "نعملو تحويل من مرسيليا لليون. والمخزون عمرو ما يولي بالناقص.",
  },
  r3d: {
    t: "الحجز",
    c: "توا الحجز يتعدى، والبومبة محجوزة لأمر العمل هذا.",
  },
  r3e: {
    t: "المصادقة على المصاريف",
    c: "وكراء شاريو بديل بألف وأربعمية وخمسين أورو، فوق الحد المسموح: لازمو مصادقة مسؤول الصيانة. كريم يصادق، والقرار يتسجل.",
  },
  r4: {
    t: "السيناريو 4: تبديل الكونتور",
    c: "السيناريو الرابع: الكونتور متاع البالة PE-002 تبدل. التطبيقة تحافظ على الساعات الجملية، وهكا الصيانة الوقائية تبقى مضبوطة.",
    v: "السيناريو الرابع: الكونتور متاع البالة متاع مرسيليا تبدل. التطبيقة تحافظ على الساعات الجملية، وهكا الصيانة الوقائية تبقى مضبوطة.",
  },
  r5a: {
    t: "السيناريو 5: مراقبة قانونية",
    c: "السيناريو الخامس: المراقبة القانونية متاع الشاريو CE-020 فاتت. الشاريو ولى واقف أوتوماتيكيا.",
    v: "السيناريو الخامس: المراقبة القانونية متاع الشاريو متاع مرسيليا فاتت. الشاريو ولى واقف أوتوماتيكيا.",
  },
  r5b: {
    t: "تعيين مرفوض",
    c: "نحاولو نبعثوه لشانطي: التطبيقة ترفض. وما يرجع للخدمة كان ما نحطو تقرير المراقبة.",
  },
  plan: {
    t: "البلانينغ",
    c: "البلانينغ متاع الجمعة: الخدمة متاع كل فني نهار بنهار، الغيابات، والتدخلات اللي تستنى البرمجة.",
  },
  stock1: {
    t: "المخزون",
    c: "المخزون: البياسات في كل مخزن، الكميات المحجوزة، والبياسات اللي نزلت تحت الحد الأدنى.",
  },
  r6a: {
    t: "السيناريو 6: الجرد",
    c: "السيناريو السادس: الجرد. المغازني لقى فرق في فيلترات الهواء. الفرق كبير، يلزمو مصادقة.",
  },
  r6b: {
    t: "المصادقة على الفرق",
    c: "كريم يصادق، والمخزون يتعدل بالكلفة المتوسطة، وكل شي يتسجل.",
  },
  da1: {
    t: "طلب شراء",
    c: "طلب شراء: كريم يطلب فيلترات هيدروليك للشارجوز، والطلب يمشي في دورة المصادقة متاع الشراءات.",
  },
  kpi1: {
    t: "المؤشرات",
    c: "المؤشرات: نسبة التوفر، المعدل بين عطب وعطب، معدل وقت التصليح، احترام الصيانة الوقائية، والكلفة حسب النوع وحسب المعدة.",
  },
  kpi2: {
    t: "الأكثر كلفة",
    c: "ونشوفو المعدات اللي كلفتنا أكثر، والبياسات اللي تستهلكت أكثر.",
  },
  audit: {
    t: "سجل المراجعة",
    c: "وكل حركة في التطبيقة تتسجل: شكون عمل شنوة، ووقتاش.",
  },
  mob1: {
    t: "على التليفون",
    c: "ونفس التطبيقة تخدم على التليفون والتابليت. وزيد فما تطبيقة موبايل للفنيين، تخدم حتى في الشانطي بلا كونكسيون.",
  },
  mob2: {
    t: "البلانينغ على التليفون",
    c: "البلانينغ نهار بنهار، وأوامر العمل في كروت ساهلين للقراية.",
  },
  outro: {
    t: "يعطيكم الصحة",
    c: "هذا كل شي! تطبيقة GMAO تعاونكم تنقصو الأعطال، تتحكمو في المصاريف، وما يفوتكم حتى أجل. يعطيكم الصحة!",
    v: "هذا كل شي! تطبيقة جي إم آ أو تعاونكم تنقصو الأعطال، تتحكمو في المصاريف، وما يفوتكم حتى أجل. يعطيكم الصحة!",
  },
};

/* ------------------------------------------------------------------ */
/* Voix : un fichier par phrase, régénéré seulement si le texte change    */
/* ------------------------------------------------------------------ */

function probeDuration(file) {
  const r = spawnSync(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" });
  return Number(r.stdout.trim());
}

const voice = {};
if (!DRY) {
  mkdirSync(VOICE_DIR, { recursive: true });
  for (const [id, line] of Object.entries(LINES)) {
    const text = line.v ?? line.c;
    const hash = createHash("sha1").update(`${VOICE}|${text}`).digest("hex").slice(0, 10);
    const file = path.join(VOICE_DIR, `${id}-${hash}.mp3`);
    if (!existsSync(file)) {
      const r = spawnSync(PYTHON, ["-m", "edge_tts", "--voice", VOICE, "--rate=+6%", "--text", text, "--write-media", file], { stdio: "inherit" });
      if (r.status !== 0) throw new Error(`Synthèse vocale en échec : ${id}`);
    }
    voice[id] = { file, duration: probeDuration(file) };
  }
  console.log(`Voix prêtes : ${Object.keys(voice).length} phrases.`);
}

/* ------------------------------------------------------------------ */
/* Outils de tournage                                                    */
/* ------------------------------------------------------------------ */

rmSync(RAW, { recursive: true, force: true });
mkdirSync(RAW, { recursive: true });

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
/** Phrases dites, avec l'instant (ms) depuis le début de la vidéo de la page. */
const timeline = [];
const startOf = new Map();

async function settle(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page
    .waitForFunction(() => [...document.querySelectorAll('[aria-busy="true"]')].every((el) => !el.checkVisibility()), null, { timeout: 15_000 })
    .catch(() => {});
  await pause(300);
}

/**
 * Repère de synchronisation : petit carré de couleur (rouge, vert, bleu à tour de rôle) dans le coin inférieur
 * droit, changé à chaque phrase. Il est retrouvé image par image pour caler la voix, puis masqué au montage.
 */
const SYNC_SIZE = 16;
const SYNC_COLORS = ["#ff0000", "#00ff00", "#0000ff"];

async function speak(page, id) {
  const color = timeline.length % SYNC_COLORS.length;
  await page.evaluate(
    ([background, size]) => {
      let marker = document.getElementById("demo-sync");
      if (!marker) {
        marker = document.createElement("div");
        marker.id = "demo-sync";
        marker.style.cssText = `position:fixed;right:0;bottom:0;width:${size}px;height:${size}px;z-index:2147483647;pointer-events:none`;
        document.documentElement.appendChild(marker);
      }
      marker.style.background = background;
    },
    [SYNC_COLORS[color], SYNC_SIZE],
  );
  timeline.push({ id, color, track: startOf.get(page).track, at: Date.now() - startOf.get(page).t0 });
  await pause(DRY ? 1200 : Math.round(voice[id].duration * 1000) + 450);
}

/** Sous-titre arabe en bas de l'écran (titre + phrase), puis voix. */
async function say(page, id) {
  await settle(page);
  const { t, c } = LINES[id];
  await page.evaluate(
    ([title, text]) => {
      let el = document.getElementById("demo-caption");
      if (!el) {
        el = document.createElement("div");
        el.id = "demo-caption";
        el.dir = "rtl";
        el.style.cssText =
          "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;width:min(1180px,94vw);" +
          "background:rgba(14,40,65,.95);color:#fff;border-radius:14px;padding:14px 24px;font:500 22px/1.55 'Segoe UI',Tahoma,sans-serif;" +
          "box-shadow:0 10px 30px rgba(0,0,0,.35);pointer-events:none;text-align:center";
        document.body.appendChild(el);
      }
      // Codes et noms latins isolés du sens de lecture arabe (CA-104, GMAO, PDF…).
      const isolated = text.replace(/([A-Z]{2}-\d{3}|GMAO|Démo BTP|PDF)/g, "<bdi>$1</bdi>");
      el.innerHTML = `<div style="font-size:16px;font-weight:700;color:#5eead4;margin-bottom:4px">${title}</div>${isolated}`;
    },
    [t, c],
  );
  await speak(page, id);
}

async function hideCaption(page) {
  await page.evaluate(() => document.getElementById("demo-caption")?.remove()).catch(() => {});
}

/** Écran de titre plein écran, avec une phrase lue (facultative). */
async function card(page, title, subtitle, id, ms = 2500) {
  await page.evaluate(
    ([t, s]) => {
      document.getElementById("demo-caption")?.remove();
      const el = document.createElement("div");
      el.id = "demo-card";
      el.dir = "rtl";
      el.style.cssText =
        "position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;" +
        "background:linear-gradient(135deg,#0e2841,#0f766e);color:#fff;font-family:'Segoe UI',Tahoma,sans-serif;text-align:center;padding:40px";
      el.innerHTML = `<div style="font-size:60px;font-weight:700">${t}</div><div style="margin-top:22px;font-size:28px;opacity:.92;max-width:1050px;line-height:1.6">${s}</div>`;
      document.body.appendChild(el);
    },
    [title, subtitle],
  );
  if (id) await speak(page, id);
  else await pause(ms);
  await page.evaluate(() => document.getElementById("demo-card")?.remove());
}

async function go(page, url) {
  await hideCaption(page);
  await page.goto(`${BASE}${url}`);
  await settle(page);
}

async function scroll(page, pixels, ms = 1400) {
  await page.mouse.wheel(0, pixels);
  await pause(ms);
}

async function scrollTo(locator) {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await locator.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "smooth" })).catch(() => {});
  await pause(900);
}

async function login(page, email, next = "/", typed = false) {
  await page.context().clearCookies();
  await page.goto(`${BASE}/login${next === "/" ? "" : `?next=${encodeURIComponent(next)}`}`);
  if (typed) {
    // Saisie visible : attendre que la page soit interactive, sinon les premiers caractères sont perdus.
    await settle(page);
    await pause(1200);
    await page.getByLabel("Courriel").click();
    await page.getByLabel("Courriel").pressSequentially(email, { delay: 45 });
    await page.getByLabel("Mot de passe").pressSequentially(PASSWORD, { delay: 45 });
  } else {
    await page.getByLabel("Courriel").fill(email);
    await page.getByLabel("Mot de passe").fill(PASSWORD);
  }
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
  await settle(page);
}

async function api(page, url) {
  const response = await page.request.get(`${BASE}${url}`);
  return (await response.json()).data;
}

async function equipmentId(page, code) {
  return (await api(page, `/api/v1/equipment?q=${code}`)).items.find((e) => e.code === code).id;
}

const section = (page, title) => page.locator("section", { has: page.getByRole("heading", { name: title, exact: true }) });

const failures = [];
/** Page filmée en cours (capture d'écran d'un chapitre en échec). */
let activePage = null;
async function chapter(name, fn) {
  try {
    await fn();
    console.log(`OK    ${name}`);
  } catch (error) {
    failures.push(name);
    console.log(`ÉCHEC ${name} : ${error.message.split("\n").slice(0, 3).join(" | ")}`);
    await activePage?.screenshot({ path: path.join(RAW, `echec-${failures.length}.png`) }).catch(() => {});
  }
}

const isoDay = (days) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

/* ------------------------------------------------------------------ */
/* Préparation hors caméra : comptage d'inventaire du magasinier (R-08)  */
/* ------------------------------------------------------------------ */

const browser = await chromium.launch({ slowMo: 90 });
{
  const prep = await (await browser.newContext({ locale: "fr-FR", timezoneId: "Europe/Paris" })).newPage();
  await login(prep, "magasin@demo.gmao", "/stock/inventaire");
  const parts = await api(prep, "/api/v1/parts?q=FLT-AIR-01");
  const filter = parts.items.find((p) => p.sku === "FLT-AIR-01");
  const detail = await api(prep, `/api/v1/parts/${filter.id}`);
  const warehouse = (await api(prep, "/api/v1/warehouses")).find((w) => w.name === "Magasin Lyon");
  const lyon = detail.levels.find((l) => l.warehouseId === warehouse.id);
  const form = prep.locator("form").filter({ has: prep.getByRole("button", { name: "Enregistrer le comptage" }) });
  await form.getByRole("combobox", { name: "Magasin" }).selectOption({ label: "Magasin Lyon — Dépôt Lyon" });
  await form.getByRole("combobox", { name: "Article" }).selectOption({ label: "FLT-AIR-01 — Filtre à air primaire (u)" });
  await form.getByLabel("Quantité comptée").fill(String(Math.max(0, Number(lyon.onHand) - 3)));
  await form.getByRole("button", { name: "Enregistrer le comptage" }).click();
  await prep.getByText(/écart de -3/).waitFor();
  await prep.context().close();
  console.log("Préparation : comptage d'inventaire enregistré par le magasinier.");
}

/* ------------------------------------------------------------------ */
/* Ordinateur : parcours du responsable maintenance                      */
/* ------------------------------------------------------------------ */

const desktop = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  locale: "fr-FR",
  timezoneId: "Europe/Paris",
  recordVideo: { dir: RAW, size: { width: 1440, height: 900 } },
});
const page = await desktop.newPage();
activePage = page;
startOf.set(page, { t0: Date.now(), track: "desktop" });
const desktopVideo = page.video();
page.setDefaultTimeout(20_000);
await page.goto(`${BASE}/login`);
await card(page, "GMAO", "جولة كاملة مع مسؤول الصيانة — مجموعة Démo BTP", "intro");

await chapter("Connexion et tableau de bord", async () => {
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`);
  await say(page, "login");
  await hideCaption(page);
  await login(page, MANAGER, "/", true);
  await say(page, "dash1");
  await scrollTo(page.getByRole("alert").filter({ hasText: "Assurances, visites techniques et vignettes" }));
  await say(page, "dash2");
  await scroll(page, 500);
  await say(page, "dash3");
});

await chapter("Parc et fiche équipement", async () => {
  await go(page, "/equipements");
  await say(page, "fleet1");
  await page.getByRole("combobox", { name: "Catégorie" }).selectOption({ label: "Camion porteur" });
  await page.getByRole("button", { name: "Filtrer" }).click();
  await say(page, "fleet2");
  await hideCaption(page);
  await page.getByRole("link", { name: "CA-101", exact: true }).first().click();
  await page.waitForURL(/\/equipements\/[0-9a-f-]{36}$/);
  await say(page, "eq1");
  await scrollTo(section(page, "Préventif"));
  await say(page, "eq2");
});

await chapter("Échéances administratives", async () => {
  const card = section(page, "Échéances administratives");
  await scrollTo(card);
  await say(page, "dl1");
  const insurance = card.getByRole("row").filter({ hasText: "POL-2025-0412" });
  await insurance.getByText("Renouveler", { exact: true }).click();
  await say(page, "dl2");
  await insurance.getByLabel("Nouvelle échéance").fill(isoDay(377));
  await insurance.getByLabel("Nouvelle référence").fill("POL-2026-0412");
  await insurance.getByLabel("Montant payé").fill("2850");
  await insurance.getByRole("button", { name: "Enregistrer le renouvellement" }).click();
  await card.getByText("Échéance renouvelée : la suivante est suivie.").waitFor();
  await scrollTo(card);
  await say(page, "dl3");
  await go(page, "/equipements/echeances?horizon=30");
  await say(page, "dl4");
  await scroll(page, 500);
});

await chapter("Notifications", async () => {
  await go(page, "/notifications");
  await say(page, "notif");
  await scroll(page, 500);
});

await chapter("Préventif", async () => {
  await go(page, "/preventif");
  await say(page, "prev1");
  await hideCaption(page);
  await page.getByRole("link", { name: "Chargeuse sur pneus — entretien périodique" }).click();
  await settle(page);
  await say(page, "prev2");
  await go(page, "/preventif/echeances");
  await say(page, "prev3");
  await page.getByRole("button", { name: "Générer les ordres de travail préventifs" }).click();
  await pause(1800);
});

await chapter("R-01 : entretien à échéance", async () => {
  const wos = (await api(page, "/api/v1/work-orders?pageSize=100&status=OPEN")).items;
  const wo = wos.find((w) => w.equipmentCode === "CH-012" && w.type === "PREVENTIVE");
  await go(page, `/ordres-de-travail/${wo.id}`);
  await say(page, "r1a");
  await hideCaption(page);
  await page.getByRole("button", { name: "Démarrer / reprendre" }).click();
  await page.getByText("Démarrer / reprendre : effectué.").waitFor();
  const checklist = section(page, "Checklist");
  await scrollTo(checklist);
  await say(page, "r1b");
  await hideCaption(page);
  for (let i = 1; i <= 6; i++) {
    const item = checklist.getByRole("listitem").filter({ hasText: new RegExp(`^${i}\\. `) });
    await item.getByRole("button", { name: "Conforme", exact: true }).click();
    await item
      .getByText("Point enregistré.")
      .waitFor({ timeout: 6000 })
      .catch(() => {});
    await pause(300);
  }
  const parts = section(page, "Pièces");
  await scrollTo(parts);
  for (const [label, quantity] of [
    ["FLT-HUI-01 — Filtre à huile moteur (u)", "1"],
    ["HUI-MOT-15W40 — Huile moteur 15W40 (L)", "32"],
  ]) {
    await parts.getByRole("combobox", { name: "Opération" }).selectOption({ label: "Sortir du stock (consommer)" });
    await parts.getByRole("combobox", { name: "Magasin" }).selectOption({ label: "Magasin Lyon — Dépôt Lyon" });
    await parts.getByRole("combobox", { name: "Article" }).selectOption({ label });
    await parts.getByRole("spinbutton", { name: "Quantité" }).fill(quantity);
    await parts.getByRole("button", { name: "Valider" }).click();
    await pause(1500);
  }
  await say(page, "r1c");
  await hideCaption(page);
  const times = section(page, "Temps passés");
  await scrollTo(times);
  await times.getByText("Saisir une durée").click();
  await times.getByRole("combobox", { name: "Technicien" }).selectOption({ label: "Julien Moreau" });
  await times.getByLabel("Durée (minutes)").fill("180");
  await times.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await page.getByText("Temps enregistré.").waitFor();
  const report = section(page, "Compte rendu");
  await scrollTo(report);
  const detail = await api(page, `/api/v1/work-orders/${wo.id}`);
  // Une heure après le relevé de prise de poste : +1 h reste vraisemblable (DON-02).
  await report.getByLabel("Relevé (h)").fill(String(Math.round(Number(detail.meters[0].lastValue) + 1)));
  await report.getByRole("button", { name: "Enregistrer le relevé" }).click();
  await page
    .getByText(/^Relevé enregistré/)
    .first()
    .waitFor();
  await report
    .getByLabel("Travaux réalisés")
    .fill("Vidange moteur, filtres à huile et à gazole remplacés, niveaux et graissage faits, pneus contrôlés.");
  await report.getByRole("button", { name: "Enregistrer le compte rendu" }).click();
  await page.getByText("Compte rendu enregistré.").waitFor();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await pause(800);
  await page.getByRole("button", { name: "Terminer les travaux" }).click();
  await page.getByText("Terminer les travaux : effectué.").waitFor();
  await say(page, "r1d");
  await hideCaption(page);
  await page.getByLabel("Essais de remise en service conformes").check();
  await page.getByRole("button", { name: "Valider la remise en service" }).click();
  await page.getByText("Valider la remise en service : effectué.").waitFor();
  await scrollTo(section(page, "Coûts"));
  await say(page, "r1e");
  await hideCaption(page);
  await page.getByRole("link", { name: "Fiche à signer" }).click();
  await page.waitForURL(/impression/);
  await say(page, "r1f");
  await scroll(page, 800, 1800);
});

await chapter("R-02 : panne signalée, qualifiée, planifiée", async () => {
  await go(page, "/demandes");
  await say(page, "r2a");
  const requests = (await api(page, "/api/v1/work-requests?pageSize=50")).items;
  const di = requests.find((r) => r.equipmentCode === "CA-104" && r.status === "NEW");
  await go(page, `/demandes/${di.id}`);
  await page.getByRole("combobox", { name: "Priorité" }).selectOption({ label: "P2 · Haute" });
  await page.getByLabel("Immobiliser l'équipement").check();
  await say(page, "r2b");
  await hideCaption(page);
  await page.getByRole("button", { name: "Qualifier" }).click();
  await page.getByText("Demande qualifiée.").waitFor();
  await page.getByRole("button", { name: "Transformer en ordre de travail" }).click();
  await page.waitForURL(/\/ordres-de-travail\/[0-9a-f-]{36}$/);
  await say(page, "r2c");
  const planning = section(page, "Planification");
  await scrollTo(planning);
  await planning.getByLabel("Début prévu").fill(`${isoDay(1)}T08:00`);
  await planning.getByLabel("Durée estimée (minutes)").fill("120");
  await planning.getByLabel("Samir Kaci").check();
  await say(page, "r2d");
  await hideCaption(page);
  await planning.getByRole("button", { name: "Enregistrer la planification" }).click();
  await page.getByText("Planification enregistrée.").waitFor();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await page.getByRole("button", { name: "Planifier", exact: true }).click();
  await page.getByText("Planifier : effectué.").waitFor();
  await say(page, "r2e");
});

await chapter("R-03 : rupture de pièce", async () => {
  const wos = (await api(page, "/api/v1/work-orders?q=CE-031&pageSize=10")).items;
  const wo = wos.find((w) => String(w.title).startsWith("Pompe hydraulique défaillante"));
  const url = `/ordres-de-travail/${wo.id}`;
  await go(page, url);
  await say(page, "r3a");
  const reserve = async () => {
    const parts = section(page, "Pièces");
    await scrollTo(parts);
    await parts.getByRole("combobox", { name: "Opération" }).selectOption({ label: "Réserver" });
    await parts.getByRole("combobox", { name: "Magasin" }).selectOption({ label: "Magasin Lyon — Dépôt Lyon" });
    await parts.getByRole("combobox", { name: "Article" }).selectOption({ label: "POMPE-HYD-TOY — Pompe hydraulique chariot 8FBE (u)" });
    await parts.getByRole("spinbutton", { name: "Quantité" }).fill("1");
    await parts.getByRole("button", { name: "Valider" }).click();
    await pause(1500);
  };
  await hideCaption(page);
  await reserve();
  await say(page, "r3b");
  await go(page, "/stock/mouvements");
  const move = page.locator("form").filter({ has: page.getByRole("button", { name: "Enregistrer le mouvement" }) });
  await move.getByRole("combobox", { name: "Type de mouvement" }).selectOption({ label: "Transfert entre magasins" });
  await move.getByRole("combobox", { name: "Article" }).selectOption({ label: "POMPE-HYD-TOY — Pompe hydraulique chariot 8FBE (u)" });
  await move.getByRole("combobox", { name: "Magasin", exact: true }).selectOption({ label: "Magasin Marseille — Agence Marseille" });
  await move.getByRole("spinbutton", { name: "Quantité" }).fill("1");
  await move.getByRole("combobox", { name: "Magasin de destination" }).selectOption({ label: "Magasin Lyon — Dépôt Lyon" });
  await say(page, "r3c");
  await hideCaption(page);
  await move.getByRole("button", { name: "Enregistrer le mouvement" }).click();
  await pause(1800);
  await go(page, url);
  await reserve();
  await say(page, "r3d");
  const approval = section(page, "Validation des dépenses");
  await scrollTo(approval);
  await approval.getByLabel("Commentaire").fill("Accord : chariot indispensable au quai de chargement.");
  await say(page, "r3e");
  await hideCaption(page);
  await approval.getByRole("button", { name: "Valider", exact: true }).click();
  await pause(2000);
});

await chapter("R-05 : compteur remplacé", async () => {
  await go(page, `/equipements/${await equipmentId(page, "PE-002")}`);
  await scrollTo(page.getByRole("row").filter({ hasText: "Remplacement de compteur" }));
  await say(page, "r4");
});

await chapter("R-06 : contrôle réglementaire échu", async () => {
  await go(page, `/equipements/${await equipmentId(page, "CE-020")}`);
  await say(page, "r5a");
  await hideCaption(page);
  const assignment = section(page, "Affectation");
  await scrollTo(assignment);
  await assignment.getByText("Nouvelle affectation").click();
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Affecter" }) });
  await form.getByRole("combobox", { name: "Chantier" }).selectOption({ index: 1 });
  await form.getByRole("button", { name: "Affecter" }).click();
  await page.getByText("Un équipement immobilisé ou réformé ne peut pas être affecté.").waitFor();
  await say(page, "r5b");
});

await chapter("Planning", async () => {
  await go(page, "/planning");
  await say(page, "plan");
  await scroll(page, 600);
});

await chapter("Stock et R-08 : inventaire", async () => {
  await go(page, "/stock");
  await say(page, "stock1");
  await go(page, "/stock/inventaire");
  await scrollTo(page.getByRole("heading", { name: /Écarts à valider/ }));
  await say(page, "r6a");
  await hideCaption(page);
  await page.locator("li").filter({ hasText: "FLT-AIR-01" }).getByRole("button", { name: "Valider l'écart" }).click();
  await page.getByText("Écart validé : stock ajusté.").waitFor();
  await say(page, "r6b");
});

await chapter("Demande d'achat", async () => {
  await go(page, "/demandes-achat/nouvelle");
  await page.getByLabel("Objet de la demande").fill("Jeu de filtres hydrauliques");
  await page.getByRole("spinbutton", { name: "Quantité" }).fill("4");
  await page.getByLabel("Prix unitaire estimé (€)").fill("96");
  await page.getByRole("combobox", { name: "Équipement" }).selectOption({ label: "CH-012 — Chargeuse sur pneus 950M" });
  await say(page, "da1");
  await hideCaption(page);
  await page.getByRole("button", { name: "Soumettre la demande" }).click();
  await page.waitForURL(/\/demandes-achat\/[0-9a-f-]{36}/);
  await pause(1800);
});

await chapter("Indicateurs et journal", async () => {
  await go(page, "/indicateurs");
  await say(page, "kpi1");
  await scrollTo(page.getByRole("heading", { name: "Équipements les plus coûteux" }));
  await say(page, "kpi2");
  await go(page, "/administration/journal");
  await say(page, "audit");
});

await hideCaption(page);
await page.goto(`${BASE}/`);
await card(page, "على التليفون", "نفس التطبيقة، على الشاشات الصغيرة", null, 2500);
await desktop.close();

/* ------------------------------------------------------------------ */
/* Téléphone                                                             */
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
activePage = mobile;
startOf.set(mobile, { t0: Date.now(), track: "phone" });
const phoneVideo = mobile.video();
mobile.setDefaultTimeout(20_000);
await chapter("Téléphone", async () => {
  await login(mobile, MANAGER);
  await say(mobile, "mob1");
  await scroll(mobile, 600, 1200);
  await go(mobile, "/planning");
  await say(mobile, "mob2");
  await scroll(mobile, 500, 1200);
  await go(mobile, "/ordres-de-travail");
  await scroll(mobile, 600, 1200);
  await card(mobile, "GMAO", "الصيانة متاع المعدات، الكراهب والآلات", "outro");
});
await phone.close();
await browser.close();

writeFileSync(path.join(RAW, "timeline.json"), JSON.stringify(timeline, null, 2));
if (failures.length) console.log(`Chapitres en échec : ${failures.join(", ")}`);

/* ------------------------------------------------------------------ */
/* Assemblage : image (ordinateur puis téléphone) et voix calée          */
/* ------------------------------------------------------------------ */

const parts = [await desktopVideo.path(), await phoneVideo.path()];

/** Instants (ms, à 25 images/s) où chaque repère de couleur apparaît dans la vidéo d'une piste. */
function detectOnsets(file, width, height, entries) {
  const r = spawnSync(
    FFMPEG,
    ["-v", "error", "-i", file, "-vf", `fps=25,crop=8:8:${width - 12}:${height - 12}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"],
    { maxBuffer: 1 << 30 },
  );
  const frameBytes = 8 * 8 * 3;
  const colorOf = (offset) => {
    let [red, green, blue] = [0, 0, 0];
    for (let i = 0; i < frameBytes; i += 3) {
      red += r.stdout[offset + i];
      green += r.stdout[offset + i + 1];
      blue += r.stdout[offset + i + 2];
    }
    const [cr, cg, cb] = [red, green, blue].map((v) => v / 64);
    if (cr > 170 && cg < 90 && cb < 90) return 0;
    if (cg > 170 && cr < 90 && cb < 90) return 1;
    if (cb > 170 && cr < 90 && cg < 90) return 2;
    return -1;
  };
  let frame = 0;
  const frames = Math.floor(r.stdout.length / frameBytes);
  return entries.map((entry) => {
    while (frame < frames && colorOf(frame * frameBytes) !== entry.color) frame++;
    if (frame >= frames) return null;
    return Math.round((frame * 1000) / 25);
  });
}

const desktopMs = Math.round(probeDuration(parts[0]) * 1000);
{
  for (const [track, file, width, height, base] of [
    ["desktop", parts[0], 1440, 900, 0],
    ["phone", parts[1], 390, 844, desktopMs],
  ]) {
    const entries = timeline.filter((e) => e.track === track);
    const onsets = detectOnsets(file, width, height, entries);
    entries.forEach((entry, i) => {
      entry.video = onsets[i] === null ? entry.at + base : onsets[i] + base;
      if (onsets[i] === null) console.log(`Repère introuvable : ${entry.id} (heure de tournage utilisée)`);
    });
    const drifts = entries.filter((_, i) => onsets[i] !== null).map((e, i) => e.video - base - e.at);
    if (drifts.length)
      console.log(`Piste ${track} : ${drifts.length}/${entries.length} repères, décalage ${Math.min(...drifts)} à ${Math.max(...drifts)} ms`);
  }
  writeFileSync(path.join(RAW, "timeline.json"), JSON.stringify(timeline, null, 2));
}
const output = path.join(OUT, DRY ? "gmao-demo-ar-essai.mp4" : "gmao-demo-ar.mp4");
const args = ["-y", "-i", parts[0], "-i", parts[1]];
let filter =
  `[0:v]drawbox=x=iw-${SYNC_SIZE}:y=ih-${SYNC_SIZE}:w=${SYNC_SIZE}:h=${SYNC_SIZE}:color=0xf8fafc:t=fill,scale=1440:900,setsar=1,fps=25[a];` +
  `[1:v]drawbox=x=iw-${SYNC_SIZE}:y=ih-${SYNC_SIZE}:w=${SYNC_SIZE}:h=${SYNC_SIZE}:color=0xffffff:t=fill,` +
  "scale=-2:880:flags=lanczos,pad=1440:900:(ow-iw)/2:(oh-ih)/2:color=0x0e2841,setsar=1,fps=25[b];" +
  "[a][b]concat=n=2:v=1:a=0[v]";
const maps = ["-map", "[v]"];
if (!DRY) {
  timeline.forEach((entry, i) => {
    args.push("-i", voice[entry.id].file);
    const at = Math.max(0, entry.video);
    filter += `;[${i + 2}:a]aresample=44100,adelay=${at}:all=1[s${i}]`;
  });
  filter += `;${timeline.map((_, i) => `[s${i}]`).join("")}amix=inputs=${timeline.length}:normalize=0:dropout_transition=0[voice]`;
  maps.push("-map", "[voice]", "-c:a", "aac", "-b:a", "160k");
}
args.push(
  "-filter_complex",
  filter,
  ...maps,
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
);
const result = spawnSync(FFMPEG, args, { stdio: "inherit" });
if (result.status !== 0) throw new Error("Assemblage ffmpeg en échec.");
console.log(`Vidéo : ${output}`);
