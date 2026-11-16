import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../.site-build/", import.meta.url));
const base = (process.env.PAGES_BASE_PATH ?? "/ecole-lesage").replace(
  /\/$/,
  "",
);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".woff2": "font/woff2",
  ".otf": "font/otf",
};
createServer(async (request, response) => {
  try {
    let pathname = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
    if (base && pathname.startsWith(base + "/"))
      pathname = pathname.slice(base.length);
    let file = path.resolve(root, "." + pathname);
    if (file !== path.resolve(root) && !file.startsWith(root))
      throw Error("Invalid path");
    if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
    const body = await readFile(file);
    response.writeHead(200, {
      "Content-Type": types[path.extname(file)] ?? "application/octet-stream",
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}).listen(8124, "127.0.0.1", () =>
  console.log(`Local: http://127.0.0.1:8124${base}/`),
);
