# Design : agent designer et compétence ui-ux-pro-max

Le design de l'application web, du site commercial et de l'application mobile est confié à l'agent **designer**
(`.claude/agents/designer.md`), qui utilise la compétence **ui-ux-pro-max**
(https://github.com/nextlevelbuilder/ui-ux-pro-max-skill, installée dans `~/.claude/skills/ui-ux-pro-max`) :
styles, palettes, polices, règles d'ergonomie et d'accessibilité, graphiques, piles techniques.

- **Appel** : demander « le designer » (agent `designer`) pour toute tâche qui change l'apparence ou l'ergonomie, y
  compris une refonte complète.
- **Méthode d'une refonte** : système de design d'abord (jetons, typographie, composants de base), puis un module par
  branche `GMAO-NN` vers `develop`, vérifiée en français, anglais, arabe (droite à gauche) et en 375 px.
- **Garde-fous** : aucune règle métier touchée ; textes traduits ; formulaires et accessibilité (GMAO-57) conservés ;
  noms accessibles inchangés pour les tests e2e. Détail dans la définition de l'agent.
