import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import media from "../media.json" with { type: "json" };

const origin = "https://kirshchenya.com";
for (const [path, heading] of [["/", "Kirshchenya"], ["/projects", "AI Wordcards"], ["/work-notes", "Work Journal"], ["/outside-work", "Outside Work"]]) {
  const res = await fetch(origin + path, { signal: AbortSignal.timeout(15000) });
  assert.equal(res.status, 200, path);
  assert.ok((await res.text()).includes(heading), path);
}
for (const [key, item] of Object.entries(media)) {
  const res = await fetch(origin + "/media/" + key, { signal: AbortSignal.timeout(15000) });
  assert.equal(res.status, 200, key);
  assert.equal(res.headers.get("Content-Type"), "image/webp");
  const bytes = Buffer.from(await res.arrayBuffer());
  assert.equal(createHash("sha256").update(bytes).digest("hex"), item.sha256, key);
}
console.log("Verified all four pages and every published image.");
