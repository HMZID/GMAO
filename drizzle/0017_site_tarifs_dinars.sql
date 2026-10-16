-- Tarifs du site commercial en dinars tunisiens, sur devis selon la taille du parc (GMAO-39).
-- Données seulement : les offres encore en euros passent « sur devis » ; une offre déjà modifiée sans euros est conservée.
UPDATE "site_plans"
SET
  "price_monthly" = NULL,
  "price_unit" = 'Sur devis',
  "price_note" = CASE "name"
    WHEN 'Atelier' THEN 'En dinars tunisiens, selon la taille du parc · dès 10 équipements'
    WHEN 'Flotte' THEN 'En dinars tunisiens, selon la taille du parc · dès 20 équipements'
    ELSE 'En dinars tunisiens, selon la taille du parc'
  END,
  "cta_label" = CASE WHEN "cta_label" LIKE 'Essayer l''offre %' THEN 'Demander un devis ' || "name" ELSE "cta_label" END
WHERE "price_unit" LIKE '%€%';
--> statement-breakpoint
UPDATE "site_plans"
SET "price_note" = 'En dinars tunisiens · au-delà de 200 équipements ou plusieurs sociétés'
WHERE "price_note" = 'Au-delà de 200 équipements ou plusieurs sociétés';
--> statement-breakpoint
UPDATE "site_items" SET "meta" = 'DT' WHERE "kind" = 'HIGHLIGHT' AND "meta" = '€';
