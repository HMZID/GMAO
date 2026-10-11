# Connecteur de l'organisation (API et ETL)

Chaque organisation branche ses outils (ETL, entrepôt de données, Power BI, scripts) sur la GMAO par une **clé d'API**, sans compte personnel.

## Clés d'API

**Administration → Connecteur (API et ETL)** (administrateur) :

| Accès | Droits |
| --- | --- |
| Lecture et export | Lecture de toutes les données, export, indicateurs |
| Lecture, export et import | En plus : imports (équipements, articles, stocks initiaux, fournisseurs, ouvriers) |

- La clé (`gmk_…`) n'est affichée **qu'une fois**, à sa création ; seule son empreinte SHA-256 est enregistrée.
- Validité : 30 jours, 90 jours, 1 an ou sans échéance. Révocation immédiate depuis la liste.
- Une clé ne donne jamais accès au paramétrage ni aux comptes. Elle est refusée si elle est révoquée, expirée, ou si son créateur est désactivé.
- Ses actions sont tracées au journal d'audit au nom de son créateur, canal « API ».

## Requêtes

En-tête : `Authorization: Bearer gmk_…` (ou `X-Api-Key: gmk_…`). Réponses JSON `{ "data": … }`, dates ISO 8601 en UTC.

| Besoin | Requête |
| --- | --- |
| Jeux de données disponibles | `GET /api/v1/exports` |
| Classeur complet | `GET /api/v1/exports?format=xlsx` |
| Fichier d'un jeu de données | `GET /api/v1/exports/{dataset}?format=csv` (ou `xlsx`) |
| Extraction paginée | `GET /api/v1/exports/{dataset}?limit=1000&offset=0` |
| Extraction incrémentale | `GET /api/v1/exports/{dataset}?updatedSince=2026-01-01T00:00:00Z` |
| Indicateurs personnalisés | `GET /api/v1/indicators` |
| Import | `GET /api/v1/imports/templates/{kind}`, `POST /api/v1/imports` (multipart `kind`, `file`), `POST /api/v1/imports/{id}/execute` `{"mode":"VALID_ONLY"}`, `GET /api/v1/imports/{id}/report` |

Jeux de données : `equipment`, `work-orders`, `work-requests`, `meter-readings`, `suppliers`, `technicians`, `parts`, `stock-levels`, `stock-movements`.

### Extraction incrémentale

1. Noter l'heure de début de l'extraction.
2. Lire `GET /api/v1/exports/{dataset}?updatedSince=<heure de la dernière extraction>&limit=1000&offset=0`.
3. Tant que `data.page.next` n'est pas nul, relire avec `offset=data.page.next`.
4. Conserver l'heure notée en 1 comme prochain `updatedSince`.

Les lignes sont triées par date de modification puis par identifiant : la pagination est stable. La colonne `id` (UUID) sert de clé de fusion côté entrepôt.

### CSV

Séparateur virgule, fins de ligne CRLF, UTF-8 avec BOM, en-têtes = clés des colonnes (stables), codes d'énumération (`CLOSED`, `P1`…) plutôt que libellés, booléens `true` / `false`. Une cellule de texte commençant par `=`, `+`, `-` ou `@` est préfixée d'une apostrophe (protection contre l'injection de formules).

Catalogue complet des points d'entrée et de leurs schémas : `GET /api/v1`.
