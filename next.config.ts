import type { NextConfig } from "next";

// cacheComponents et partialPrefetching sont désactivés volontairement : toutes les pages de l'outil
// dépendent de l'utilisateur connecté et de données qui changent à chaque action. Le rendu dynamique
// classique est plus simple à raisonner pour ce périmètre (voir la PR J1 / session 1.1).

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // Outil interne : jamais indexé par les moteurs de recherche.
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
