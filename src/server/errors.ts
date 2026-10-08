/**
 * Erreurs applicatives. Les services lèvent ces erreurs ; les routes API les traduisent
 * en codes HTTP (`src/server/api/handler.ts`) et les Server Actions en messages de formulaire.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentification requise.") {
    super(message, 401, "unauthorized");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Action non autorisée sur ce périmètre.") {
    super(message, 403, "forbidden");
  }
}

export class NotFoundError extends AppError {
  constructor(entity = "Ressource") {
    super(`${entity} introuvable.`, 404, "not_found");
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 409, "conflict", details);
  }
}

/** Violation d'une règle métier : la liste des erreurs est affichée telle quelle (DON-11). */
export class BusinessRuleError extends AppError {
  constructor(public readonly errors: string[]) {
    super(errors.join(" "), 422, "business_rule", { errors });
  }
}

/** Données invalides : erreurs par champ (format Zod `flattenError`). */
export class ValidationError extends AppError {
  constructor(
    public readonly fieldErrors: Record<string, string[] | undefined>,
    message = "Certaines données sont invalides.",
  ) {
    super(message, 400, "validation", { fieldErrors });
  }
}
