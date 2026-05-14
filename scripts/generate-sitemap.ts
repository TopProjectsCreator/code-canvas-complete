// Runs before `vite dev` and `vite build` (predev/prebuild hooks); writes public/sitemap.xml.

import { writeFileSync } from "fs";
import { resolve } from "path";

const BASE_URL = "https://replitclone.lovable.app";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const today = new Date().toISOString().split("T")[0];

const entries: SitemapEntry[] = [
  { path: "/", lastmod: today, changefreq: "weekly", priority: "1.0" },
  { path: "/landing", lastmod: today, changefreq: "weekly", priority: "0.8" },
  { path: "/landing/living-grid", lastmod: today, changefreq: "monthly", priority: "0.4" },
  { path: "/landing/terminal-boot", lastmod: today, changefreq: "monthly", priority: "0.4" },
  { path: "/landing/the-void", lastmod: today, changefreq: "monthly", priority: "0.4" },
  { path: "/landing/monochrome", lastmod: today, changefreq: "monthly", priority: "0.4" },
  { path: "/landing/warm-momentum", lastmod: today, changefreq: "monthly", priority: "0.4" },
  { path: "/landing/terminal-verdict", lastmod: today, changefreq: "monthly", priority: "0.4" },
  { path: "/editor", lastmod: today, changefreq: "weekly", priority: "0.9" },
  { path: "/docs", lastmod: today, changefreq: "weekly", priority: "0.8" },
  { path: "/compare", lastmod: today, changefreq: "monthly", priority: "0.6" },
  { path: "/FTC", lastmod: today, changefreq: "monthly", priority: "0.7" },
  { path: "/arduino", lastmod: today, changefreq: "monthly", priority: "0.7" },
  { path: "/office", lastmod: today, changefreq: "monthly", priority: "0.7" },
  { path: "/automations", lastmod: today, changefreq: "monthly", priority: "0.7" },
  { path: "/scratch", lastmod: today, changefreq: "monthly", priority: "0.7" },
  { path: "/privacy-policy", lastmod: today, changefreq: "yearly", priority: "0.3" },
  { path: "/terms-of-use", lastmod: today, changefreq: "yearly", priority: "0.3" },
];

function generateSitemap(entries: SitemapEntry[]) {
  const urls = entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

writeFileSync(resolve("public/sitemap.xml"), generateSitemap(entries));
console.log(`sitemap.xml written (${entries.length} entries)`);
