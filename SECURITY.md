# Sécurité

## Signaler une vulnérabilité

Merci de ne pas ouvrir de ticket public. Utiliser le signalement privé de GitHub :
**Security → Report a vulnerability** sur ce dépôt. Le signalement n'est visible que des responsables du projet.

Indiquer la version concernée (`/api/health` donne la version en ligne), les étapes pour reproduire et l'impact
estimé. Un accusé de réception est envoyé sous 3 jours ouvrés ; la correction suit le flux habituel
(branche de tâche, recette, mise en production après approbation).

## Versions maintenues

Seule la version en production (branche `main`) reçoit des correctifs de sécurité.

## Mesures en place

Résumé dans `docs/exploitation-production.md` (section « Sécurité ») : double authentification obligatoire pour
l'administrateur de la plateforme, mots de passe compromis refusés, limitation des tentatives de connexion,
en-têtes de sécurité, contrôles de droits et de périmètre dans chaque service, journal d'audit, secrets jamais
affichés dans les journaux de la CI, sauvegarde de la base avant chaque mise en production.
