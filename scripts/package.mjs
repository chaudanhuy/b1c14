// npm run pack — packages source only, no secrets, node_modules, or local build output.
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createZipStream } from "../functions/_lib/zip.js";
const root = fileURLToPath(new URL("../", import.meta.url));
const output = process.argv[2] ? resolve(process.argv[2]) : resolve(root, "dist/b1c14-source.zip");
const dirs = new Set(["public", "functions", "chat-worker", "smart-class-worker", "scripts", "tests"]);
const topFiles = new Set([".gitignore", ".nvmrc", "package.json", "package-lock.json"]);
const excludes = new Set(["node_modules", ".git", ".wrangler", ".build", ".build-chat", ".build-smart", ".build-routing", "artifacts", "dist"]);
const paths = [];
async function walk(folder) {
  const entries = (await readdir(folder, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (entry.isSymbolicLink() || excludes.has(entry.name) || /^\.env($|\.)|^\.dev\.vars($|\.)/.test(entry.name)) continue;
    const path = resolve(folder, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (entry.isFile() && (!entry.name.endsWith(".zip") || relative(root, path).replaceAll("\\", "/").startsWith("tests/fixtures/")) && !entry.name.endsWith(".log")) paths.push(path);
  }
}
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (entry.isSymbolicLink()) continue;
  if (entry.isDirectory() && dirs.has(entry.name)) await walk(resolve(root, entry.name));
  if (entry.isFile() && (topFiles.has(entry.name) || /\.(md|sql)$/.test(entry.name))) paths.push(resolve(root, entry.name));
}
paths.sort();
const files = paths.map(path => ({
  path: relative(root, path).replaceAll("\\", "/"),
  getObject: async () => ({ body: new Blob([await readFile(path)]).stream() }),
}));
const bytes = new Uint8Array(await new Response(createZipStream({ files })).arrayBuffer());
await mkdir(dirname(output), { recursive: true });
await writeFile(output, bytes);
console.log("Đã đóng gói " + files.length + " tệp: " + output + " (" + bytes.length + " bytes)");
