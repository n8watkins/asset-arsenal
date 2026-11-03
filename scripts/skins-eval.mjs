// Run the page-skins generator on a list of concepts against a running dev
// server and save each skinned page + its metadata to skins-eval/<slug>/.
// Usage: node scripts/skins-eval.mjs [baseUrl] ["concept one" "concept two" ...]

import { mkdir, writeFile } from "node:fs/promises";

const DEFAULT_CONCEPTS = ["retro arcade", "botanical journal", "brutalist newspaper", "space mission control", "cozy bakery"];
const [base = "http://localhost:3000", ...rest] = process.argv.slice(2);
const concepts = rest.length ? rest : DEFAULT_CONCEPTS;

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

await Promise.all(
  concepts.map(async (concept) => {
    const wall = Date.now();
    const res = await fetch(`${base}/api/skins/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ concept }),
    });
    const json = await res.json();
    if (!res.ok) {
      console.error(`${concept}: ${json.error}`);
      return;
    }
    const dir = `skins-eval/${slug(concept)}`;
    await mkdir(dir, { recursive: true });
    const { html, ...meta } = json;
    await writeFile(`${dir}/index.html`, html);
    await writeFile(`${dir}/meta.json`, JSON.stringify({ ...meta, wallMs: Date.now() - wall }, null, 2));
    console.log(`${concept}: ${(json.totalMs / 1000).toFixed(1)}s $${json.totalCostUSD.toFixed(3)} -> ${dir}`);
  }),
);
