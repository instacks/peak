// Dev build, re-run by `node --watch-path=src` on every change under src/.
// lightningcss-cli has no --watch flag (PLAN B2), so Node's watcher drives the CLI instead.
import { execFileSync } from "node:child_process";

try {
  execFileSync("npm", ["run", "--silent", "build:css"], { stdio: "inherit" });
  console.log(`[peak] built dist/peak.css at ${new Date().toLocaleTimeString()}`);
} catch {
  // Keep watching after a syntax error; the CLI already printed it.
  process.exitCode = 1;
}
