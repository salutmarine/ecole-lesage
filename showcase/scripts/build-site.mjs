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
    if (relative === "assets/platform/portal-entry.mjs") {
      text = await readFile(
        path.join(showcase, "assets/platform/showcase-portal.mjs"),
        "utf8",
      );
    }
    if (relative === "assets/platform/main.mjs") {
      text =
        "import {mountCourseCalendar} from '../course-calendar.mjs';\n" + text;
      text = text
        .replace("if(view==='shop')view='catalog';", "if(view==='shop')view='catalog';if(['cart','checkout','confirmation'].includes(view))return portalUrl(view,params,language);")
        .replace(
          "new Set(['catalog','product'])",
          "new Set(['catalog','product','cart','checkout','confirmation'])",
        )
        .replace(
          "view='checkout';",
          "view=query.has('confirmation')?'confirmation':'checkout';",
        )
        .replace(
          "return {lang:lang(),view,gift:",
          "return {lang:lang(),view,orderId:query.get('confirmation'),gift:",
        )
        .replace(
          "cleanup=mountShop(main,store,options);loading.hidden=true;",
          "cleanup=mountShop(main,store,options);const stopShop=cleanup;const stopCalendar=options.view==='product'?mountCourseCalendar(main,store,options.productKey):()=>{};cleanup=()=>{stopCalendar();stopShop?.();};loading.hidden=true;",
        );
    }
    if (relative === "assets/platform/shop.mjs") {
      text = text
        .replace(/<p class="shop-demo-note">[\s\S]*?<\/p>/g, "")
        .replace(/<p class="shop-payment-caption">[\s\S]*?<\/p>/g, "")
        .replace(
          /  function availabilityPreview\(p\)\{[\s\S]*?(?=  function renderProduct\(\))/,
          "  function availabilityPreview(){return '';}\n",
        )
        .replace("Confirmer ma commande de démonstration", "Payer pour de faux")
        .replace("Retrouver mes cours", "Accéder au planning pour réserver")
        .replace(
          "Commande de démonstration confirmée",
          "Paiement fictif confirmé",
        );
    }
    if (/\.(html|css|m?js)$/.test(entry.name))
      text = text.replace(/\bArial\b/gi, "Manrope");
    if (relative === "assets/ui.js") {
      text = text.replace(
        /  \/\/ Local cookie preferences[\s\S]*?(?=  \/\/ Escape closes)/,
        "",
      );
    }
    if (relative === "assets/replica.css") {
      text = text.replace(
        /\.replica-cookie-overlay[\s\S]*?(?=\.woocommerce-info)/,
        "",
      );
    }
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
    if (/\.(m?js)$/.test(entry.name) && entry.name !== "brand-loading.mjs")
      text = text.replaceAll("location.pathname", "window.Showcase.pathname()");
    text = rebase(text);
    if (entry.name.endsWith(".html")) {
      text = text.replace(
        /<div\b[^>]*class=["'][^"']*\bheader-language\b[^"']*["'][^>]*>[\s\S]*?<\/div>/g,
        "",
      );
      text = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, (script) =>
        script.includes("/cdn-cgi/challenge-platform/") ? "" : script,
      );
      text = text.replace(
        /<a\b[^>]*(?:data-lang=["'](?:en|ja)["']|href=["']\/(?:en|ja)\/)[^>]*>[\s\S]*?<\/a>/g,
        "",
      );
      text = text.replace(/<head([^>]*)>/i, `<head$1>${boot}`);
      text = text.replace(
        "</head>",
        `<link rel="stylesheet" href="${showcaseBase}/assets/customizations.css"></head>`,
      );
      // Every account entry belongs to the existing planning, never to the copied ESPACE.
      text = text.replaceAll(`${showcaseBase}/fr/espace/`, `${planningBase}/`);
    }
    await writeFile(target, text);
  }
}
for (const directory of ["fr", "assets", "wp-content"])
  await mirror(path.join(showcase, directory));

const shopPage = await readFile(
  path.join(output, "showcase/fr/boutique/index.html"),
  "utf8",
);
for (const route of ["panier", "commande"]) {
  const folder = path.join(output, "showcase/fr", route);
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, "index.html"), shopPage);
}
const planningSnapshot = JSON.parse(
  await readFile(
    path.join(root, "planning/data/lesage/local-demo.json"),
    "utf8",
  ),
);
await writeFile(
  path.join(output, "showcase/assets/planning-availability.json"),
  JSON.stringify({
    storageKey: `lesage-pages-demo-v6-${planningSnapshot.snapshotId}`,
    slots: planningSnapshot.slots.map(
      ({ id, startsAt, endsAt, capacity, reserved, blocked }) => ({
        id,
        startsAt,
        endsAt,
        capacity,
        reserved,
        blocked,
      }),
    ),
    blockouts: planningSnapshot.blockouts,
  }),
);

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
