// Investigation engine, in the browser. One investigation, rooted at a selector the
// presenter chose. Everything here is a port of the earlier Python engine, and the
// snapshot keeps the same shape so the UI can redraw from it.

// The walkthrough is a global in the page, and a required module under Node.
const guidedSteps = () => (typeof GUIDED_STEPS !== "undefined" ? GUIDED_STEPS : require("./guided-steps.js").GUIDED_STEPS);

const APPLICANT_SOURCE = "application";
const HIGH_BAND_SCORE = 60;
const SUSPICIOUS_BAND_SCORE = 30;
const SCORE_PER_HIGH_NODE = 10;
const SCORE_PER_IOC_HIT = 15;

const selectorKey = (selector) => `${selector.type}:${selector.value}`;
const selectorId = (key) => `sel:${key}`;
const sourceId = (source, hop) => `src:${source}:${hop}`;

function bump(map, key, seed) {
  const entry = map.get(key);
  if (entry) entry.count += 1;
  else map.set(key, { ...seed, count: 1 });
}

class Investigation {
  constructor(caseFile) {
    this._case = caseFile;
    this._sources = new Map(
      caseFile.sources.map((spec) => [
        spec.name,
        {
          name: spec.name,
          label: spec.label,
          types: new Set(spec.types),
          records: caseFile.records.filter((record) => record.source === spec.name),
        },
      ]),
    );
    this._iocKeys = new Set(caseFile.advisory_iocs.map(selectorKey));
    this.reset();
  }

  reset() {
    this._root = null;
    this._nodes = new Map();
    this._edges = [];
    this._edgeIds = new Set();
    this._findings = [];
    this._searched = new Map();
    this._guidedIndex = 0;
    this._lastStep = null;
  }

  // Make one selector the root that everything else hangs off. Only the selectors the
  // application supplied can be roots, so every pivot traces back to the application.
  start(root) {
    if (this._root) throw new Error("The investigation has already started. Reset it to choose a different root.");
    const candidate = this._case.roots.find((item) => selectorKey(item) === selectorKey(root));
    if (!candidate) throw new Error(`${root.value} is not one of the application's selectors`);
    this._root = candidate;
    this._nodes.set(selectorKey(candidate), candidate);
  }

  // Run a selector through every source that accepts it, or through one named source.
  // Repeating a selector and source pair is a no-op, so the flow and evidence don't duplicate.
  investigate(selector, source = null) {
    if (!this._root) throw new Error("Choose a starting selector before pivoting.");
    const key = selectorKey(selector);
    if (!this._nodes.has(key)) this._nodes.set(key, selector);
    const found = [];
    for (const src of this._sourcesFor(selector, source)) {
      const pair = `${key}|${src.name}`;
      if (this._searched.has(pair)) continue;
      const records = src.records.filter((record) => selectorKey(record.match) === key);
      this._searched.set(pair, { pivot: key, source: src.name, returned: records.length });
      for (const record of records) found.push(this._apply(record, src));
    }
    return found;
  }

  // The next scripted step. The script is written for the application email, so it starts there.
  guidedNext() {
    if (!this._root) this.start(this._case.anchor);
    else if (selectorKey(this._root) !== selectorKey(this._case.anchor)) {
      throw new Error("The guided walkthrough starts from the application email. Reset and choose it, or pivot manually.");
    }
    if (this._guidedIndex >= guidedSteps().length) return { step: null, findings: [] };
    const step = guidedSteps()[this._guidedIndex];
    this._guidedIndex += 1;
    this._lastStep = step;
    const findings = this.investigate({ type: step.type, value: step.value, label: step.title });
    return { step, findings };
  }

  // How much to trust a selector. The anchor is 'given', and so is anything the application
  // pack supplied and nothing else has checked. One strong source is 'medium'. Two or more
  // independent sources agreeing is 'high'. Weak links are 'low' however many there are.
  confidence(key) {
    const incoming = this._edges.filter((edge) => edge.to === key);
    if (incoming.length === 0) return this._root && key === selectorKey(this._root) ? "given" : "low";
    if (!incoming.some((edge) => edge.attribution === "strong")) return "low";
    const sources = new Set(incoming.map((edge) => edge.source));
    if (sources.size === 1 && sources.has(APPLICANT_SOURCE)) return "given";
    return sources.size >= 2 ? "high" : "medium";
  }

  verdict() {
    const keys = [...this._nodes.keys()];
    const confidences = new Map(keys.map((key) => [key, this.confidence(key)]));
    const high = keys.filter((key) => confidences.get(key) === "high");
    const iocHits = keys.filter((key) => this._iocKeys.has(key) && confidences.get(key) !== "low");
    const weakOnly = keys.filter((key) => confidences.get(key) === "low");
    const score = Math.min(100, SCORE_PER_HIGH_NODE * high.length + SCORE_PER_IOC_HIT * iocHits.length);
    const [band, headline, recommendations] = bandFor(score);
    return {
      score,
      band,
      headline,
      corroborated: high.map((key) => this._nodes.get(key).value),
      ioc_hits: iocHits.map((key) => this._nodes.get(key).value),
      weak_only: weakOnly.map((key) => this._nodes.get(key).value),
      recommendations,
    };
  }

  // Sankey data, rooted at the root. Selectors sit in column 2 × hop from the root, and the
  // sources queried from a hop sit in the column after it, so every ribbon runs one column
  // to the right. A link that points back to a selector already nearer the root cannot be
  // drawn that way. Those are counted in `omitted` and stay in the evidence.
  flows() {
    if (!this._root) return { nodes: [], links: [], omitted: 0 };
    const depth = this._depths();
    const pivotToSource = new Map();
    const sourceToFound = new Map();
    let omitted = 0;
    for (const edge of this._edges) {
      const hop = depth.get(edge.from);
      if (hop === undefined || depth.get(edge.to) !== hop + 1) {
        omitted += 1;
        continue;
      }
      bump(pivotToSource, `${edge.from}|${edge.source}|${hop}`, { from: edge.from, source: edge.source, hop });
      bump(sourceToFound, `${edge.source}|${hop}|${edge.to}`, { source: edge.source, hop, to: edge.to });
    }

    const pivots = [...pivotToSource.values()];
    const founds = [...sourceToFound.values()];
    const selectorKeys = unique([selectorKey(this._root), ...pivots.map((p) => p.from), ...founds.map((f) => f.to)]);
    const sourceIds = unique([
      ...pivots.map((p) => sourceId(p.source, p.hop)),
      ...founds.map((f) => sourceId(f.source, f.hop)),
    ]);

    const nodes = [
      ...selectorKeys.map((key) => this._selectorFlowNode(key, depth.get(key))),
      ...sourceIds.map((id) => this._sourceFlowNode(id)),
    ];
    const links = [
      ...pivots.map((p) => ({
        source: selectorId(p.from),
        target: sourceId(p.source, p.hop),
        value: p.count,
        title: `${this._nodeLabel(p.from)} via ${this._sources.get(p.source).label}: ${p.count}`,
      })),
      ...founds.map((f) => ({
        source: sourceId(f.source, f.hop),
        target: selectorId(f.to),
        value: f.count,
        title: `${this._sources.get(f.source).label} returned ${this._nodeLabel(f.to)}: ${f.count}`,
      })),
    ];
    return { nodes, links, omitted };
  }

  snapshot() {
    const keys = [...this._nodes.keys()];
    const nodes = keys.map((key) => this._nodeView(key));
    const guidedAvailable = !this._root || selectorKey(this._root) === selectorKey(this._case.anchor);
    return {
      applicant: { ...this._case.applicant },
      sources: [...this._sources.values()].map((src) => ({ name: src.name, label: src.label, types: [...src.types] })),
      roots: this._case.roots.map((root) => ({ ...root })),
      root: this._root ? selectorKey(this._root) : null,
      nodes,
      edges: this._edges.map((edge) => ({ ...edge })),
      findings: [...this._findings].reverse().map((finding) => ({ ...finding })),
      searched: [...this._searched.values()].map((entry) => ({ ...entry })),
      queue: nodes.filter((node) => !node.investigated),
      flows: this.flows(),
      verdict: this.verdict(),
      guided: {
        index: this._guidedIndex,
        total: guidedSteps().length,
        available: guidedAvailable,
        last: this._lastStep,
      },
    };
  }

  _sourcesFor(selector, source) {
    if (source === null || source === undefined) {
      return [...this._sources.values()].filter((src) => src.types.has(selector.type));
    }
    const src = this._sources.get(source);
    if (!src) throw new Error(`Unknown source: ${source}`);
    if (!src.types.has(selector.type)) throw new Error(`${src.label} does not accept ${selector.type} selectors`);
    return [src];
  }

  // Hop distance from the root along discovered links (breadth-first). It depends only on
  // which links exist, not on the order the presenter pivoted, so the diagram is stable.
  _depths() {
    const depth = new Map();
    if (!this._root) return depth;
    const adjacency = new Map();
    for (const edge of this._edges) {
      if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
      adjacency.get(edge.from).push(edge.to);
    }
    const rootKey = selectorKey(this._root);
    depth.set(rootKey, 0);
    const queue = [rootKey];
    for (let i = 0; i < queue.length; i += 1) {
      const key = queue[i];
      for (const next of adjacency.get(key) ?? []) {
        if (!depth.has(next)) {
          depth.set(next, depth.get(key) + 1);
          queue.push(next);
        }
      }
    }
    return depth;
  }

  _apply(record, src) {
    const from = selectorKey(record.match);
    for (const returned of record.returns) {
      const key = selectorKey(returned);
      if (!this._nodes.has(key)) {
        this._nodes.set(key, { type: returned.type, value: returned.value, label: returned.label ?? "" });
      }
      this._addEdge({
        from,
        to: key,
        source: record.source,
        recordId: record.id,
        attribution: returned.attribution ?? record.attribution,
        title: record.title,
      });
    }
    const finding = {
      record_id: record.id,
      source: record.source,
      source_label: src.label,
      pivot: from,
      title: record.title,
      detail: record.detail,
      attribution: record.attribution,
      returns: record.returns.map(selectorKey),
      media: record.media ?? [],
    };
    this._findings.push(finding);
    return finding;
  }

  _addEdge(edge) {
    const id = `${edge.from}>${edge.to}#${edge.recordId}`;
    if (this._edgeIds.has(id)) return;
    this._edgeIds.add(id);
    this._edges.push(edge);
  }

  _nodeView(key) {
    const selector = this._nodes.get(key);
    return {
      key,
      type: selector.type,
      value: selector.value,
      label: this._nodeLabel(key),
      confidence: this.confidence(key),
      investigated: [...this._searched.values()].some((entry) => entry.pivot === key),
      anchor: this._root !== null && key === selectorKey(this._root),
      ioc: this._iocKeys.has(key),
    };
  }

  _nodeLabel(key) {
    const selector = this._nodes.get(key);
    return selector.label || selector.value;
  }

  _selectorFlowNode(key, hop) {
    return {
      id: selectorId(key),
      key,
      source: null,
      label: this._nodeLabel(key),
      kind: "selector",
      column: 2 * hop,
      confidence: this.confidence(key),
      ioc: this._iocKeys.has(key),
    };
  }

  _sourceFlowNode(id) {
    const [, name, hop] = id.split(":");
    return {
      id,
      key: null,
      source: name,
      label: this._sources.get(name).label,
      kind: "source",
      column: 2 * Number(hop) + 1,
      confidence: null,
      ioc: false,
    };
  }
}

function unique(items) {
  return [...new Set(items)];
}

function bandFor(score) {
  if (score >= HIGH_BAND_SCORE) {
    return [
      "high",
      "Strong pattern of a DPRK-linked IT-worker operation",
      [
        "Halt the hiring process. Do not issue equipment or credentials.",
        "Preserve screenshots, query logs and the source list, and keep a timeline.",
        "Notify your security team and follow your legal and sanctions-reporting process.",
        "Do not contact the owner of the stolen identity. Treat them as a victim.",
      ],
    ];
  }
  if (score >= SUSPICIOUS_BAND_SCORE) {
    return [
      "suspicious",
      "Suspicious: escalate for human review",
      [
        "Hold the offer and verify identity on camera with an independent second check.",
        "Keep pivoting. Re-run selectors as new data arrives.",
      ],
    ];
  }
  return [
    "insufficient",
    "Not enough corroborated evidence yet",
    [
      "Do not act on single-source or weak links.",
      "Keep collecting and corroborating independent sources before deciding.",
    ],
  ];
}

if (typeof module !== "undefined") module.exports = { Investigation, selectorKey };
