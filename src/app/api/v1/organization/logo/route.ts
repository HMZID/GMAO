import { apiRoute } from "@/server/api/handler";
import { getLogo } from "@/server/services/branding";

/** Logo de l'organisation (image). Avec ?v=<version>, l'adresse change à chaque logo : cache long côté navigateur. */
export const GET = apiRoute(async (ctx, request) => {
  const logo = await getLogo(ctx);
  const versioned = new URL(request.url).searchParams.has("v");
  return new Response(new Uint8Array(logo.bytes), {
    headers: {
      "Content-Type": logo.contentType,
      "Content-Length": String(logo.bytes.length),
      "Cache-Control": versioned ? "private, max-age=31536000, immutable" : "private, no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
