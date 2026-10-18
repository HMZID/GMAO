# Couche MCP (préparation des évolutions IA)

La GMAO expose un serveur **MCP** (Model Context Protocol) : un assistant IA (Claude ou tout client compatible) consulte les données de l'organisation et peut créer une demande d'intervention, avec les mêmes services, droits et périmètres que l'application.

- Adresse : `https://<adresse de l'application>/api/mcp`
- Transport : « Streamable HTTP » sans état (POST JSON-RPC 2.0, réponse JSON). Versions du protocole : 2025-06-18, 2025-03-26, 2024-11-05.
- Authentification : clé d'API du connecteur (`Authorization: Bearer gmk_…`), de préférence au niveau **Assistant IA (MCP)** (lecture et signalement de pannes). Une clé « Lecture et export » donne un assistant en lecture seule.
- Sécurité : origine du navigateur contrôlée (protection contre le « DNS rebinding »), erreurs internes jamais détaillées, actions tracées au journal d'audit (canal API, au nom du créateur de la clé).

## Brancher un client

Claude Code :

```bash
claude mcp add --transport http gmao https://gmao-eight-alpha.vercel.app/api/mcp --header "Authorization: Bearer gmk_…"
```

Autres clients : déclarer un serveur MCP « HTTP » avec l'adresse ci-dessus et l'en-tête `Authorization`.

## Outils

| Outil | Rôle | Écriture |
| --- | --- | --- |
| `get_organization` | Organisation et appelant | Non |
| `search_equipment` | Recherche d'équipements (code, désignation, marque, statut) | Non |
| `get_equipment` | Fiche d'un équipement (identifiant ou code parc) | Non |
| `list_work_orders` / `get_work_order` | Interventions à réaliser et leur détail | Non |
| `list_work_requests` | Demandes d'intervention | Non |
| `create_work_request` | Créer une demande d'intervention (à confirmer par l'utilisateur) | Oui |
| `list_due_items` | Échéances préventives et réglementaires | Non |
| `get_maintenance_kpis` | Disponibilité, MTBF, MTTR, coûts | Non |
| `list_custom_indicators` | Indicateurs personnalisés de l'organisation | Non |
| `export_dataset` | Lignes d'un jeu de données (paginées, incrémentales) | Non |

Ajouter un outil : `src/server/mcp/tools.ts` (schéma Zod d'entrée, appel d'un service existant). Le protocole est dans `src/server/mcp/protocol.ts` (testé).
