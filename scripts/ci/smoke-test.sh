#!/usr/bin/env bash
# Vérifications d'un environnement en ligne (après déploiement, et par la surveillance) : page de connexion,
# en-têtes de sécurité, tâche planifiée protégée, API fermée sans session, anciennes adresses redirigées.
# Usage : bash scripts/ci/smoke-test.sh https://adresse ; code de sortie 1 au premier écart (tous listés).
set -uo pipefail

BASE=${1:?adresse attendue}
fail=0
check() {
  if [ "$2" = "$3" ]; then
    echo "OK   $1"
  else
    echo "::error::$1 ($BASE) : obtenu « $2 », attendu « $3 »."
    fail=1
  fi
}
code() { curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$BASE$1"; }

check "Page de connexion" "$(code /login)" "200"
headers=$(curl -sI --max-time 20 "$BASE/login" | tr -d '\r' | tr '[:upper:]' '[:lower:]')
check "En-tête HSTS" "$(grep -c '^strict-transport-security:' <<<"$headers")" "1"
check "Pages hors cadre (CSP frame-ancestors)" "$(grep -c "^content-security-policy:.*frame-ancestors 'none'" <<<"$headers")" "1"
check "Type de contenu non deviné (nosniff)" "$(grep -c '^x-content-type-options: nosniff' <<<"$headers")" "1"
check "Tâche planifiée protégée" "$(code /api/cron/notifications)" "401"
check "API fermée sans session" "$(code /api/v1/me)" "401"
check "Ancienne adresse redirigée" "$(code /ordres-de-travail)" "308"
exit $fail
