import { execSync } from "node:child_process";
import path from "node:path";

import { parseHiranandaniBoq } from "../src/lib/boqParser.js";

const pdfPathArg = process.argv.slice(2).join(" ").trim();
if (!pdfPathArg) {
  console.error("Usage: node scripts/debug-parse-hiranandani-wo.mjs <path-to-pdf>");
  process.exit(1);
}

const pdfPath = path.resolve(process.cwd(), pdfPathArg);
const rawText = execSync(`pdftotext "${pdfPath.replace(/"/g, '\\"')}" -`, { encoding: "utf8" });

const parsed = parseHiranandaniBoq(rawText);
console.log(`Parsed items: ${parsed.items.length}`);
console.log(`Sections: ${parsed.sections.join(", ")}`);
console.log("Sample rows:");
parsed.items.slice(0, 15).forEach((it) => {
  console.log(
    `${it.item_no || "-"} | ${it.sac_code || "-"} | ${it.uom || "-"} | qty=${it.order_qty} | rate=${it.unit_price} | val=${it.value} | ${String(it.service_description || "").slice(0, 80)}`
  );
});
