-- Rôles : « Administrateur » = administrateur de la plateforme. Dans les organisations clientes ouvertes
-- par la plateforme (contact renseigné), le premier compte devient « Direction » (tous les droits de son
-- organisation, sans droit sur la plateforme).
UPDATE "role_assignments" SET "role" = 'EXECUTIVE'
WHERE "role" = 'ADMIN'
  AND "tenant_id" IN (SELECT "id" FROM "tenants" WHERE "contact_email" IS NOT NULL);
