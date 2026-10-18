-- GMAO-45 : l'« ordre de travail (OT) » devient l'« intervention à réaliser » ; numéros INT-SOCIÉTÉ-ANNÉE-NNNNN.
-- Compteurs repris (aucun numéro réutilisé), numéros existants et textes qui les recopient mis à jour.
UPDATE "sequences" SET "kind" = 'INT' WHERE "kind" = 'OT';
--> statement-breakpoint
UPDATE "work_orders" SET "number" = 'INT' || substr("number", 3) WHERE "number" LIKE 'OT-%';
--> statement-breakpoint
UPDATE "approval_requests" SET "label" = regexp_replace("label", '\mOT-', 'INT-', 'g') WHERE "label" ~ '\mOT-';
--> statement-breakpoint
UPDATE "equipment_status_history"
SET "reason" = regexp_replace(
  replace(replace(replace("reason", 'Ordre de travail OT-', 'Intervention INT-'), 'ordre de travail OT-', 'intervention INT-'), 'l''ordre de travail', 'l''intervention'),
  '\mOT-', 'INT-', 'g')
WHERE "reason" ~ '(OT-|ordre de travail)';
--> statement-breakpoint
UPDATE "notifications"
SET "title" = regexp_replace("title", '\mOT-', 'INT-', 'g'), "body" = regexp_replace("body", '\mOT-', 'INT-', 'g')
WHERE "title" ~ '\mOT-' OR "body" ~ '\mOT-';
--> statement-breakpoint
-- Site commercial : contenu déjà enregistré (les textes par défaut sont modifiés dans le code).
UPDATE "site_items"
SET "title" = replace(replace(replace("title", 'Ordres de travail', 'Interventions à réaliser'), 'ordres de travail', 'interventions'), 'ordre de travail', 'intervention'),
  "body" = replace(replace(replace(replace(replace("body", 'premiers ordres de travail clôturés', 'premières interventions clôturées'), 'Ordres de travail', 'Interventions à réaliser'), 'ordres de travail', 'interventions'), 'l''ordre de travail', 'l''intervention'), 'ordre de travail', 'intervention')
WHERE "title" ILIKE '%ordre% de travail%' OR "body" ILIKE '%ordre% de travail%';
--> statement-breakpoint
UPDATE "site_pages"
SET "title" = replace(replace("title", 'Ordres de travail', 'Interventions à réaliser'), 'ordres de travail', 'interventions'),
  "summary" = replace(replace(replace("summary", 'Ordres de travail', 'Interventions à réaliser'), 'ordres de travail', 'interventions'), 'ordre de travail', 'intervention'),
  "body" = replace(replace(replace(replace("body", 'Ordres de travail', 'Interventions à réaliser'), 'ordres de travail', 'interventions'), 'l''ordre de travail', 'l''intervention'), 'ordre de travail', 'intervention')
WHERE "title" ILIKE '%ordre% de travail%' OR "summary" ILIKE '%ordre% de travail%' OR "body" ILIKE '%ordre% de travail%';
--> statement-breakpoint
UPDATE "site_plans"
SET "features" = replace(replace(replace("features", 'Ordres de travail', 'Interventions à réaliser'), 'ordres de travail', 'interventions'), 'ordre de travail', 'intervention'),
  "tagline" = replace(replace("tagline", 'Ordres de travail', 'Interventions à réaliser'), 'ordres de travail', 'interventions')
WHERE "features" ILIKE '%ordre% de travail%' OR "tagline" ILIKE '%ordre% de travail%';
--> statement-breakpoint
UPDATE "site_settings"
SET "value" = replace(replace(replace("value", 'Ordres de travail', 'Interventions à réaliser'), 'ordres de travail', 'interventions'), 'ordre de travail', 'intervention')
WHERE "value" ILIKE '%ordre% de travail%';
