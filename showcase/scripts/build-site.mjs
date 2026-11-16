import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const showcase = fileURLToPath(new URL("../", import.meta.url));
const root = path.dirname(showcase.replace(/\/$/, ""));
const base = (process.env.PAGES_BASE_PATH ?? "/ecole-lesage").replace(
  /\/$/,
  "",
);
const showcaseBase = `${base}/showcase`;
const planningBase = `${base}/planning`;
const output = path.join(showcase, ".site-build");
const manifest = JSON.parse(
  await readFile(path.join(showcase, "source-manifest.json"), "utf8"),
);
if (Object.keys(manifest.failures).length)
  throw Error("Le miroir source contient des téléchargements en échec.");

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const runtime = `window.Showcase = Object.freeze({base:${JSON.stringify(showcaseBase)}, planning:${JSON.stringify(planningBase + "/")}, pathname(){return location.pathname.slice(${showcaseBase.length}) || '/';}});`;
const boot = `<script>${runtime}</script>`;
const redirect = (url) =>
  `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>École Lesage</title><script>location.replace(${JSON.stringify(url)})</script><a href="${url}">Continuer</a></html>`;

function rebase(text) {
  return text
    .normalize("NFC")
    .replace(/\/(?:assets|wp-content)\/[^\s"'`<>\\)]+/g, (url) =>
      encodeURI(decodeURIComponent(url).normalize("NFC")),
    )
    .replaceAll("https://ecole-lesage-refonte.mothzer.chatgpt.site", "")
    .replace(
      /(^|["'`(\s])\/(assets|wp-content|fr)\//g,
      (_, prefix, directory) => `${prefix}${showcaseBase}/${directory}/`,
    )
    .replace(/\/\$\{(lang|language)\}/g, `${showcaseBase}/\$\{$1\}`);
}

async function mirror(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const source = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await mirror(source);
      continue;
    }
    const relative = path.relative(showcase, source).normalize("NFC");
    const target = path.join(output, "showcase", relative);
    await mkdir(path.dirname(target), { recursive: true });
    if (!/\.(html|css|m?js|json|svg)$/.test(entry.name)) {
      await cp(source, target);
      continue;
    }
    let text = await readFile(source, "utf8");
    if (entry.name === "catalog.json") {
      const catalog = JSON.parse(text);
      for (const course of catalog) {
        course.variants = { fr: course.variants.fr };
        course.routes = course.routes.filter((route) =>
          route.startsWith("/fr/"),
        );
        for (const field of ["descriptionHtml", "techniquesHtml"]) {
          if (course[field] && typeof course[field] === "object")
            course[field] = { fr: course[field].fr };
        }
      }
      text = JSON.stringify(catalog);
    }
    if (entry.name === "portal-entry.mjs") {
      text = text.replace(
        "const lang = languages.has(language) ? language : 'fr';",
        "return window.Showcase.planning;",
      );
    }
    if (/\.(m?js)$/.test(entry.name) && entry.name !== "brand-loading.mjs")
      text = text.replaceAll("location.pathname", "window.Showcase.pathname()");
    text = rebase(text);
    if (entry.name.endsWith(".html")) {
      text = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, (script) =>
        script.includes("/cdn-cgi/challenge-platform/") ? "" : script,
      );
      text = text.replace(
        /<a\b[^>]*(?:data-lang=["'](?:en|ja)["']|href=["']\/(?:en|ja)\/)[^>]*>[\s\S]*?<\/a>/g,
        "",
      );
      text = text.replace(/<head([^>]*)>/i, `<head$1>${boot}`);
      // Every account entry belongs to the existing planning, never to the copied ESPACE.
      text = text
        .replaceAll(`${showcaseBase}/fr/espace/`, `${planningBase}/`)
        .replaceAll(`${showcaseBase}/fr/panier/`, `${planningBase}/`);
    }
    await writeFile(target, text);
  }
}
for (const directory of ["fr", "assets", "wp-content"])
  await mirror(path.join(showcase, directory));

// The original server redirects product aliases to the public catalogue detail.
const catalog = JSON.parse(
  await readFile(path.join(showcase, "assets/platform/catalog.json"), "utf8"),
);
for (const course of catalog) {
  for (const route of course.routes.filter((route) =>
    route.startsWith("/fr/"),
  )) {
    const target = path.join(
      output,
      "showcase",
      decodeURIComponent(route),
      "index.html",
    );
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(
      target,
      redirect(
        `${showcaseBase}/fr/boutique/?cours=${encodeURIComponent(course.key)}`,
      ),
    );
  }
}
await writeFile(
  path.join(output, "showcase/index.html"),
  redirect(`${showcaseBase}/fr/`),
);
await writeFile(
  path.join(output, "index.html"),
  `<!doctype html><html lang="fr"><meta charset="utf-8"><title>École Lesage</title><script>location.replace(location.hash.startsWith('#/') ? ${JSON.stringify(planningBase + "/")} + location.hash : ${JSON.stringify(showcaseBase + "/fr/")} + location.search)</script><a href="${showcaseBase}/fr/">Découvrir l’École Lesage</a></html>`,
);
await writeFile(path.join(output, ".nojekyll"), "");

if (!process.argv.includes("--showcase-only")) {
  const build = spawnSync(process.execPath, ["scripts/build-demo.mjs"], {
    cwd: path.join(root, "planning"),
    stdio: "inherit",
    env: {
      ...process.env,
      PAGES_BASE_PATH: planningBase,
      NEXT_PUBLIC_SHOWCASE_URL: `${showcaseBase}/fr/`,
    },
  });
  if (build.status !== 0) process.exit(build.status ?? 1);
  await cp(
    path.join(root, "planning/.pages-build/out"),
    path.join(output, "planning"),
    { recursive: true },
  );
}
console.log(`Site complet statique : ${output}`);
