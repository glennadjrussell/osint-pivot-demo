// Run with: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { CASE_DATA } = require("../static/case.js");
const { GUIDED_STEPS } = require("../static/guided-steps.js");
const { Investigation, selectorKey } = require("../static/engine.js");

const ALIAS = "jin.sk.dev@mail.example";
const ALIAS_ANCHOR = "dwhitmore.dev@mail.example";
const SSH_KEY = "SHA256:xK3vQ9mT2fLr8WpZ1cYdN4hB7sJa0eG6uKoR5iVtPw";
const COWORKING_IP = "198.51.100.20";
const selector = (type, value) => ({ type, value });

function started() {
  const investigation = new Investigation(CASE_DATA);
  investigation.start(CASE_DATA.anchor);
  return investigation;
}

test("the generated case file matches data/case.json", () => {
  const json = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "case.json"), "utf8"));
  assert.deepEqual(CASE_DATA, json);
});

test("every record refers to a known source and a type that source accepts", () => {
  const accepted = new Map(CASE_DATA.sources.map((spec) => [spec.name, new Set(spec.types)]));
  for (const record of CASE_DATA.records) {
    assert.ok(accepted.has(record.source), record.id);
    assert.ok(accepted.get(record.source).has(record.match.type), record.id);
  }
});

test("only the anchor exists before any pivot", () => {
  const snapshot = started().snapshot();
  assert.deepEqual(snapshot.nodes.map((node) => node.key), [selectorKey(CASE_DATA.anchor)]);
  assert.equal(snapshot.nodes[0].anchor, true);
  assert.equal(snapshot.nodes[0].confidence, "given");
  assert.deepEqual(snapshot.findings, []);
  assert.equal(snapshot.verdict.band, "insufficient");
});

test("the flow before any pivot is just the root", () => {
  const flows = started().flows();
  assert.deepEqual(flows.nodes.map((node) => [node.id, node.column]), [[`sel:${selectorKey(CASE_DATA.anchor)}`, 0]]);
  assert.deepEqual(flows.links, []);
});

test("the anchor pivot returns the applicant pack", () => {
  const investigation = started();
  investigation.investigate(selector("email", ALIAS_ANCHOR));
  const nodes = Object.fromEntries(investigation.snapshot().nodes.map((node) => [node.key, node]));
  assert.equal(nodes["ip:203.0.113.47"].confidence, "given");
  assert.equal(nodes["ip:203.0.113.47"].ioc, true);
});

test("pivoting before a root is chosen is refused", () => {
  const investigation = new Investigation(CASE_DATA);
  assert.throws(() => investigation.investigate(selector("email", ALIAS_ANCHOR)), /Choose a starting selector/);
});

test("only the application's selectors can be roots", () => {
  const investigation = new Investigation(CASE_DATA);
  assert.throws(() => investigation.start(selector("email", "someone-else@mail.example")), /not one of the application/);
});

test("a started investigation cannot be restarted without a reset", () => {
  const investigation = started();
  assert.throws(() => investigation.start(CASE_DATA.roots[1]), /already started/);
});

test("a different root is allowed after a reset", () => {
  const investigation = new Investigation(CASE_DATA);
  investigation.start(CASE_DATA.roots[1]);
  investigation.reset();
  investigation.start(CASE_DATA.roots[2]);
  assert.equal(investigation.snapshot().root, selectorKey(CASE_DATA.roots[2]));
});

test("the guided walkthrough refuses a root other than the application email", () => {
  const investigation = new Investigation(CASE_DATA);
  investigation.start(CASE_DATA.roots[1]);
  assert.throws(() => investigation.guidedNext(), /starts from the application email/);
});

test("the alias is only high confidence once two independent sources agree", () => {
  const investigation = started();
  investigation.investigate(selector("github", "dwhitmore-dev"));
  assert.equal(investigation.confidence(`email:${ALIAS}`), "medium");
  investigation.investigate(selector("domain", "whitmore-blockchain.example"));
  assert.equal(investigation.confidence(`email:${ALIAS}`), "high");
});

test("a weak link stays low confidence", () => {
  const investigation = started();
  investigation.investigate(selector("ip", "203.0.113.47"));
  assert.equal(investigation.confidence(`ip:${COWORKING_IP}`), "low");
});

test("repeating a pivot does not duplicate findings", () => {
  const investigation = started();
  const first = investigation.investigate(selector("github", "dwhitmore-dev"));
  const second = investigation.investigate(selector("github", "dwhitmore-dev"));
  assert.ok(first.length > 0);
  assert.deepEqual(second, []);
  assert.equal(investigation.snapshot().findings.length, first.length);
});

test("a source that does not accept the selector is refused", () => {
  const investigation = started();
  assert.throws(() => investigation.investigate(selector("ip", "203.0.113.47"), "whois"), /does not accept/);
});

test("an unknown source is refused", () => {
  const investigation = started();
  assert.throws(() => investigation.investigate(selector("ip", "203.0.113.47"), "nope"), /Unknown source/);
});

test("a single-source run only queries that source", () => {
  const investigation = started();
  const findings = investigation.investigate(selector("ip", "203.0.113.47"), "ip_intel");
  assert.deepEqual([...new Set(findings.map((finding) => finding.source))], ["ip_intel"]);
});

test("searched records how many records each source returned", () => {
  const investigation = started();
  investigation.investigate(selector("email", ALIAS_ANCHOR));
  const searched = Object.fromEntries(
    investigation.snapshot().searched.map((item) => [`${item.pivot}|${item.source}`, item.returned]),
  );
  assert.equal(searched[`email:${ALIAS_ANCHOR}|application`], 1);
  assert.equal(searched[`email:${ALIAS_ANCHOR}|breach`], 1);
  assert.equal(searched[`email:${ALIAS_ANCHOR}|social`], 1);
});

test("image evidence carries its photos", () => {
  const investigation = started();
  investigation.investigate(selector("image", "img:sha256:ab12cd34ef56"));
  const finding = investigation.snapshot().findings.find((item) => item.source === "image");
  assert.deepEqual(
    finding.media.map((media) => media.src),
    ["evidence/headshot-submitted.svg", "evidence/headshot-original.svg"],
  );
});

test("the guided walkthrough reaches a high verdict", () => {
  const investigation = new Investigation(CASE_DATA);
  let steps = 0;
  while (investigation.guidedNext().step) steps += 1;
  const snapshot = investigation.snapshot();
  assert.equal(steps, GUIDED_STEPS.length);
  assert.equal(snapshot.guided.index, snapshot.guided.total);
  assert.equal(snapshot.verdict.band, "high");
  assert.ok(snapshot.verdict.score >= 60);
  assert.ok(snapshot.verdict.ioc_hits.includes("0x5F3C00000000000000000000000000000000E9"));
});

test("the guided walkthrough keeps the false positive out of the corroborated list", () => {
  const investigation = new Investigation(CASE_DATA);
  while (investigation.guidedNext().step) {}
  const verdict = investigation.verdict();
  assert.ok(!verdict.corroborated.includes(COWORKING_IP));
  assert.ok(verdict.weak_only.includes(COWORKING_IP));
});

test("reset returns to the picker", () => {
  const investigation = new Investigation(CASE_DATA);
  investigation.guidedNext();
  investigation.reset();
  const snapshot = investigation.snapshot();
  assert.equal(snapshot.root, null);
  assert.deepEqual(snapshot.nodes, []);
  assert.deepEqual(snapshot.findings, []);
  assert.deepEqual(snapshot.searched, []);
  assert.equal(snapshot.guided.index, 0);
  assert.equal(snapshot.verdict.score, 0);
});

test("the flow is conserved through each source", () => {
  const investigation = started();
  investigation.investigate(selector("email", ALIAS_ANCHOR));
  investigation.investigate(selector("github", "dwhitmore-dev"));
  investigation.investigate(selector("domain", "whitmore-blockchain.example"));
  const inbound = new Map();
  const outbound = new Map();
  for (const link of investigation.flows().links) {
    if (link.target.startsWith("src:")) inbound.set(link.target, (inbound.get(link.target) ?? 0) + link.value);
    if (link.source.startsWith("src:")) outbound.set(link.source, (outbound.get(link.source) ?? 0) + link.value);
  }
  assert.ok(inbound.size > 0);
  assert.deepEqual([...inbound].sort(), [...outbound].sort());
});

test("a corroborated selector receives ribbons from two sources at the same hop", () => {
  const investigation = started();
  investigation.investigate(selector("email", ALIAS_ANCHOR));
  investigation.investigate(selector("github", "dwhitmore-dev"));
  investigation.investigate(selector("domain", "whitmore-blockchain.example"));
  const senders = new Set(
    investigation.flows().links.filter((link) => link.target === `sel:email:${ALIAS}`).map((link) => link.source),
  );
  assert.deepEqual(senders, new Set(["src:github:1", "src:whois:1"]));
});

test("the flow is rooted at the anchor", () => {
  const investigation = started();
  investigation.investigate(selector("email", ALIAS_ANCHOR));
  const flows = investigation.flows();
  const column = new Map(flows.nodes.map((node) => [node.id, node.column]));
  assert.equal(column.get(`sel:email:${ALIAS_ANCHOR}`), 0);
  assert.equal(column.get("sel:github:dwhitmore-dev"), 2);
  assert.equal(flows.omitted, 0);
});

test("links back to a selector nearer the root are counted, not drawn", () => {
  const investigation = started();
  investigation.investigate(selector("email", ALIAS_ANCHOR));
  investigation.investigate(selector("github", "dwhitmore-dev"));
  investigation.investigate(selector("ssh_key", SSH_KEY));
  investigation.investigate(selector("phone", "+1 555-0142"));
  const flows = investigation.flows();
  assert.ok(flows.omitted >= 1);
  assert.ok(flows.links.some((link) => link.target === "sel:github:jhkim-chain"));
});

test("every flow link runs exactly one column to the right", () => {
  const investigation = started();
  investigation.investigate(selector("email", ALIAS_ANCHOR));
  investigation.investigate(selector("github", "dwhitmore-dev"));
  investigation.investigate(selector("ssh_key", SSH_KEY));
  const flows = investigation.flows();
  const column = new Map(flows.nodes.map((node) => [node.id, node.column]));
  for (const link of flows.links) {
    assert.equal(column.get(link.target), column.get(link.source) + 1);
  }
});
