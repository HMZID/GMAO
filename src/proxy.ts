import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/** Site commercial : pages publiques, sans session (voir `src/app/(site)`). */
const PUBLIC_PREFIXES = ["/decouvrir", "/tarifs", "/essai-gratuit", "/infos"];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Contrôle optimiste : sans cookie de session, l'accueil « / » affiche le site commercial et les autres
 * pages de l'application renvoient vers /login. La vérification complète (session valide, compte actif,
 * droits) est faite par la couche d'accès aux données (`getAuthContext`) ; les routes API répondent 401 elles-mêmes.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();
  if (!getSessionCookie(request)) {
    if (pathname === "/") return NextResponse.rewrite(new URL(`/decouvrir${request.nextUrl.search}`, request.url));
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // /connexion/verification : deuxième étape de la connexion (code TOTP), avant que la session n'existe.
  matcher: ["/((?!api|login|connexion|robots.txt|sitemap.xml|_next/static|_next/image|favicon.ico).*)"],
};
