import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth/auth";

/** Points d'entrée Better Auth : connexion, déconnexion, session, SSO. */
export const { GET, POST } = toNextJsHandler(auth);
