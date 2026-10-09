# GMAO — application mobile (Expo, React Native)

Application des techniciens, chefs d'atelier, conducteurs et magasiniers (CDC §10, MOB-01 à MOB-09). Elle utilise l'**API REST v1** de la GMAO : mêmes services, mêmes droits et mêmes périmètres que l'application web.

## Fonctions

| Fonction | Profils (droits) | Hors connexion |
| --- | --- | --- |
| Mes OT : liste des OT affectés (technicien) ou ouverts (chef d'atelier) | `workorder.read` | Consultation de la dernière liste |
| Fiche OT : démarrer, checklist (OK / NOK / N/A, mesures), diagnostic et compte rendu, temps passé, pièces consommées, relevé du compteur, photos, travaux terminés | `workorder.execute` (pièces : `stock.move`) | Toutes les saisies |
| Équipements : recherche, fiche (compteur, échéances, dernières interventions), relevé, signalement de panne | `equipment.read`, `meter.write`, `request.create` | Consultation, relevé, signalement |
| Échéances de maintenance (pré-alerte, échues, en retard) | `plan.read` | Consultation |
| Scanner : QR code de l'étiquette → fiche équipement ; code inconnu signalé sans bloquer | `equipment.read` | Équipements déjà consultés |
| Synchro : état, saisies en attente, saisies refusées à relancer ou abandonner, déconnexion | tous | — |

Les onglets suivent les droits renvoyés par `GET /api/v1/me` : un conducteur ne voit pas les OT à exécuter.

## Hors connexion et synchronisation (MOB-07 à MOB-09)

- Chaque saisie est enregistrée sur l'appareil avec un identifiant unique (`clientId`) et l'heure du terminal. Le serveur ignore un envoi déjà reçu : une synchronisation coupée puis relancée ne crée aucun doublon.
- Envoi dans l'ordre de saisie, **photos en dernier**. La synchronisation part au retour du réseau, après chaque saisie quand le réseau est là, et à la demande (onglet Synchro).
- **Réseau absent ou serveur indisponible (5xx)** : arrêt sans rien perdre, reprise plus tard.
- **Refus du serveur** (droit, règle métier, stock insuffisant…) : la saisie passe « à revoir » avec le motif ; l'utilisateur la relance ou l'abandonne, elle n'est jamais supprimée d'office.
- **Transition déjà appliquée** (réponse perdue pendant une coupure) : reconnue et considérée comme réussie.
- Le bandeau en haut de l'écran indique en permanence la connexion, la dernière synchronisation et le nombre de saisies en attente (§10.3).
- Photos compressées avant envoi (1 920 px, JPEG qualité 0,7).

Le cœur (client d'API, file de synchronisation, lecture des QR codes) est en TypeScript sans dépendance React Native : `src/lib/api.ts`, `src/lib/sync.ts`, `src/lib/qr.ts`. Ses tests tournent avec ceux du serveur (`npm test` à la racine).

## Sécurité du terminal (MOB-13)

- Jeton de session dans le trousseau chiffré du système (`expo-secure-store` : Keychain iOS, Keystore Android).
- Données de consultation et file des saisies dans le stockage privé de l'application ; les données de consultation sont effacées à la déconnexion (les saisies non envoyées sont conservées et l'utilisateur en est averti).
- Production : HTTPS obligatoire.
- Restent à faire : chiffrement du cache local, réouverture par code ou biométrie, durée maximale hors connexion, effacement à distance (§10.5).

## Configuration

Créer `mobile/.env` à partir de `mobile/.env.example` :

| Variable | Rôle |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | Adresse du serveur GMAO. Émulateur Android : `http://10.0.2.2:3000` ; téléphone sur le même réseau Wi-Fi : `http://<adresse IP du poste>:3000` ; production : `https://…` |

Le serveur doit être joignable depuis le téléphone (`npm run dev -- -H 0.0.0.0` pour écouter sur le réseau local en développement).

## Commandes

```bash
cd mobile
npm install
npx expo start            # QR code à scanner avec Expo Go, ou émulateur (touches a / i)
npm run typecheck         # TypeScript
npm run doctor            # expo-doctor : dépendances et configuration
```

Vérification de la synchronisation contre un serveur réel (depuis la racine, démonstration chargée, serveur démarré) :

```bash
AUTH_ORIGIN=http://localhost:3000 npx tsx mobile/scripts/verify-sync.ts http://localhost:3000
```

Le script saisit une intervention complète hors connexion, coupe le réseau pendant l'envoi, reprend, renvoie les mêmes saisies en double et vérifie qu'aucun doublon n'est créé et que l'OT passe à « Travaux terminés ».

## Construction des applications

Expo Go suffit en développement (caméra, photos, stockage sécurisé sont inclus). Pour distribuer : EAS Build (`npx eas-cli@latest build --platform android|ios`), avec `EXPO_PUBLIC_API_URL` de production. Identifiants d'application : `fr.gmao.mobile` (à adapter).
