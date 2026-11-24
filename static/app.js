// Single-page UI for the OSINT pivot demo. The engine owns all investigation state;
// this file renders its snapshots. Case text is set with textContent, never innerHTML.

const CONFIDENCE_COLORS = {
  given: "#60a5fa",
  high: "#34d399",
  medium: "#fbbf24",
  low: "#64748b",
};
const PIVOT_COLOR = "#64748b";
const sourceColor = d3.scaleOrdinal(d3.schemeTableau10);

// Sankey geometry. Columns are hops: selectors at hop d sit in column 2d, sources
// queried from hop d sit in column 2d+1.
const COLUMN_MIN = 84;
const COLUMN_MAX = 175;
const FLOW_MARGIN = { top: 36, right: 250, bottom: 10, left: 16 };

// Motion: nodes, ribbons and labels are keyed by id, so between steps persisting
// elements glide, new ones grow out of the root, and dropped ones fade out.
const MOTION_MS = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 700;


const linkPath = d3.sankeyLinkHorizontal();
const linkKey = (link) => `${link.source.id}>${link.target.id}`;
// Same id, for links from a snapshot's flow, whose ends are still node ids.
const linkIdOf = (link) => `${link.source}>${link.target}`;

const state = {
  snapshot: null,
  focusKey: null,
  step: null,
  busy: false,
  flow: null,
  narrationStep: null,
  wholeTree: false,
  showVerdict: false,
  revealed: 1,
  revealScope: null,
  // Everything shown so far in the current walkthrough, so each new step builds on it.
  shown: null,
};

const $ = (selector) => document.querySelector(selector);
const keyOf = (selector) => `${selector.type}:${selector.value}`;

// The focus is what the presenter last acted on. After a page reload there is no
// client-side focus, so fall back to the engine's last walkthrough step, then to
// the most recent pivot, then to the root.
function currentFocus(snapshot) {
  if (state.focusKey) return state.focusKey;
  if (snapshot.guided.last) return keyOf(snapshot.guided.last);
  return snapshot.findings[0]?.pivot ?? snapshot.root;
}

// The step the focus is on, if any. Survives a reload because the engine remembers the last step.
function activeStep(snapshot) {
  const step = state.step ?? snapshot.guided.last;
  return step && keyOf(step) === currentFocus(snapshot) ? step : null;
}

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "onclick") node.addEventListener("click", value);
    else if (key === "disabled") node.disabled = true;
    else node.setAttribute(key, value === true ? "" : value);
  }
  node.append(...children.flat().filter((child) => child !== null && child !== undefined && child !== false));
  return node;
}

function shorten(text, length = 24) {
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

// The investigation runs in the page. There is no server: the engine and the case data
// are plain scripts loaded before this one.
const investigation = new Investigation(CASE_DATA);

async function run(action) {
  if (state.busy) return;
  state.busy = true;
  $("#status").textContent = "";
  try {
    await action();
  } catch (error) {
    $("#status").textContent = error.message;
  } finally {
    state.busy = false;
    render();
  }
}

// Actions

function startFrom(root) {
  return run(() => {
    investigation.start(root);
    investigation.investigate(root);
    state.snapshot = investigation.snapshot();
    state.focusKey = keyOf(root);
    state.step = null;
  });
}

function pivot(node, source = null) {
  return run(() => {
    investigation.investigate(node, source);
    state.snapshot = investigation.snapshot();
    state.focusKey = node.key;
  });
}

function nextStep() {
  return run(() => {
    const { step } = investigation.guidedNext();
    state.snapshot = investigation.snapshot();
    state.step = step;
    if (step) state.focusKey = keyOf(step);
  });
}

function reset() {
  return run(() => {
    investigation.reset();
    state.snapshot = investigation.snapshot();
    state.step = null;
    state.focusKey = null;
    state.narrationStep = null;
    state.showVerdict = false;
    state.flow = null;
    state.shown = null;
    state.revealScope = null;
    state.revealed = 1;
    $("#flow").replaceChildren();
  });
}

function focusOn(key) {
  state.focusKey = key;
  render();
}

// Rendering

function render() {
  const snapshot = state.snapshot;
  if (!snapshot) return;
  renderHeader(snapshot);
  const started = snapshot.root !== null;
  $("#picker").hidden = started;
  $("#workspace").hidden = !started;
  if (!started) {
    renderPicker(snapshot);
    return;
  }
  $("#whole-tree").checked = state.wholeTree;
  renderFlow(snapshot);
  renderDetail(snapshot);
}

function renderHeader(snapshot) {
  const { applicant, guided, root } = snapshot;
  $("#applicant").textContent = `${applicant.name}, ${applicant.role}, ${applicant.company}. Stated location: ${applicant.stated_location}. Applied ${applicant.applied}.`;
  const complete = guided.index >= guided.total;
  $("#progress").textContent = root === null ? "Not started" : `Step ${guided.index} of ${guided.total}`;
  const nextBlocked = root !== null && !guided.available;
  $("#next").disabled = state.busy || complete || nextBlocked;
  $("#next").title = nextBlocked ? "The guided walkthrough starts from the application email" : "";
  $("#reset").disabled = state.busy || root === null;
  $("#guided-start").disabled = state.busy;
}

function renderPicker(snapshot) {
  const grid = $("#roots");
  grid.replaceChildren();
  for (const root of snapshot.roots) {
    grid.append(
      el(
        "button",
        { class: "root-card", type: "button", disabled: state.busy, onclick: () => startFrom(root) },
        el("span", { class: "type", text: root.type }),
        el("span", { class: "label", text: root.label || root.value }),
        el("span", { class: "mono", text: root.value }),
      ),
    );
  }
}

// Keep only what is directly related to the focused selector: the path from the
// root to it, and what it produced (its sources and the selectors they returned).
// Everything else is hidden. With "Show whole tree" on, nothing is filtered.
function focusFlows(flows, focusKey) {
  const focusId = `sel:${focusKey}`;
  if (!flows.nodes.some((node) => node.id === focusId)) {
    return { nodes: [], links: [], omitted: flows.omitted };
  }
  const keep = new Set([focusId]);
  const pending = [focusId];
  while (pending.length) {
    const id = pending.pop();
    for (const link of flows.links) {
      if (link.target === id && !keep.has(link.source)) {
        keep.add(link.source);
        pending.push(link.source);
      }
    }
  }
  for (const link of flows.links) {
    if (link.source !== focusId) continue;
    keep.add(link.target);
    for (const onward of flows.links) {
      if (onward.source === link.target) keep.add(onward.target);
    }
  }
  return {
    nodes: flows.nodes.filter((node) => keep.has(node.id)),
    links: flows.links.filter((link) => keep.has(link.source) && keep.has(link.target)),
    omitted: flows.omitted,
  };
}

function columnTitle(column) {
  if (column % 2 === 1) return "Sources";
  return column === 0 ? "Root" : `Hop ${column / 2}`;
}

// How much of the diagram is on screen. The presenter reveals it one column at a time,
// starting from the root. The full layout is always computed, so columns stay put as
// they appear.
function describeColumn(column) {
  if (column === 0) return "the root";
  if (column % 2 === 1) {
    const hop = (column - 1) / 2;
    return hop === 0 ? "sources queried from the root" : `sources queried from hop ${hop}`;
  }
  return `hop ${column / 2} selectors`;
}

function setRevealControls(revealed, columns) {
  $("#reveal-status").textContent = columns === 0 ? "" : `${revealed} of ${columns}: ${describeColumn(revealed - 1)}`;
  $("#reveal-back").disabled = revealed <= 1;
  $("#reveal-next").disabled = revealed >= columns;
  $("#reveal-all").disabled = revealed >= columns;
}

function moveReveal(delta) {
  if (!state.snapshot || state.snapshot.root === null) return;
  state.revealed += delta;
  render();
}

// A selector's label and value together, e.g. "Application phone (+1 555-0142)".
// Sources have no value and are shown by their label alone.
function nodeText(node, budget) {
  const value = node.key ? node.key.slice(node.key.indexOf(":") + 1) : null;
  if (!value) return shorten(node.label, budget);
  if (!node.label || node.label === value) return shorten(value, budget);
  // Keep the whole value where it is short (a phone number, a handle), and give the label the rest.
  const valueRoom = Math.min(value.length, Math.floor(budget / 2));
  const labelText = shorten(node.label, budget - valueRoom - 3);
  const valueText = shorten(value, budget - labelText.length - 3);
  return `${labelText} (${valueText})`;
}

function renderFlow(snapshot) {
  const container = $("#flow");
  const note = $("#flow-note");
  const focusKey = currentFocus(snapshot);
  const scope = state.wholeTree ? "whole tree" : focusKey;
  const whole = snapshot.flows;
  const current = state.wholeTree ? whole : focusFlows(whole, focusKey);
  const height = Math.max(360, container.clientHeight);

  if (current.links.length === 0) {
    note.textContent = "Run this selector's sources to draw what it leads to.";
    setRevealControls(0, 0);
    const focusNode = whole.nodes.find((node) => node.id === `sel:${focusKey}`) ?? whole.nodes.find((node) => node.column === 0);
    renderRootOnly(container, focusNode, height);
    return;
  }
  note.textContent = current.omitted
    ? `${current.omitted} confirmation link${current.omitted === 1 ? "" : "s"} between selectors already placed closer to the root are in the evidence but not drawn.`
    : "";

  const currentNodeIds = new Set(current.nodes.map((node) => node.id));
  const currentLinkIds = new Set(current.links.map(linkIdOf));

  // Follow-on: the walkthrough is cumulative. Earlier steps stay on screen, dimmed, and the
  // new step builds on them. The reveal starts at the first column the new step adds, so the
  // presenter steps through only what is new. The whole tree is not cumulative.
  if (state.revealScope !== scope) {
    if (state.wholeTree) {
      state.shown = null;
    } else if (state.shown === null) {
      // Opened mid-walkthrough: the engine already knows the earlier steps, so show them
      // dimmed and leave the current step to be revealed.
      state.shown = {
        nodes: new Set(whole.nodes.map((node) => node.id).filter((id) => !currentNodeIds.has(id))),
        links: new Set(whole.links.map(linkIdOf).filter((id) => !currentLinkIds.has(id))),
      };
    }
    const fresh = current.nodes.filter((node) => !state.shown?.nodes.has(node.id));
    state.revealScope = scope;
    state.revealed = fresh.length === 0 ? Infinity : Math.max(1, Math.min(...fresh.map((node) => node.column)));
  }

  // The universe is everything shown so far plus the current step. It is laid out in full,
  // so positions stay put as columns appear.
  const universeNodeIds = new Set([...(state.shown?.nodes ?? []), ...currentNodeIds]);
  const universeLinkIds = new Set([...(state.shown?.links ?? []), ...currentLinkIds]);
  const universeNodes = whole.nodes.filter((node) => universeNodeIds.has(node.id));
  const universeLinks = whole.links.filter((link) => universeLinkIds.has(linkIdOf(link)));
  const columns = Math.max(...universeNodes.map((node) => node.column)) + 1;
  state.revealed = Math.min(Math.max(state.revealed, 1), columns);
  setRevealControls(state.revealed, columns);

  const colWidth = Math.min(COLUMN_MAX, Math.max(COLUMN_MIN, (container.clientWidth - FLOW_MARGIN.left - FLOW_MARGIN.right) / columns));
  const width = Math.max(container.clientWidth, columns * colWidth + FLOW_MARGIN.left + FLOW_MARGIN.right);
  // Characters that fit beside a node, roughly. The newest column has the right margin
  // to write into, so its labels get the full width.
  const budget = Math.min(44, Math.max(16, Math.floor(colWidth / 6.2)));
  const lastShown = state.revealed - 1;
  const budgetFor = (node) => (node.column === lastShown ? 33 : budget);

  const graph = d3
    .sankey()
    .nodeId((node) => node.id)
    .nodeAlign((node) => node.column)
    .nodeWidth(14)
    .nodePadding(10)
    .extent([
      [FLOW_MARGIN.left, FLOW_MARGIN.top],
      [width - FLOW_MARGIN.right, height - FLOW_MARGIN.bottom],
    ])({
      nodes: universeNodes.map((node) => ({ ...node })),
      links: universeLinks.map((link) => ({ ...link })),
    });

  const shownBefore = state.shown ?? { nodes: new Set(), links: new Set() };
  const visibleNodes = graph.nodes.filter((node) => shownBefore.nodes.has(node.id) || node.column < state.revealed);
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  const visibleLinks = graph.links.filter((link) => visibleNodeIds.has(link.source.id) && visibleNodeIds.has(link.target.id));
  state.shown = state.wholeTree ? null : { nodes: visibleNodeIds, links: new Set(visibleLinks.map(linkKey)) };

  const flow = ensureFlowSvg(container, width, height);
  // Current-step elements are full strength; earlier ones are dimmed.
  const nodeOpacity = (node) => (currentNodeIds.has(node.id) ? 1 : 0.35);
  const linkOpacity = (link) => (currentLinkIds.has(linkKey(link)) ? 1 : 0.35);

  const titles = [...new Set(visibleNodes.map((node) => node.column))].map((column) => {
    const first = visibleNodes.filter((node) => node.column === column);
    return { column, x: Math.min(...first.map((node) => node.x0)), text: columnTitle(column) };
  });
  flow.titles
    .selectAll("text")
    .data(titles, (title) => title.column)
    .join(
      (enter) =>
        enter
          .append("text")
          .attr("class", "column-title")
          .attr("y", 18)
          .attr("x", (title) => title.x)
          .style("opacity", 0)
          .text((title) => title.text)
          .call((entering) => entering.transition().duration(MOTION_MS).style("opacity", 1)),
      (update) =>
        update
          .text((title) => title.text)
          .call((updating) => updating.transition().duration(MOTION_MS).attr("x", (title) => title.x)),
      (exit) => exit.remove(),
    );

  // Each ribbon takes the colour of the source it passes through.
  const sourceNodeOf = (link) => (link.source.kind === "source" ? link.source : link.target);
  const linkColor = (link) => sourceColor(sourceNodeOf(link).source);
  const linkWidth = (link) => Math.max(1, link.width);
  flow.links
    .selectAll("path")
    .data(visibleLinks, linkKey)
    .join(
      (enter) =>
        enter
          .append("path")
          .attr("class", "flow-link")
          .attr("d", linkPath)
          .attr("stroke", linkColor)
          .attr("stroke-width", linkWidth)
          .style("opacity", 0)
          .each(function () {
            // Dash the path to its full length, then animate the offset to zero so the ribbon draws itself.
            const length = this.getTotalLength();
            d3.select(this).attr("stroke-dasharray", `${length} ${length}`).attr("stroke-dashoffset", length);
          })
          .call((entering) => entering.append("title").text((link) => link.title ?? ""))
          .call((entering) =>
            entering
              .transition()
              .duration(MOTION_MS)
              .attr("stroke-dashoffset", 0)
              .style("opacity", linkOpacity)
              .on("end", function () {
                d3.select(this).attr("stroke-dasharray", null).attr("stroke-dashoffset", null);
              }),
          ),
      (update) => {
        update.select("title").text((link) => link.title ?? "");
        update.transition().duration(MOTION_MS).attr("d", linkPath).attr("stroke-width", linkWidth).style("opacity", linkOpacity);
        return update;
      },
      (exit) => exit.remove(),
    );

  // Selectors take their confidence colour; sources take their own colour.
  const nodeFill = (node) => (node.kind === "source" ? sourceColor(node.source) : CONFIDENCE_COLORS[node.confidence] ?? PIVOT_COLOR);
  const nodeClass = (node) =>
    ["flow-node", node.key ? "clickable" : "", node.ioc ? "ioc" : "", node.key && node.key === state.focusKey ? "selected" : ""]
      .filter(Boolean)
      .join(" ");
  const nodeTitle = (node) => `${node.label} (${node.kind}${node.confidence ? `, ${node.confidence}` : ""})${node.key ? ` ${node.key.slice(node.key.indexOf(":") + 1)}` : ""}`;
  const nodeGeometry = (selection) =>
    selection
      .attr("x", (node) => node.x0)
      .attr("y", (node) => node.y0)
      .attr("width", (node) => node.x1 - node.x0)
      .attr("height", (node) => Math.max(2, node.y1 - node.y0));
  // New nodes grow out of the root, so the tree visibly branches from it.
  const root = graph.nodes.find((node) => node.column === 0);
  flow.nodes
    .selectAll("rect")
    .data(visibleNodes, (node) => node.id)
    .join(
      (enter) =>
        enter
          .append("rect")
          .attr("x", root.x0)
          .attr("y", root.y0)
          .attr("width", 2)
          .attr("height", 2)
          .attr("fill", nodeFill)
          .attr("class", nodeClass)
          .style("opacity", 0)
          .call((entering) => entering.append("title").text(nodeTitle))
          .call((entering) =>
            entering.transition().duration(MOTION_MS).style("opacity", nodeOpacity).call(nodeGeometry),
          ),
      (update) => {
        update.attr("class", nodeClass).select("title").text(nodeTitle);
        update.transition().duration(MOTION_MS).call(nodeGeometry).attr("fill", nodeFill).style("opacity", nodeOpacity);
        return update;
      },
      (exit) => exit.remove(),
    )
    .on("click", (_event, node) => {
      if (node.key) focusOn(node.key);
    });

  flow.labels
    .selectAll("text")
    .data(visibleNodes, (node) => node.id)
    .join(
      (enter) =>
        enter
          .append("text")
          .attr("class", "node-label")
          .attr("dy", "0.35em")
          .attr("x", root.x1 + 8)
          .attr("y", root.y0)
          .style("opacity", 0)
          .text((node) => nodeText(node, budgetFor(node)))
          .call((entering) =>
            entering
              .transition()
              .duration(MOTION_MS)
              .style("opacity", nodeOpacity)
              .attr("x", (node) => node.x1 + 8)
              .attr("y", (node) => (node.y0 + node.y1) / 2),
          ),
      (update) =>
        update.text((node) => nodeText(node, budgetFor(node))).call((updating) =>
          updating
            .transition()
            .duration(MOTION_MS)
            .style("opacity", nodeOpacity)
            .attr("x", (node) => node.x1 + 8)
            .attr("y", (node) => (node.y0 + node.y1) / 2),
        ),
      (exit) => exit.remove(),
    );
}

// The SVG and its layers persist between renders, so transitions have something to
// animate from. They are only recreated after a root-only state.
function ensureFlowSvg(container, width, height) {
  if (state.flow) {
    state.flow.svg.attr("width", width).attr("height", height);
    return state.flow;
  }
  container.replaceChildren();
  const svg = d3.select(container).append("svg").attr("width", width).attr("height", height).attr("role", "presentation");
  state.flow = {
    svg,
    titles: svg.append("g"),
    links: svg.append("g").attr("fill", "none"),
    nodes: svg.append("g"),
    labels: svg.append("g"),
  };
  return state.flow;
}

// Before anything is pivoted there are no links to lay out, so draw the selector as
// a single clickable card.
function renderRootOnly(container, node, height) {
  state.flow = null;
  container.replaceChildren();
  if (!node) return;
  const width = Math.max(container.clientWidth, 480);
  const cardWidth = 300;
  const cardHeight = 56;
  const x = FLOW_MARGIN.left;
  const y = height / 2 - cardHeight / 2;
  const svg = d3.select(container).append("svg").attr("width", width).attr("height", height).attr("role", "presentation");
  svg.append("text").attr("class", "column-title").attr("x", x).attr("y", y - 12).text(node.column === 0 ? "Root" : "Selector");
  svg
    .append("rect")
    .attr("class", "flow-node clickable")
    .attr("x", x)
    .attr("y", y)
    .attr("width", cardWidth)
    .attr("height", cardHeight)
    .attr("rx", 10)
    .attr("fill", CONFIDENCE_COLORS[node.confidence] ?? PIVOT_COLOR)
    .attr("opacity", 0.85)
    .on("click", () => node.key && focusOn(node.key));
  svg
    .append("text")
    .attr("class", "anchor-label")
    .attr("x", x + 16)
    .attr("y", y + cardHeight / 2)
    .attr("dy", "0.35em")
    .text(node.label);
}

function stepHeading(step, index, total) {
  return el(
    "header",
    { class: "step-head" },
    el("p", { class: "eyebrow", text: `Step ${index} of ${total} · ${step.concept}` }),
    el("h2", { text: step.title }),
    el("p", { class: "narration", text: step.narration }),
  );
}

function selectorHeading(node) {
  const note = node.anchor
    ? "The root. Everything in this investigation hangs off this selector."
    : node.investigated
      ? "Its sources have been run. Evidence and leads are below."
      : "Not run yet. Run its sources to see what it leads to.";
  return el(
    "header",
    { class: "step-head" },
    el("p", { class: "eyebrow", text: node.anchor ? "Root selector" : "Selector" }),
    el("h2", { text: node.label }),
    el("p", { class: "narration muted", text: note }),
  );
}

function selectorCard(node, snapshot) {
  return el(
    "section",
    { class: "selector-card" },
    el("p", { class: "mono", text: node.value }),
    el(
      "div",
      { class: "tags" },
      el("span", { class: `tag ${node.confidence}`, text: node.confidence }),
      el("span", { class: "tag", text: node.type }),
      node.ioc ? el("span", { class: "tag ioc", text: "advisory IOC" }) : null,
    ),
    el(
      "div",
      { class: "tags" },
      el("button", { class: "primary small-btn", type: "button", disabled: state.busy, onclick: () => pivot(node) }, "Run all sources"),
    ),
  );
}

function sourcesSection(node, snapshot) {
  const accepting = snapshot.sources.filter((source) => source.types.includes(node.type));
  const ran = new Map(snapshot.searched.filter((item) => item.pivot === node.key).map((item) => [item.source, item.returned]));
  return el(
    "section",
    null,
    el("h3", { text: "Data sources" }),
    accepting.length === 0
      ? el("p", { class: "muted-note", text: "No source accepts this type of selector." })
      : accepting.map((source) => {
          const returned = ran.get(source.name);
          return el(
            "div",
            { class: "source-row" },
            el("span", {}, source.label),
            returned === undefined
              ? el("button", { class: "small-btn", type: "button", disabled: state.busy, onclick: () => pivot(node, source.name) }, "Query")
              : el("span", { class: "muted small", text: `${returned} record${returned === 1 ? "" : "s"} returned` }),
          );
        }),
  );
}

function evidenceCard(finding) {
  return el(
    "article",
    { class: `finding ${finding.attribution}` },
    el(
      "div",
      { class: "head" },
      el("span", { text: finding.source_label }),
      el("span", { class: `tag ${finding.attribution === "strong" ? "high" : "low"}`, text: finding.attribution }),
    ),
    el("p", { class: "title", text: finding.title }),
    el("p", { class: "body", text: finding.detail }),
    finding.media.length
      ? el(
          "div",
          { class: "media" },
          finding.media.map((item) =>
            el("figure", {}, el("img", { src: item.src, alt: item.caption, loading: "lazy" }), el("figcaption", { text: item.caption })),
          ),
        )
      : null,
  );
}

function evidenceSection(node, snapshot) {
  // Findings arrive newest first; show them in the order they were collected.
  const items = snapshot.findings.filter((finding) => finding.pivot === node.key).reverse();
  return el(
    "section",
    null,
    el("h3", { text: `Evidence collected (${items.length})` }),
    items.length === 0
      ? el("p", { class: "muted-note", text: "Nothing collected from this selector yet." })
      : items.map(evidenceCard),
  );
}

function leadsSection(node, snapshot) {
  const returned = new Set(snapshot.findings.filter((finding) => finding.pivot === node.key).flatMap((finding) => finding.returns));
  const leads = snapshot.nodes.filter((candidate) => returned.has(candidate.key) && !candidate.investigated);
  if (leads.length === 0) return null;
  return el(
    "section",
    null,
    el("h3", { text: "Leads to pursue" }),
    el(
      "div",
      { class: "leads" },
      leads.map((lead) => el("button", { class: "chip", type: "button", disabled: state.busy, onclick: () => pivot(lead) }, lead.label)),
    ),
  );
}

// The verdict belongs to the end of the walkthrough, so it appears on the final step.
// In manual mode it is available on request.
function verdictSection(snapshot, step) {
  const complete = snapshot.guided.index >= snapshot.guided.total;
  const onFinalStep = complete && step !== null;
  if (!onFinalStep && !state.showVerdict) {
    if (step !== null || snapshot.guided.index > 0 || snapshot.findings.length === 0) return null;
    return el(
      "section",
      null,
      el("button", { class: "small-btn", type: "button", onclick: () => { state.showVerdict = true; render(); } }, "Show verdict so far"),
    );
  }
  const verdict = snapshot.verdict;
  const list = (items, empty) =>
    el("ul", { class: "plain" }, items.length ? items.map((item) => el("li", { text: item })) : el("li", { class: "muted small", text: empty }));
  return el(
    "section",
    { class: `band ${verdict.band}` },
    el("p", { class: "eyebrow", text: `Risk ${verdict.score}/100` }),
    el("h2", { text: verdict.headline }),
    el("div", { class: "bar" }, el("div", { class: "bar-fill", style: `width: ${verdict.score}%` })),
    el("h3", { text: "Corroborated" }),
    list(verdict.corroborated, "Nothing corroborated yet."),
    el("h3", { text: "Advisory hits" }),
    list(verdict.ioc_hits, "No advisory hits."),
    el("h3", { text: "Recommended actions" }),
    list(verdict.recommendations, ""),
  );
}

function renderDetail(snapshot) {
  const container = $("#detail");
  container.replaceChildren();
  const focusKey = currentFocus(snapshot);
  const node = snapshot.nodes.find((candidate) => candidate.key === focusKey);
  if (!node) {
    container.append(el("p", { class: "muted", text: "Select a selector in the flow to see its details." }));
    return;
  }

  // Heading: the current step while the focus is on it, otherwise the selector itself.
  const step = activeStep(snapshot);
  const heading = step
    ? stepHeading(step, snapshot.guided.index, snapshot.guided.total)
    : selectorHeading(node);
  const stepId = step ? `${snapshot.guided.index}:${keyOf(step)}` : null;
  if (step && state.narrationStep !== stepId) {
    state.narrationStep = stepId;
    heading.animate(
      [
        { opacity: 0, transform: "translateY(6px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: MOTION_MS, easing: "ease-out" },
    );
  }

  const sections = [
    heading,
    selectorCard(node, snapshot),
    sourcesSection(node, snapshot),
    evidenceSection(node, snapshot),
    leadsSection(node, snapshot),
    verdictSection(snapshot, step),
  ];
  container.append(...sections.filter(Boolean));
}

// Wiring

$("#next").addEventListener("click", nextStep);
$("#reset").addEventListener("click", reset);
$("#guided-start").addEventListener("click", nextStep);
$("#reveal-back").addEventListener("click", () => moveReveal(-1));
$("#reveal-next").addEventListener("click", () => moveReveal(1));
$("#reveal-all").addEventListener("click", () => moveReveal(Infinity));
document.addEventListener("keydown", (event) => {
  if (event.target.closest("input, textarea, select")) return;
  if (event.key === "ArrowRight") moveReveal(1);
  if (event.key === "ArrowLeft") moveReveal(-1);
});
$("#whole-tree").addEventListener("change", (event) => {
  state.wholeTree = event.target.checked;
  render();
});

let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (state.snapshot && state.snapshot.root !== null) renderFlow(state.snapshot);
  }, 150);
});

run(() => {
  state.snapshot = investigation.snapshot();
});
