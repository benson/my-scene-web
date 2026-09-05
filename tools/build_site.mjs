import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "web");
const output = path.join(root, "dist");
const files = fs.readdirSync(source).filter(name => /\.(mjs|css|html)$/.test(name)).sort();
const hash = createHash("sha256");
for (const name of [...files, "assets/game-data.json"])
  hash.update(name).update(fs.readFileSync(path.join(source, name)));
const version = hash.digest("hex").slice(0, 12);

// Version the complete module graph together to prevent mixed cached releases.
// Keep the original assets at their stable paths; they are loaded on demand.
fs.mkdirSync(output, { recursive: true });
fs.cpSync(source, output, { recursive: true });
for (const name of files) {
  let text = fs.readFileSync(path.join(source, name), "utf8");
  if (name.endsWith(".mjs"))
    text = text.replace(/(["'])(\.\/[^"']+\.mjs|assets\/game-data\.json)\1/g,
      (_, quote, url) => `${quote}${url}?v=${version}${quote}`);
  if (name === "index.html")
    text = text.replace(/(href="style\.css|src="app\.mjs)(")/g, `$1?v=${version}$2`);
  fs.writeFileSync(path.join(output, name), text);
}
console.log(`Built browser release ${version} in dist/`);
