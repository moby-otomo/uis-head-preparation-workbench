import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const roots = ["src", "tests", "schemas", "docs", "fixtures", "compatibility", "scripts"];
const forbiddenArchiveFragment = "Documents/Obsidian/UNCLESINSPACE";
const failures = [];

async function visit(relativeDirectory) {
  const entries = await readdir(relativeDirectory, { withFileTypes: true });
  for (const entry of entries) {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      await visit(relativePath);
      continue;
    }
    if (!/\.(?:ts|mjs|json|md)$/.test(entry.name)) continue;
    const text = await readFile(relativePath, "utf8");
    text.split("\n").forEach((line, index) => {
      if (/[ \t]+$/.test(line)) failures.push(`${relativePath}:${index + 1}: trailing whitespace`);
    });
    if ((relativePath.startsWith("src/") || relativePath.startsWith("fixtures/") || relativePath.startsWith("compatibility/")) && text.includes(forbiddenArchiveFragment)) {
      failures.push(`${relativePath}: contains a machine-specific production archive path`);
    }
  }
}

for (const root of roots) await visit(root);

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("repository lint: ok");
}
