import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";

const clientDirectory = join(process.cwd(), "dist", "client");
const centralDirectory = join(clientDirectory, "central");

await rm(centralDirectory, { recursive: true, force: true });
await mkdir(centralDirectory, { recursive: true });

for (const entry of await readdir(clientDirectory)) {
  if (entry === "central") continue;
  await cp(join(clientDirectory, entry), join(centralDirectory, entry), {
    recursive: true,
  });
}

console.log("Cloudflare assets prepared for /central.");

const clientDir = join(process.cwd(), "dist", "client");
const centralDir = join(clientDir, "central");
const entries = await readdir(clientDir, { withFileTypes: true });

await rm(centralDir, { recursive: true, force: true });
await mkdir(centralDir, { recursive: true });

for (const entry of entries) {
  if (entry.name === "central") continue;
  await cp(join(clientDir, entry.name), join(centralDir, entry.name), {
    recursive: true,
  });
}
