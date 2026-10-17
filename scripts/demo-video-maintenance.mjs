/**
 * Vidéo de démonstration du responsable maintenance (resp.maintenance@demo.gmao) sur le jeu de démonstration
 * du Groupe Démo BTP : parcours complet, voix off, sous-titres et curseur visible sur chaque action.
 * Langue : `DEMO_LANG=fr` (par défaut, voix fr-FR-DeniseNeural) ou `DEMO_LANG=ar` (derja tunisienne, ar-TN-ReemNeural).
 *
 * Prérequis : `npm run db:reset`, `npm run worker -- --once` (notifications), `npm run build`,
 * puis `npx next start -p 3100` ; Python avec `edge-tts` et ffmpeg.
 * Lancement : `node scripts/demo-video-maintenance.mjs` (sortie : docs/demo-video/gmao-demo-<langue>.mp4).
 * `DRY=1` : tournage sans voix (pauses fixes), pour vérifier le parcours.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.env.DEMO_URL ?? "http://localhost:3100";
const OUT = path.resolve("docs/demo-video");
const LANG = process.env.DEMO_LANG === "ar" ? "ar" : "fr";
const RTL = LANG === "ar";
const RAW = path.join(OUT, `brut-${LANG}`);
const VOICE_DIR = path.join(OUT, `voix-${LANG}`);
const PASSWORD = "Demo-Gmao-2026";
const MANAGER = "resp.maintenance@demo.gmao";
const VOICE = process.env.VOICE ?? (RTL ? "ar-TN-ReemNeural" : "fr-FR-DeniseNeural");
const RATE = RTL ? "+6%" : "+4%";
const DRY = process.env.DRY === "1";
const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const FFPROBE = process.env.FFPROBE ?? "ffprobe";
const PYTHON = process.env.PYTHON ?? "python";

/* ------------------------------------------------------------------ */
/* Narration : titre, sous-titre affiché (c) et texte lu (v, si différent) */
/* ------------------------------------------------------------------ */

const LINES_AR = {
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

const LINES_FR = {
  intro: {
    t: "Visite complète",
    c: "Bonjour ! Dans cette vidéo, nous faisons le tour complet de GMAO avec Karim, responsable maintenance du Groupe Démo BTP : le parc d'engins et de véhicules, le préventif, les pannes, les pièces et les coûts, le tout au même endroit.",
  },
  login: {
    t: "Connexion",
    c: "On commence par la connexion : Karim saisit son courriel et son mot de passe. Il peut aussi protéger son compte par un code de vérification sur son téléphone.",
  },
  dash1: {
    t: "Tableau de bord",
    c: "Voici le tableau de bord. D'un coup d'œil, Karim voit les engins immobilisés, en maintenance et disponibles, les demandes à qualifier, les ordres de travail ouverts et le coût du mois.",
  },
  dash2: {
    t: "Alertes administratives",
    c: "Ce bandeau rouge l'alerte sur les assurances, visites techniques et vignettes qui arrivent à échéance ou sont dépassées.",
  },
  dash3: {
    t: "Suivi au quotidien",
    c: "Plus bas, les ordres de travail classés par priorité, et les échéances préventives à traiter.",
  },
  fleet1: {
    t: "Le parc",
    c: "La liste des équipements : vingt-six engins et véhicules, camions, pelles, chargeuses, compacteurs, chariots, groupes électrogènes et utilitaires, répartis sur trois sites.",
  },
  fleet2: {
    t: "Recherche et filtres",
    c: "On recherche par code ou par immatriculation, ou on filtre par état, site, catégorie et criticité. Ici, uniquement les camions.",
  },
  eq1: {
    t: "Fiche équipement",
    c: "Ouvrons la fiche du camion CA-101 : son compteur kilométrique et l'historique complet des relevés.",
  },
  eq2: {
    t: "Préventif et interventions",
    c: "Plus bas, son préventif, l'entretien tous les trente mille kilomètres ou chaque année et le contrôle technique annuel, puis les interventions passées avec leur coût.",
  },
  dl1: {
    t: "Assurance, visite technique, vignette",
    c: "Voici les échéances administratives : assurance, visite technique et vignette. Le responsable du parc est alerté dans l'application et par courriel à trente jours, à sept jours, le jour même, puis chaque semaine de retard.",
  },
  dl2: {
    t: "Renouveler l'assurance",
    c: "L'assurance de ce camion expire dans douze jours. On la renouvelle : nouvelle date d'échéance, numéro de police et montant payé.",
  },
  dl3: {
    t: "Assurance renouvelée",
    c: "C'est fait : la nouvelle assurance est suivie, et l'ancienne reste dans l'historique.",
  },
  dl4: {
    t: "Échéances de tout le parc",
    c: "Cette page regroupe les échéances de tout le parc, de la plus proche à la plus lointaine : ce qui est dépassé, et ce qui est à renouveler dans les trente jours.",
  },
  notif: {
    t: "Notifications",
    c: "Les notifications arrivent dans l'application et par courriel : vidanges et changements de filtres, assurances, visites techniques, pannes urgentes. Chacun ne reçoit que ce qui concerne son périmètre.",
  },
  prev1: {
    t: "Plans d'entretien",
    c: "Le préventif : chaque catégorie d'équipement a son plan d'entretien, à la date ou au compteur, en heures ou en kilomètres.",
  },
  prev2: {
    t: "Exemple : vidange et filtres",
    c: "Par exemple pour les chargeuses : vidange, filtre à huile et filtre à gazole toutes les deux cent cinquante heures ou tous les trois mois, au premier seuil atteint.",
  },
  prev3: {
    t: "Échéances préventives",
    c: "La liste des échéances : à venir, en pré-alerte, échues et en retard. En un clic, l'application génère les ordres de travail manquants, sans jamais créer de doublon.",
  },
  r1a: {
    t: "Scénario 1 : entretien à échéance",
    c: "Scénario 1 : un entretien arrivé à échéance. L'ordre de travail de la chargeuse CH-012 est planifié avec Julien. Karim démarre l'intervention.",
  },
  r1b: {
    t: "Checklist",
    c: "On renseigne la checklist : vidange, filtres, niveaux, graissage et pneus. Chaque point obligatoire doit être renseigné.",
  },
  r1c: {
    t: "Pièces, temps et compteur",
    c: "On sort les pièces du magasin, le filtre à huile et l'huile moteur, puis on saisit le temps passé, le relevé du compteur et le compte rendu.",
  },
  r1d: {
    t: "Fin des travaux",
    c: "Les travaux sont terminés : l'application a vérifié qu'il ne manquait ni compte rendu, ni checklist, ni compteur, ni temps passé.",
  },
  r1e: {
    t: "Remise en service",
    c: "Essais conformes : l'engin est remis en service. Les coûts sont calculés automatiquement, main-d'œuvre, pièces et prestataire, et l'échéance suivante est recalculée.",
  },
  r1f: {
    t: "Fiche d'intervention",
    c: "Et voici la fiche d'intervention à signer, avec le logo de l'entreprise, à imprimer ou à enregistrer en PDF.",
  },
  r2a: {
    t: "Scénario 2 : panne",
    c: "Scénario 2 : une panne. Le conducteur ou le technicien envoie une demande d'intervention depuis son téléphone ou un ordinateur. Karim retrouve ici toutes les nouvelles demandes.",
  },
  r2b: {
    t: "Qualification",
    c: "Une demande sur le camion CA-104 : un grincement au freinage. Karim lui donne une priorité haute et immobilise le camion jusqu'à la réparation.",
  },
  r2c: {
    t: "De la demande à l'ordre de travail",
    c: "En un clic, la demande devient un ordre de travail, avec l'équipement, le symptôme et la priorité.",
  },
  r2d: {
    t: "Planification",
    c: "On le planifie demain matin avec Samir, technicien à Marseille. Une absence bloque la planification, et un chevauchement est signalé.",
  },
  r2e: {
    t: "Planifié",
    c: "L'ordre de travail est planifié, et Samir reçoit une notification.",
  },
  r3a: {
    t: "Scénario 3 : pièce manquante",
    c: "Scénario 3 : une pièce manquante. Le chariot CE-031 est immobilisé, en attente d'une pompe hydraulique.",
  },
  r3b: {
    t: "Réservation impossible",
    c: "On tente de réserver la pompe au magasin de Lyon : l'application refuse, il n'y en a pas. Mais il en reste une au magasin de Marseille.",
  },
  r3c: {
    t: "Transfert entre magasins",
    c: "On fait un transfert de Marseille vers Lyon. Le stock ne peut jamais devenir négatif.",
  },
  r3d: {
    t: "Réservation",
    c: "La réservation passe maintenant : la pompe est réservée pour cet ordre de travail.",
  },
  r3e: {
    t: "Validation de la dépense",
    c: "La location d'un chariot de remplacement, mille quatre cent cinquante euros, dépasse le seuil : elle doit être validée par le responsable maintenance. Karim valide, et la décision est tracée.",
  },
  r4: {
    t: "Scénario 4 : compteur remplacé",
    c: "Scénario 4 : le compteur de la pelle PE-002 a été remplacé. L'application conserve les heures cumulées, pour que le préventif reste juste.",
  },
  r5a: {
    t: "Scénario 5 : contrôle réglementaire",
    c: "Scénario 5 : le contrôle réglementaire du chariot CE-020 est dépassé. Le chariot a été immobilisé automatiquement.",
  },
  r5b: {
    t: "Affectation refusée",
    c: "On essaie de l'affecter à un chantier : c'est refusé. Il ne sera remis en service qu'avec le rapport de contrôle joint.",
  },
  plan: {
    t: "Planning",
    c: "Le planning de la semaine : la charge de chaque technicien jour par jour, les absences, et les interventions à planifier.",
  },
  stock1: {
    t: "Stocks",
    c: "Les stocks : les pièces de chaque magasin, les quantités réservées, et les articles sous le point de commande.",
  },
  r6a: {
    t: "Scénario 6 : inventaire",
    c: "Scénario 6 : l'inventaire. Le magasinier a compté un écart sur les filtres à air. L'écart est important : il doit être validé.",
  },
  r6b: {
    t: "Validation de l'écart",
    c: "Karim valide : le stock est ajusté au coût moyen, et tout est tracé.",
  },
  da1: {
    t: "Demande d'achat",
    c: "Une demande d'achat : Karim commande des filtres hydrauliques pour une chargeuse, et la demande suit le circuit de validation des achats.",
  },
  kpi1: {
    t: "Indicateurs",
    c: "Les indicateurs : disponibilité, temps moyen entre pannes, temps moyen de réparation, respect du préventif, et coûts par catégorie et par équipement.",
  },
  kpi2: {
    t: "Les plus coûteux",
    c: "On voit aussi les équipements les plus coûteux et les pièces les plus consommées.",
  },
  audit: {
    t: "Journal d'audit",
    c: "Et chaque action est enregistrée dans le journal d'audit : qui a fait quoi, et quand.",
  },
  mob1: {
    t: "Sur téléphone",
    c: "La même application fonctionne sur téléphone et sur tablette. Et l'application mobile des techniciens fonctionne même sur chantier, sans connexion.",
  },
  mob2: {
    t: "Planning sur téléphone",
    c: "Le planning jour par jour, et les ordres de travail en cartes faciles à lire.",
  },
  outro: {
    t: "Merci",
    c: "C'est terminé ! GMAO vous aide à réduire les pannes, à maîtriser vos coûts et à ne manquer aucune échéance. Merci de votre attention.",
  },
};

const LINES = RTL ? LINES_AR : LINES_FR;

/** Écrans de titre. */
const CARDS = RTL
  ? {
      intro: "جولة كاملة مع مسؤول الصيانة — مجموعة Démo BTP",
      phoneTitle: "على التليفون",
      phone: "نفس التطبيقة، على الشاشات الصغيرة",
      outro: "الصيانة متاع المعدات، الكراهب والآلات",
    }
  : {
      intro: "Visite complète avec le responsable maintenance — Groupe Démo BTP",
      phoneTitle: "Sur téléphone",
      phone: "La même application, sur petit écran",
      outro: "Maintenance des engins, véhicules et équipements",
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
      const r = spawnSync(PYTHON, ["-m", "edge_tts", "--voice", VOICE, `--rate=${RATE}`, "--text", text, "--write-media", file], {
        stdio: "inherit",
      });
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
    ([title, text, rtl]) => {
      let el = document.getElementById("demo-caption");
      if (!el) {
        el = document.createElement("div");
        el.id = "demo-caption";
        el.dir = rtl ? "rtl" : "ltr";
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
    [t, c, RTL],
  );
  await speak(page, id);
}

async function hideCaption(page) {
  await page.evaluate(() => document.getElementById("demo-caption")?.remove()).catch(() => {});
}

/** Écran de titre plein écran, avec une phrase lue (facultative). */
async function card(page, title, subtitle, id, ms = 2500) {
  await page.evaluate(
    ([t, s, rtl]) => {
      document.getElementById("demo-caption")?.remove();
      const el = document.createElement("div");
      el.id = "demo-card";
      el.dir = rtl ? "rtl" : "ltr";
      el.style.cssText =
        "position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;" +
        "background:linear-gradient(135deg,#0e2841,#0f766e);color:#fff;font-family:'Segoe UI',Tahoma,sans-serif;text-align:center;padding:40px";
      el.innerHTML = `<div style="font-size:60px;font-weight:700">${t}</div><div style="margin-top:22px;font-size:28px;opacity:.92;max-width:1050px;line-height:1.6">${s}</div>`;
      document.body.appendChild(el);
    },
    [title, subtitle, RTL],
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
    await click(page.getByLabel("Courriel"));
    await page.getByLabel("Courriel").pressSequentially(email, { delay: 45 });
    await click(page.getByLabel("Mot de passe"));
    await page.getByLabel("Mot de passe").pressSequentially(PASSWORD, { delay: 45 });
  } else {
    await page.getByLabel("Courriel").fill(email);
    await page.getByLabel("Mot de passe").fill(PASSWORD);
  }
  if (typed) await click(page.getByRole("button", { name: "Se connecter" }));
  else await page.getByRole("button", { name: "Se connecter" }).click();
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

/* ------------------------------------------------------------------ */
/* Curseur visible : flèche qui suit la souris, halo sur l'élément visé, onde au clic */
/* ------------------------------------------------------------------ */

/** Injecté dans chaque page filmée (Playwright n'enregistre pas le pointeur système). */
function installCursor() {
  const place = (x, y) => {
    const cursor = document.getElementById("demo-cursor");
    if (cursor) cursor.style.transform = `translate(${x - 3}px, ${y - 2}px)`;
  };
  const install = () => {
    if (document.getElementById("demo-cursor")) return;
    const cursor = document.createElement("div");
    cursor.id = "demo-cursor";
    cursor.innerHTML =
      '<svg width="30" height="30" viewBox="0 0 24 24"><path d="M4 2v18l5-5 3.6 7.2 3.1-1.5-3.6-7.2H19z" fill="#111827" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    cursor.style.cssText = "position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))";
    document.documentElement.appendChild(cursor);
    let saved = { x: 720, y: 450 };
    try {
      saved = JSON.parse(sessionStorage.getItem("demo-cursor") ?? "") ?? saved;
    } catch {}
    place(saved.x, saved.y);
  };
  document.addEventListener(
    "mousemove",
    (event) => {
      place(event.clientX, event.clientY);
      try {
        sessionStorage.setItem("demo-cursor", JSON.stringify({ x: event.clientX, y: event.clientY }));
      } catch {}
    },
    true,
  );
  document.addEventListener(
    "mousedown",
    (event) => {
      const ring = document.createElement("div");
      ring.style.cssText =
        `position:fixed;left:${event.clientX - 22}px;top:${event.clientY - 22}px;width:44px;height:44px;border-radius:50%;` +
        "border:3px solid #f59e0b;background:rgba(245,158,11,.25);z-index:2147483646;pointer-events:none";
      document.documentElement.appendChild(ring);
      ring.animate(
        [
          { transform: "scale(.4)", opacity: 1 },
          { transform: "scale(1.6)", opacity: 0 },
        ],
        { duration: 650, easing: "ease-out" },
      ).onfinish = () => ring.remove();
    },
    true,
  );
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();
}

/** Amène le curseur sur l'élément (déplacement progressif) et l'entoure d'un halo : l'action est visible. */
async function point(locator) {
  const target = locator.first();
  await target.scrollIntoViewIfNeeded().catch(() => {});
  const box = await target.boundingBox();
  if (!box) return;
  const page = target.page();
  await page.mouse.move(box.x + Math.min(box.width / 2, 60), box.y + box.height / 2, { steps: 22 });
  await target
    .evaluate((el) => {
      const r = el.getBoundingClientRect();
      const halo = document.createElement("div");
      halo.style.cssText =
        `position:fixed;left:${r.left - 5}px;top:${r.top - 5}px;width:${r.width + 10}px;height:${r.height + 10}px;` +
        "border:3px solid #f59e0b;border-radius:10px;box-shadow:0 0 0 6px rgba(245,158,11,.18);z-index:2147483645;pointer-events:none";
      document.documentElement.appendChild(halo);
      halo.animate([{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 1500 }).onfinish = () =>
        halo.remove();
    })
    .catch(() => {});
  await pause(450);
}

async function click(locator) {
  await point(locator);
  await locator.click();
}

async function fill(locator, value) {
  await point(locator);
  await locator.fill(value);
}

async function select(locator, option) {
  await point(locator);
  await locator.selectOption(option);
}

async function check(locator) {
  await point(locator);
  await locator.check();
}

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
await desktop.addInitScript(installCursor);
const page = await desktop.newPage();
activePage = page;
startOf.set(page, { t0: Date.now(), track: "desktop" });
const desktopVideo = page.video();
page.setDefaultTimeout(20_000);
await page.goto(`${BASE}/login`);
await card(page, "GMAO", CARDS.intro, "intro");

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
  await select(page.getByRole("combobox", { name: "Catégorie" }), { label: "Camion porteur" });
  await click(page.getByRole("button", { name: "Filtrer" }));
  await say(page, "fleet2");
  await hideCaption(page);
  await click(page.getByRole("link", { name: "CA-101", exact: true }).first());
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
  await click(insurance.getByText("Renouveler", { exact: true }));
  await say(page, "dl2");
  await fill(insurance.getByLabel("Nouvelle échéance"), isoDay(377));
  await fill(insurance.getByLabel("Nouvelle référence"), "POL-2026-0412");
  await fill(insurance.getByLabel("Montant payé"), "2850");
  await click(insurance.getByRole("button", { name: "Enregistrer le renouvellement" }));
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
  await click(page.getByRole("link", { name: "Chargeuse sur pneus — entretien périodique" }));
  await settle(page);
  await say(page, "prev2");
  await go(page, "/preventif/echeances");
  await say(page, "prev3");
  await click(page.getByRole("button", { name: "Générer les ordres de travail préventifs" }));
  await pause(1800);
});

await chapter("R-01 : entretien à échéance", async () => {
  const wos = (await api(page, "/api/v1/work-orders?pageSize=100&status=OPEN")).items;
  const wo = wos.find((w) => w.equipmentCode === "CH-012" && w.type === "PREVENTIVE");
  await go(page, `/ordres-de-travail/${wo.id}`);
  await say(page, "r1a");
  await hideCaption(page);
  await click(page.getByRole("button", { name: "Démarrer / reprendre" }));
  await page.getByText("Démarrer / reprendre : effectué.").waitFor();
  const checklist = section(page, "Checklist");
  await scrollTo(checklist);
  await say(page, "r1b");
  await hideCaption(page);
  for (let i = 1; i <= 6; i++) {
    const item = checklist.getByRole("listitem").filter({ hasText: new RegExp(`^${i}\\. `) });
    await click(item.getByRole("button", { name: "Conforme", exact: true }));
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
    await select(parts.getByRole("combobox", { name: "Opération" }), { label: "Sortir du stock (consommer)" });
    await select(parts.getByRole("combobox", { name: "Magasin" }), { label: "Magasin Lyon — Dépôt Lyon" });
    await select(parts.getByRole("combobox", { name: "Article" }), { label });
    await fill(parts.getByRole("spinbutton", { name: "Quantité" }), quantity);
    await click(parts.getByRole("button", { name: "Valider" }));
    await pause(1500);
  }
  await say(page, "r1c");
  await hideCaption(page);
  const times = section(page, "Temps passés");
  await scrollTo(times);
  await click(times.getByText("Saisir une durée"));
  await select(times.getByRole("combobox", { name: "Technicien" }), { label: "Julien Moreau" });
  await fill(times.getByLabel("Durée (minutes)"), "180");
  await click(times.getByRole("button", { name: "Enregistrer", exact: true }));
  await page.getByText("Temps enregistré.").waitFor();
  const report = section(page, "Compte rendu");
  await scrollTo(report);
  const detail = await api(page, `/api/v1/work-orders/${wo.id}`);
  // Une heure après le relevé de prise de poste : +1 h reste vraisemblable (DON-02).
  await fill(report.getByLabel("Relevé (h)"), String(Math.round(Number(detail.meters[0].lastValue) + 1)));
  await click(report.getByRole("button", { name: "Enregistrer le relevé" }));
  await page
    .getByText(/^Relevé enregistré/)
    .first()
    .waitFor();
  await fill(
    report.getByLabel("Travaux réalisés"),
    "Vidange moteur, filtres à huile et à gazole remplacés, niveaux et graissage faits, pneus contrôlés.",
  );
  await click(report.getByRole("button", { name: "Enregistrer le compte rendu" }));
  await page.getByText("Compte rendu enregistré.").waitFor();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await pause(800);
  await click(page.getByRole("button", { name: "Terminer les travaux" }));
  await page.getByText("Terminer les travaux : effectué.").waitFor();
  await say(page, "r1d");
  await hideCaption(page);
  await check(page.getByLabel("Essais de remise en service conformes"));
  await click(page.getByRole("button", { name: "Valider la remise en service" }));
  await page.getByText("Valider la remise en service : effectué.").waitFor();
  await scrollTo(section(page, "Coûts"));
  await say(page, "r1e");
  await hideCaption(page);
  await click(page.getByRole("link", { name: "Fiche à signer" }));
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
  await select(page.getByRole("combobox", { name: "Priorité" }), { label: "P2 · Haute" });
  await check(page.getByLabel("Immobiliser l'équipement"));
  await say(page, "r2b");
  await hideCaption(page);
  await click(page.getByRole("button", { name: "Qualifier" }));
  await page.getByText("Demande qualifiée.").waitFor();
  await click(page.getByRole("button", { name: "Transformer en ordre de travail" }));
  await page.waitForURL(/\/ordres-de-travail\/[0-9a-f-]{36}$/);
  await say(page, "r2c");
  const planning = section(page, "Planification");
  await scrollTo(planning);
  await fill(planning.getByLabel("Début prévu"), `${isoDay(1)}T08:00`);
  await fill(planning.getByLabel("Durée estimée (minutes)"), "120");
  await check(planning.getByLabel("Samir Kaci"));
  await say(page, "r2d");
  await hideCaption(page);
  await click(planning.getByRole("button", { name: "Enregistrer la planification" }));
  await page.getByText("Planification enregistrée.").waitFor();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await click(page.getByRole("button", { name: "Planifier", exact: true }));
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
    await select(parts.getByRole("combobox", { name: "Opération" }), { label: "Réserver" });
    await select(parts.getByRole("combobox", { name: "Magasin" }), { label: "Magasin Lyon — Dépôt Lyon" });
    await select(parts.getByRole("combobox", { name: "Article" }), { label: "POMPE-HYD-TOY — Pompe hydraulique chariot 8FBE (u)" });
    await fill(parts.getByRole("spinbutton", { name: "Quantité" }), "1");
    await click(parts.getByRole("button", { name: "Valider" }));
    await pause(1500);
  };
  await hideCaption(page);
  await reserve();
  await say(page, "r3b");
  await go(page, "/stock/mouvements");
  const move = page.locator("form").filter({ has: page.getByRole("button", { name: "Enregistrer le mouvement" }) });
  await select(move.getByRole("combobox", { name: "Type de mouvement" }), { label: "Transfert entre magasins" });
  await select(move.getByRole("combobox", { name: "Article" }), { label: "POMPE-HYD-TOY — Pompe hydraulique chariot 8FBE (u)" });
  await select(move.getByRole("combobox", { name: "Magasin", exact: true }), { label: "Magasin Marseille — Agence Marseille" });
  await fill(move.getByRole("spinbutton", { name: "Quantité" }), "1");
  await select(move.getByRole("combobox", { name: "Magasin de destination" }), { label: "Magasin Lyon — Dépôt Lyon" });
  await say(page, "r3c");
  await hideCaption(page);
  await click(move.getByRole("button", { name: "Enregistrer le mouvement" }));
  await pause(1800);
  await go(page, url);
  await reserve();
  await say(page, "r3d");
  const approval = section(page, "Validation des dépenses");
  await scrollTo(approval);
  await fill(approval.getByLabel("Commentaire"), "Accord : chariot indispensable au quai de chargement.");
  await say(page, "r3e");
  await hideCaption(page);
  await click(approval.getByRole("button", { name: "Valider", exact: true }));
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
  await click(assignment.getByText("Nouvelle affectation"));
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Affecter" }) });
  await select(form.getByRole("combobox", { name: "Chantier" }), { index: 1 });
  await click(form.getByRole("button", { name: "Affecter" }));
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
  await click(page.locator("li").filter({ hasText: "FLT-AIR-01" }).getByRole("button", { name: "Valider l'écart" }));
  await page.getByText("Écart validé : stock ajusté.").waitFor();
  await say(page, "r6b");
});

await chapter("Demande d'achat", async () => {
  await go(page, "/demandes-achat/nouvelle");
  await fill(page.getByLabel("Objet de la demande"), "Jeu de filtres hydrauliques");
  await fill(page.getByRole("spinbutton", { name: "Quantité" }), "4");
  await fill(page.getByLabel("Prix unitaire estimé (€)"), "96");
  await select(page.getByRole("combobox", { name: "Équipement" }), { label: "CH-012 — Chargeuse sur pneus 950M" });
  await say(page, "da1");
  await hideCaption(page);
  await click(page.getByRole("button", { name: "Soumettre la demande" }));
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
await card(page, CARDS.phoneTitle, CARDS.phone, null, 2500);
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
  await card(mobile, "GMAO", CARDS.outro, "outro");
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
const output = path.join(OUT, DRY ? `gmao-demo-${LANG}-essai.mp4` : `gmao-demo-${LANG}.mp4`);
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
