import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename } from "node:path";

const source = process.argv[2];
if (!source) throw new Error("Supply a path to a WebP file.");
const bytes = readFileSync(source);
if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") {
  throw new Error("Expected a WebP image.");
}
const slug = basename(source).replace(/\.webp$/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
if (!slug) throw new Error("Use a descriptive filename.");
const sha256 = createHash("sha256").update(bytes).digest("hex");
const key = slug + "." + sha256.slice(0, 16) + ".webp";
const manifest = JSON.parse(readFileSync("media.json", "utf8"));
manifest[key] = { sha256, bytes: bytes.length };
mkdirSync("media-upload", { recursive: true });
writeFileSync("media-upload/" + key, bytes);
writeFileSync("media.json", JSON.stringify(manifest, null, 2) + "\n");
console.log("Upload media-upload/" + key + " to R2, then use /media/" + key);
