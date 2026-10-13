#!/usr/bin/env bash
# Variables Vercel de l'environnement de développement (portée Preview), pour le « Pipeline développement ».
#
# 1. Lit par l'API Vercel les noms et portées des variables du projet (jamais les valeurs).
# 2. Refuse toute variable de base ou d'authentification partagée entre Production et Preview.
# 3. Crée les variables Preview manquantes, si NEON_API_KEY et NEON_PROJECT_ID sont fournis :
#    adresses de la base de développement lues dans Neon (branche NEON_DEV_BRANCH, base NEON_DEV_DATABASE,
#    jamais la branche par défaut de Neon), secret d'authentification généré ici, valeurs fixes de la recette.
#    Aucune valeur n'est affichée : le dépôt est public, ses journaux aussi.
# 4. Vérifie que les variables obligatoires existent.
#
# Entrées (environnement) : VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID, DEVELOP_ALIAS ; facultatives :
# NEON_API_KEY, NEON_PROJECT_ID, NEON_DEV_BRANCH (develop), NEON_DEV_DATABASE (gmao_dev),
# NEON_DEV_ROLE (neondb_owner), DEVELOP_PLATFORM_ADMIN_EMAILS.
set -euo pipefail

REQUIRED=(DATABASE_URL BETTER_AUTH_SECRET BETTER_AUTH_URL PREVIEW_MIGRATIONS)
ADVISED=(DATABASE_URL_UNPOOLED SEED_DEMO_DATA PLATFORM_ADMIN_EMAILS)
NOT_SHARED=(DATABASE_URL DATABASE_URL_UNPOOLED BETTER_AUTH_SECRET BETTER_AUTH_URL)

team=""
case "$VERCEL_ORG_ID" in team_*) team="teamId=$VERCEL_ORG_ID" ;; esac
ENVS=""

# Noms et portées des variables, gardés en mémoire (aucun fichier temporaire).
load_envs() {
  local response code
  response=$(curl -sS -w $'\n%{http_code}' -H "Authorization: Bearer $VERCEL_TOKEN" \
    "https://api.vercel.com/v9/projects/$VERCEL_PROJECT_ID/env?$team")
  code=${response##*$'\n'}
  if [ "$code" != "200" ]; then
    echo "::error::Lecture des variables Vercel impossible (HTTP $code) : vérifier VERCEL_TOKEN et VERCEL_PROJECT_ID."
    exit 1
  fi
  ENVS=$(jq -c '{envs: [.envs[] | {key, target}]}' <<<"${response%$'\n'*}")
}
has_preview() { jq -e --arg k "$1" '[.envs[] | select(.key == $k and (.target | index("preview")))] | length > 0' <<<"$ENVS" >/dev/null; }
shared() { jq -e --arg k "$1" '[.envs[] | select(.key == $k and (.target | index("preview")) and (.target | index("production")))] | length > 0' <<<"$ENVS" >/dev/null; }

# Variable chiffrée, portée Preview seulement. La valeur est masquée dans le journal avant tout usage.
set_preview() {
  local key="$1" value="$2" code
  echo "::add-mask::$value"
  code=$(jq -n --arg k "$key" --arg v "$value" '{key: $k, value: $v, type: "encrypted", target: ["preview"]}' |
    curl -sS -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer $VERCEL_TOKEN" -H "Content-Type: application/json" \
      --data-binary @- "https://api.vercel.com/v10/projects/$VERCEL_PROJECT_ID/env?upsert=true&$team")
  case "$code" in 200 | 201) echo "Variable Preview créée : $key" ;; *)
    echo "::error::Création de la variable Preview $key impossible (HTTP $code)."
    exit 1
    ;;
  esac
}

neon() { curl -sS -f -H "Authorization: Bearer $NEON_API_KEY" -H "Accept: application/json" "https://console.neon.tech/api/v2/projects/$NEON_PROJECT_ID/$1"; }

# Adresse de connexion de la base de développement dans NEON_URI ; jamais la branche par défaut (production).
# Pas de sous-shell : une erreur arrête le script au lieu de finir dans la valeur d'une variable.
neon_uri() {
  local pooled="$1" branches branch_id is_default response
  if ! branches=$(neon "branches"); then
    echo "::error::Lecture des branches Neon impossible : vérifier NEON_API_KEY et NEON_PROJECT_ID."
    exit 1
  fi
  branch_id=$(jq -r --arg n "$NEON_DEV_BRANCH" '.branches[] | select(.name == $n) | .id' <<<"$branches")
  is_default=$(jq -r --arg n "$NEON_DEV_BRANCH" '.branches[] | select(.name == $n) | .default' <<<"$branches")
  if [ -z "$branch_id" ]; then echo "::error::Branche Neon « $NEON_DEV_BRANCH » introuvable."; exit 1; fi
  if [ "$is_default" = "true" ]; then echo "::error::La branche Neon « $NEON_DEV_BRANCH » est la branche par défaut (production) : refusé."; exit 1; fi
  if ! response=$(neon "connection_uri?branch_id=$branch_id&database_name=$NEON_DEV_DATABASE&role_name=$NEON_DEV_ROLE&pooled=$pooled"); then
    echo "::error::Adresse de la base « $NEON_DEV_DATABASE » introuvable dans la branche « $NEON_DEV_BRANCH »."
    exit 1
  fi
  NEON_URI=$(jq -r '.uri // empty' <<<"$response")
  if [ -z "$NEON_URI" ]; then echo "::error::Réponse Neon sans adresse de connexion."; exit 1; fi
  # Même forme que la production : sans channel_binding (docs/deploiement-vercel.md).
  NEON_URI=$(sed -E 's/[&?]channel_binding=require//' <<<"$NEON_URI")
}

load_envs

errors=0
for key in "${NOT_SHARED[@]}"; do
  if shared "$key"; then
    echo "::error::$key est déclarée à la fois pour Production et Preview : séparer les deux (Vercel → Settings → Environment Variables)."
    errors=1
  fi
done
[ "$errors" = 0 ] || exit 1

missing=()
for key in "${REQUIRED[@]}" "${ADVISED[@]}"; do has_preview "$key" || missing+=("$key"); done

if [ "${#missing[@]}" -gt 0 ] && [ -n "${NEON_API_KEY:-}" ] && [ -n "${NEON_PROJECT_ID:-}" ]; then
  NEON_DEV_BRANCH=${NEON_DEV_BRANCH:-develop}
  NEON_DEV_DATABASE=${NEON_DEV_DATABASE:-gmao_dev}
  NEON_DEV_ROLE=${NEON_DEV_ROLE:-neondb_owner}
  for key in "${missing[@]}"; do
    case "$key" in
      DATABASE_URL) neon_uri true && set_preview "$key" "$NEON_URI" ;;
      DATABASE_URL_UNPOOLED) neon_uri false && set_preview "$key" "$NEON_URI" ;;
      BETTER_AUTH_SECRET)
        secret=$(openssl rand -base64 32)
        set_preview "$key" "$secret"
        ;;
      BETTER_AUTH_URL) set_preview "$key" "https://$DEVELOP_ALIAS" ;;
      PREVIEW_MIGRATIONS | SEED_DEMO_DATA) set_preview "$key" "true" ;;
      PLATFORM_ADMIN_EMAILS) [ -n "${DEVELOP_PLATFORM_ADMIN_EMAILS:-}" ] && set_preview "$key" "$DEVELOP_PLATFORM_ADMIN_EMAILS" ;;
    esac
  done
  load_envs
elif [ "${#missing[@]}" -gt 0 ]; then
  echo "::notice::Création automatique impossible sans le secret NEON_API_KEY et la variable NEON_PROJECT_ID (docs/deploiement-vercel.md)."
fi

for key in "${REQUIRED[@]}"; do
  has_preview "$key" || { echo "::error::Variable Vercel absente pour la portée Preview : $key"; errors=1; }
done
for key in "${ADVISED[@]}"; do
  has_preview "$key" || echo "::warning::Variable Vercel conseillée pour la portée Preview : $key"
done
[ "$errors" = 0 ] || exit 1
echo "Variables de l'environnement de développement : correctes."
