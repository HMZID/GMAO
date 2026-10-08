/**
 * Client de l'API REST v1 de la GMAO (mêmes services, mêmes droits que le web, TEC-09).
 * Module sans dépendance React Native : utilisé par l'application et par les vérifications en Node.
 *
 * Deux familles d'erreurs, traitées différemment par la synchronisation :
 * - `NetworkError` : pas de réseau, serveur injoignable, délai dépassé → on réessaiera plus tard ;
 * - `ApiError` : le serveur a répondu (droits, validation, règle métier) → l'utilisateur doit agir.
 */

export class NetworkError extends Error {
  constructor(message = "Réseau indisponible : la saisie est conservée et sera envoyée plus tard.") {
    super(message);
    this.name = "NetworkError";
  }
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: unknown = null,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Messages lisibles : conditions métier manquantes (DON-11) ou erreurs par champ. */
  get messages(): string[] {
    const d = this.details as { errors?: string[]; fieldErrors?: Record<string, string[]> } | null;
    if (d?.errors?.length) return d.errors;
    if (d?.fieldErrors) {
      const fields = Object.entries(d.fieldErrors).flatMap(([field, msgs]) => (msgs ?? []).map((m) => `${field} : ${m}`));
      if (fields.length) return fields;
    }
    return [this.message];
  }

  /** Erreur du serveur lui-même (5xx) : passagère, on réessaiera. */
  get isServerError() {
    return this.status >= 500;
  }
}

export type ApiClientOptions = {
  baseUrl: string;
  getToken: () => Promise<string | null> | string | null;
  /** Délai maximal d'une requête, en millisecondes. */
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export type FileField = { uri: string; name: string; type: string } | Blob;

export function createApiClient(options: ApiClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const base = options.baseUrl.replace(/\/$/, "");

  async function request<T>(method: string, path: string, body?: unknown, init: { form?: FormData; auth?: boolean } = {}): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json", "x-client": "mobile" };
    const token = init.auth === false ? null : await options.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined && !init.form) headers["Content-Type"] = "application/json";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);
    let response: Response;
    try {
      response = await fetchImpl(`${base}${path}`, {
        method,
        headers,
        body: init.form ?? (body !== undefined ? JSON.stringify(body) : undefined),
        signal: controller.signal,
      });
    } catch {
      throw new NetworkError();
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();
    let json: { data?: T; error?: { code: string; message: string; details?: unknown } } = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      if (!response.ok) throw new ApiError(response.status, "invalid_response", `Réponse inattendue du serveur (${response.status}).`);
    }
    if (!response.ok) {
      throw new ApiError(
        response.status,
        json.error?.code ?? "error",
        json.error?.message ?? `Erreur ${response.status}.`,
        json.error?.details ?? null,
      );
    }
    return (json.data ?? null) as T;
  }

  return {
    get: <T>(path: string) => request<T>("GET", path),
    post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
    put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body ?? {}),
    patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body ?? {}),
    upload: <T>(path: string, fields: Record<string, string | undefined>, file: FileField, fileName: string) => {
      const form = new FormData();
      for (const [key, value] of Object.entries(fields)) if (value !== undefined) form.append(key, value);
      // React Native accepte { uri, name, type } ; Node et le web, un Blob, nommé : l'extension décide du format contrôlé.
      if (typeof Blob !== "undefined" && file instanceof Blob) form.append("file", file, fileName);
      else form.append("file", file as unknown as Blob);
      return request<T>("POST", path, undefined, { form });
    },

    /** Connexion par courriel et mot de passe : le jeton Bearer est renvoyé dans l'en-tête `set-auth-token`. */
    async signIn(email: string, password: string): Promise<string> {
      let response: Response;
      try {
        response = await fetchImpl(`${base}/api/auth/sign-in/email`, {
          method: "POST",
          // Pas d'en-tête Origin : une application native n'a pas d'origine web (une origine étrangère serait refusée).
          headers: { "Content-Type": "application/json", "x-client": "mobile" },
          body: JSON.stringify({ email, password }),
        });
      } catch {
        throw new NetworkError("Serveur injoignable : vérifier la connexion.");
      }
      if (!response.ok) throw new ApiError(response.status, "unauthorized", "Courriel ou mot de passe incorrect.");
      const token = response.headers.get("set-auth-token");
      if (!token) throw new ApiError(500, "no_token", "Le serveur n'a pas renvoyé de jeton.");
      return token;
    },

    async signOut() {
      try {
        await request("POST", "/api/auth/sign-out", {});
      } catch {
        // Déconnexion locale même hors réseau.
      }
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
