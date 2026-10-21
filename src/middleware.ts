import { NextResponse, type NextRequest } from "next/server";

/**
 * Garde légère : sans cookie de session, redirige vers la connexion en conservant la page demandée.
 * La session elle-même est vérifiée côté serveur (requireUser).
 */
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

export function middleware(request: NextRequest) {
  if (SESSION_COOKIES.some((name) => request.cookies.has(name))) return NextResponse.next();
  const url = request.nextUrl.clone();
  const returnTo = request.nextUrl.pathname + request.nextUrl.search;
  url.pathname = "/connexion";
  url.search = returnTo === "/" ? "" : `?retour=${encodeURIComponent(returnTo)}`;
  return NextResponse.redirect(url);
}

// Tout est protégé sauf la connexion, l'API d'auth, la page hors ligne et les fichiers de la PWA
export const config = {
  matcher: ["/((?!connexion|premier-demarrage|hors-ligne|api/auth|_next/|icons/|wasm/|manifest.webmanifest|sw.js|favicon.ico).*)"],
};
