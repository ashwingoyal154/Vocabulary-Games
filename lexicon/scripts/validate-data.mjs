/**
 * Validate the canonical vocabulary dataset (src/data/clusters.json).
 *
 * Checks structure, the role-prefix legend (X / * / #), connotation values, and
 * duplicate words/families; prints the derived game-coverage stats so you can see
 * how the dataset scales. Exit code 0 = clean, 1 = errors (CI / pre-build friendly).
 *
 *   node scripts/validate-data.mjs            # validate the canonical dataset
 *   node scripts/validate-data.mjs <file>     # validate any clusters JSON file
 */
import { loadClusters, validate, DATA_PATH } from "./lib.mjs";

const path = process.argv[2] || DATA_PATH;

let clusters;
try {
  clusters = loadClusters(path);
} catch (e) {
  console.error(`FAIL: could not read/parse ${path}\n  ${e.message}`);
  process.exit(1);
}

const { errors, warnings, stats } = validate(clusters);

console.log(`\nDataset: ${path}`);
console.log("─".repeat(60));
console.log(`  families ............. ${stats.clusters}`);
console.log(`  word entries ......... ${stats.entries}`);
console.log(`  synonym members ...... ${stats.members}  (${stats.uniqueMembers} unique, incl. ${stats.near} near)`);
console.log(`  antonyms ............. ${stats.antonyms}`);
console.log(`  unrelated ............ ${stats.unrelated}`);
console.log(`  Clusters-game ready .. ${stats.bigClusters} families (>=4 members)`);
console.log(`  Antonyms-mode ready .. ${stats.antonymClusters} families`);
console.log("─".repeat(60));

if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  • ${w}`);
}

if (errors.length) {
  console.log(`\n${errors.length} error(s):`);
  for (const e of errors) console.log(`  ✗ ${e}`);
  console.log(`\nFAIL — ${errors.length} error(s). Fix these before building.`);
  process.exit(1);
}

console.log(`\nPASS — dataset is valid${warnings.length ? ` (${warnings.length} warning(s) above)` : ""}.`);
process.exit(0);
