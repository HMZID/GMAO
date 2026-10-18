#!/usr/bin/env bash
# Contrôle de la configuration Vercel de production (portée Production), avant toute mise en production.
#
# Lit par l'API Vercel les noms et portées des variables du projet, jamais leurs valeurs (le dépôt est public,
# ses journaux aussi), puis :
# - erreur si une variable indispensable manque, ou si une variable de base ou d'authentification est partagée
#   avec la recette (portée Preview) ;
# - avertissement pour chaque variable recommandée absente, avec sa conséquence ;
# - avertissement si une variable réservée à la recette est déclarée en production.
#
# Entrées (environnement) : VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID.
# MODE=report : n'échoue jamais (contrôle informatif du « Pipeline développement ») ; sinon bloquant.
set -euo pipefail

REQUIRED=(DATABASE_URL BETTER_AUTH_SECRET)
# Variable recommandée|conséquence si absente.
ADVISED=(
  "BETTER_AUTH_URL|adresse publique déduite de Vercel (domaine de production) ; à fixer avec le domaine définitif"
  "CRON_SECRET|la tâche planifiée quotidienne (préventif, alertes, envoi des courriels) est refusée"
  "DATABASE_URL_UNPOOLED|les migrations passent par la connexion mutualisée (moins sûr pour les verrous)"
  "PLATFORM_ADMIN_EMAILS|aucun administrateur de la plateforme n'est désigné par la configuration"
  "SMTP_HOST|aucun courriel ne part (alertes, accès de démonstration, mots de passe)"
  "SMTP_USER|aucun courriel ne part si le serveur exige une authentification"
  "SMTP_PASSWORD|aucun courriel ne part si le serveur exige une authentification"
  "MAIL_FROM|adresse d'expédition par défaut, souvent refusée par les serveurs de courriel"
  "TURNSTILE_SITE_KEY|pas de protection anti-robot sur la connexion et le formulaire de démonstration"
  "TURNSTILE_SECRET_KEY|pas de protection anti-robot sur la connexion et le formulaire de démonstration"
)
RECETTE_ONLY=(PREVIEW_MIGRATIONS SEED_DEMO_DATA)
NOT_SHARED=(DATABASE_URL DATABASE_URL_UNPOOLED BETTER_AUTH_SECRET BETTER_AUTH_URL CRON_SECRET)

errors=0
error() {
  echo "::error::$1"
  errors=$((errors + 1))
}

team=""
case "$VERCEL_ORG_ID" in team_*) team="teamId=$VERCEL_ORG_ID" ;; esac
response=$(curl -sS -w $'\n%{http_code}' -H "Authorization: Bearer $VERCEL_TOKEN" "https://api.vercel.com/v9/projects/$VERCEL_PROJECT_ID/env?$team")
code=${response##*$'\n'}
if [ "$code" != "200" ]; then
  echo "::error::Lecture des variables Vercel impossible (HTTP $code) : vérifier VERCEL_TOKEN et VERCEL_PROJECT_ID."
  [ "${MODE:-}" = "report" ] && exit 0
  exit 1
fi
# Noms et portées seulement, gardés en mémoire.
ENVS=$(jq -c '{envs: [.envs[] | {key, target}]}' <<<"${response%$'\n'*}")
has_production() { jq -e --arg k "$1" '[.envs[] | select(.key == $k and (.target | index("production")))] | length > 0' <<<"$ENVS" >/dev/null; }
shared() { jq -e --arg k "$1" '[.envs[] | select(.key == $k and (.target | index("preview")) and (.target | index("production")))] | length > 0' <<<"$ENVS" >/dev/null; }

for key in "${REQUIRED[@]}"; do
  has_production "$key" || error "Variable de production manquante : $key (Vercel → Settings → Environment Variables, portée Production)."
done
for key in "${NOT_SHARED[@]}"; do
  shared "$key" && error "$key est partagée entre Production et Preview : la recette doit avoir sa propre valeur."
done
for entry in "${ADVISED[@]}"; do
  key=${entry%%|*}
  has_production "$key" || echo "::warning::Variable de production recommandée absente : $key — ${entry#*|}."
done
for key in "${RECETTE_ONLY[@]}"; do
  has_production "$key" && echo "::warning::$key est déclarée en production : réservée à la recette, la retirer de la portée Production."
done

if [ "$errors" -gt 0 ]; then
  echo "Configuration de production : $errors erreur(s)."
  [ "${MODE:-}" = "report" ] && exit 0
  exit 1
fi
echo "Configuration de production : variables indispensables présentes."
