# Langues : français, anglais, arabe

Le site commercial, l'application web et l'application mobile existent en français (langue source), en anglais et en
arabe (écriture de droite à gauche). Le code et la base restent en anglais ; les textes écrits dans le code sont en
français et servent de clé de traduction.

## Web

- **Choix de la langue** : sélecteur dans l'en-tête (site, connexion, menu utilisateur), cookie `gmao-locale`
  (`fr`, `en`, `ar`) ; connecté, la langue est aussi gardée sur le compte (`user.locale`) pour les courriels.
  `<html lang dir>` est posé avant l'affichage par un petit script (`LOCALE_BOOTSTRAP_SCRIPT`).
- **Textes** : `<T>Texte</T>` (composants serveur et client), `<Tr>{libellé}</Tr>` pour un libellé reçu en
  propriété, `useT()` / `await getT()` pour une chaîne. Un texte absent du dictionnaire s'affiche en français.
  Valeurs variables : `<T params={{ n }}>{"{n} équipement(s)"}</T>` ou le gabarit `tpl\`Réformé le ${date}\``
  (clé `Réformé le {1}`) ; `tx("Assurance")` marque une valeur de gabarit qui est elle-même un libellé à traduire ;
  `tplParts([...])` range plusieurs phrases dans un seul texte.
- **Dictionnaires** : `src/i18n/dictionaries/en.json` et `ar.json`. Le test `src/i18n/__tests__/dictionaries.test.ts`
  refuse un texte du code sans traduction, une valeur vide ou un paramètre perdu. Ajouter un texte : l'écrire en
  français dans le code, lancer `npm test`, compléter les deux fichiers.
- **Dates, nombres, montants** : `src/lib/format.ts` lit la langue de la requête (`src/i18n/request-locale.ts`,
  renseignée par `getLocale`) ; chiffres latins en arabe (usage tunisien).
- **Notifications** enregistrées en base : écrites avec `tpl` / `tx`, traduites à l'affichage dans la langue du lecteur.
- **Courriels** : rédigés à la mise en file dans la langue du destinataire (`user.locale`, ou `demo_requests.locale`
  pour un prospect). Contenu en `tpl` ; `renderEmail(…, { locale })` traduit et ajoute `lang` / `dir` au HTML.
- **Attributs** `aria-label`, `placeholder`, `title` : traduits dans le document par `AttributeTranslator`
  (sans effet en français : les noms accessibles testés restent ceux du français).
- **Poids** : le dictionnaire part avec le document seulement ; les navigations (flux RSC) ne le répètent pas.
- **Arabe** : propriétés CSS logiques (`ms-`, `pe-`, `text-start`…), icônes de direction `.rtl-flip`, police Noto Sans Arabic.

## Mobile (Expo)

`mobile/src/i18n` : langue choisie dans « Synchro » ou à la connexion, mémorisée sur l'appareil (sinon langue de
l'appareil). Les composants de base (`Card`, `Button`, `Field`, `Badge`, `Message`) traduisent leurs libellés ;
ailleurs `const t = useT(); t("Texte {n}", { n })`. Dictionnaires : `mobile/src/i18n/dictionaries.ts`, vérifiés par
`mobile/src/i18n/__tests__/dictionaries.test.ts` (couverture, paramètres, aucun texte JSX en dur). Passer à l'arabe,
ou le quitter, demande de redémarrer l'application (limite de React Native pour le sens d'écriture).

## À savoir

- Les messages d'erreur renvoyés par l'API sont en français : ceux de l'application web sont traduits par leur texte
  exact, ceux qui ne sont pas au dictionnaire restent en français.
- La relecture de l'arabe par un locuteur natif reste à faire avant une mise en production grand public.
