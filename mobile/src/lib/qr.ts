/**
 * Contenu d'une étiquette d'équipement (EQP-09) : le jeton seul, ou une adresse se terminant par
 * « /qr/<jeton> » ou « /by-qr/<jeton> ». Un contenu quelconque est renvoyé tel quel (le serveur dira « inconnu »).
 */
export function extractQrToken(data: string) {
  const trimmed = data.trim();
  const match = /\/(?:qr|by-qr)\/([A-Za-z0-9_-]+)\/?(?:[?#].*)?$/.exec(trimmed);
  return match ? match[1] : trimmed;
}
