import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import media from "../media.json" with { type: "json" };

const origin = "https://kirshchenya.com";
const pages = [
  ["/", "Kirshchenya"],
  ["/projects", "AI Wordcards"],
  ["/work-notes", "Work Journal"],
  ["/outside-work", "Outside Work"]
];

async function verify(path, checkResponse) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(origin + path, { signal: AbortSignal.timeout(15000) });
      assert.equal(response.status, 200, path);
      await checkResponse(response);
      return;
    } catch (error) {
      if (attempt === 4) throw new Error("Live verification failed for " + path, { cause: error });
      await delay(5000 * attempt);
    }
  }
}

for (const [path, heading] of pages) {
  await verify(path, async response => assert.ok((await response.text()).includes(heading), path));
}

for (const [key, item] of Object.entries(media)) {
  await verify("/media/" + key, async response => {
    assert.equal(response.headers.get("Content-Type"), "image/webp", key);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.length, item.bytes, key);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), item.sha256, key);
  });
}

console.log("Verified " + pages.length + " live pages and " + Object.keys(media).length + " published images.");
