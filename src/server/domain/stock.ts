/**
 * Règles de stock (CDC §7.5, STK-05, STK-08, STK-14, STK-15).
 */

export type MovementType = "RECEIPT" | "ISSUE" | "RETURN" | "TRANSFER_OUT" | "TRANSFER_IN" | "ADJUSTMENT" | "SCRAP";

/** Signe d'un mouvement sur le stock physique (la quantité saisie est toujours positive, sauf ajustement). */
export function movementSign(type: MovementType): 1 | -1 {
  switch (type) {
    case "RECEIPT":
    case "RETURN":
    case "TRANSFER_IN":
      return 1;
    case "ISSUE":
    case "TRANSFER_OUT":
    case "SCRAP":
      return -1;
    case "ADJUSTMENT":
      return 1; // l'ajustement porte son signe dans la quantité (écart d'inventaire)
  }
}

export function available(onHand: number, reserved: number) {
  return round3(onHand - reserved);
}

export type IssueCheckInput = {
  onHand: number;
  reserved: number;
  /** Quantité réservée pour l'OT concerné (consommable en priorité). */
  reservedForWorkOrder: number;
  quantity: number;
};

/**
 * Règles 1 et 3 de §7.5 : le stock physique ne devient jamais négatif et une sortie
 * ne dépasse pas (réservé pour cet OT + disponible).
 */
export function checkIssue({ onHand, reserved, reservedForWorkOrder, quantity }: IssueCheckInput): string[] {
  const errors: string[] = [];
  if (!(quantity > 0)) errors.push("La quantité doit être positive.");
  const free = available(onHand, reserved);
  if (quantity > reservedForWorkOrder + free) {
    errors.push(`Stock insuffisant : ${round3(reservedForWorkOrder + free)} disponible(s) pour cet OT, ${quantity} demandé(s).`);
  }
  if (onHand - quantity < 0) errors.push("Le stock physique ne peut pas devenir négatif.");
  return errors;
}

/** Une réservation ne peut porter que sur le disponible. */
export function checkReservation(onHand: number, reserved: number, quantity: number): string[] {
  if (!(quantity > 0)) return ["La quantité doit être positive."];
  const free = available(onHand, reserved);
  return quantity > free ? [`Seulement ${free} disponible(s) à réserver.`] : [];
}

/** Coût moyen pondéré après une réception (STK-15). */
export function weightedAverageCost(onHand: number, averageCost: number, receivedQty: number, unitCost: number) {
  const total = onHand + receivedQty;
  if (total <= 0) return round2(unitCost);
  return round2((Math.max(onHand, 0) * averageCost + receivedQty * unitCost) / total);
}

/** Alerte de réapprovisionnement : disponible + en commande ≤ point de commande (STK-08). */
export function needsReorder(input: { onHand: number; reserved: number; onOrder?: number; reorderPoint: number | null }) {
  if (input.reorderPoint === null) return false;
  return available(input.onHand, input.reserved) + (input.onOrder ?? 0) <= input.reorderPoint;
}

/** Quantité proposée au réapprovisionnement : maximum − (disponible + en commande) (STK-09). */
export function suggestedReorderQuantity(input: { onHand: number; reserved: number; onOrder?: number; maxQty: number | null }) {
  if (input.maxQty === null) return 0;
  return Math.max(round3(input.maxQty - (available(input.onHand, input.reserved) + (input.onOrder ?? 0))), 0);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}
