#!/usr/bin/env bash
# Sauvegarde de la base de production avant une mise en production : branche Neon instantanée (copie à
# l'identique, sans interruption) créée depuis la branche par défaut du projet (production), nommée
# « sauvegarde-AAAAMMJJ-HHMM-<version> ». Les sauvegardes au-delà des NEON_BACKUP_KEEP plus récentes
# (3 par défaut) sont supprimées. Restauration : docs/exploitation-production.md.
#
# Entrées (environnement) : NEON_API_KEY, NEON_PROJECT_ID, APP_VERSION ; facultative : NEON_BACKUP_KEEP.
# Sortie : nom de la sauvegarde dans $GITHUB_OUTPUT (backup=…). Aucune adresse de connexion n'est affichée.
set -euo pipefail

KEEP=${NEON_BACKUP_KEEP:-3}
API="https://console.neon.tech/api/v2/projects/$NEON_PROJECT_ID"
neon() { curl -sS -f -H "Authorization: Bearer $NEON_API_KEY" -H "Accept: application/json" -H "Content-Type: application/json" "$@"; }

if ! branches=$(neon "$API/branches"); then
  echo "::error::Lecture des branches Neon impossible : vérifier NEON_API_KEY et NEON_PROJECT_ID."
  exit 1
fi
parent=$(jq -r '.branches[] | select(.default == true) | .id' <<<"$branches")
parent_name=$(jq -r '.branches[] | select(.default == true) | .name' <<<"$branches")
if [ -z "$parent" ]; then
  echo "::error::Branche Neon par défaut (production) introuvable."
  exit 1
fi

name="sauvegarde-$(date -u +%Y%m%d-%H%M)-${APP_VERSION:-manuel}"
if ! created=$(jq -n --arg p "$parent" --arg n "$name" '{branch: {parent_id: $p, name: $n}}' | neon -X POST --data-binary @- "$API/branches"); then
  echo "::error::Création de la sauvegarde Neon « $name » impossible (limite de branches du forfait ?)."
  exit 1
fi
id=$(jq -r '.branch.id' <<<"$created")
# La branche est utilisable dès que ses opérations de création sont terminées.
for _ in $(seq 1 30); do
  state=$(neon "$API/branches/$id" | jq -r '.branch.current_state')
  [ "$state" = "ready" ] && break
  sleep 2
done
if [ "$state" != "ready" ]; then
  echo "::error::Sauvegarde Neon « $name » pas prête (état : $state)."
  exit 1
fi
echo "Sauvegarde de la production : branche Neon « $name » (copie de « $parent_name »)."
[ -n "${GITHUB_OUTPUT:-}" ] && echo "backup=$name" >>"$GITHUB_OUTPUT"

# Rétention : seules les KEEP sauvegardes les plus récentes sont conservées.
old=$(neon "$API/branches" | jq -r --argjson keep "$KEEP" \
  '[.branches[] | select(.name | startswith("sauvegarde-"))] | sort_by(.created_at) | reverse | .[$keep:] | .[] | .id + " " + .name')
while read -r old_id old_name; do
  [ -n "$old_id" ] || continue
  if neon -X DELETE "$API/branches/$old_id" >/dev/null; then
    echo "Ancienne sauvegarde supprimée : $old_name"
  else
    echo "::warning::Suppression de l'ancienne sauvegarde « $old_name » impossible."
  fi
done <<<"$old"
