// Turns data/case.json into static/case.js, a plain script the page can load from disk.
// Run after editing the case: node scripts/build-case.js
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "data", "case.json"), "utf8");
const data = JSON.parse(source);

const output = `// Generated from data/case.json by scripts/build-case.js. Edit the JSON, then regenerate.
const CASE_DATA = ${JSON.stringify(data, null, 2)};

if (typeof module !== "undefined") module.exports = { CASE_DATA };
`;
fs.writeFileSync(path.join(root, "static", "case.js"), output);
console.log("wrote static/case.js");
