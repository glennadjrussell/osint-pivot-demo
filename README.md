# OSINT pivot demo: catching a DPRK IT-worker applicant

A live, self-contained teaching app that runs entirely in the browser. There is no server. It walks an analyst through an open-source investigation of a job applicant who is in fact a DPRK-linked IT worker. You pivot from one selector to the next, check whether sources agree, and reach a verdict.

**All data is fictional.** Names, handles, domains (`.example`), IPs (RFC 5737 ranges), wallets and images are invented. The app makes no network calls.

## Run it

Open `static/index.html` in a browser. Nothing needs installing: the diagram library and the investigation engine are included, and the case data is loaded from a plain script.

Run the engine tests with Node (no packages to install):

```bash
node --test tests/engine.test.js
```

To change the case, edit `data/case.json` and regenerate the script the page loads:

```bash
node scripts/build-case.js
```

The test suite checks that `static/case.js` matches `data/case.json`, so a stale build fails the tests.

## Using the demo

- **Start**: choose one of the identifiers the application supplied as the root. Everything else hangs off it. Or run the guided walkthrough, which starts from the application email.
- **Guided** (Next step): runs a scripted sequence of 13 pivots. The heading on the right says what the current step is doing and why it matters.
- **Manual**: click a lead, or run the sources on any selector. Each selector shows the data sources that accept it, what each returned, and the evidence collected from it.
- **Start over**: returns to the start screen.

The screen is split in half. The left half is the pivot flow. The right half is the detail for the focused selector. The diagram shows only what is directly related to the focus: the path from the root and what the focus produced. Tick **Show whole tree** to see everything. The verdict appears on the final guided step, or on request during manual work.

## Evidence photos

The headshot evidence shows two placeholder silhouettes, in `static/evidence/`. They are not photos of real people, and they should stay that way in the repository. To use staged images for a live session, replace the files with the same names, or change the `media` entries in `data/case.json`. Only use images you have the right to show.

## Reading the Sankey

Everything starts from one anchor: the application email. Each hop reads left to right as selector, then the source it was queried through, then the selectors that source returned. The application pack is the first source, so the applicant's own identifiers become hop 1. Ribbon width counts links found, and ribbons are coloured by source.

Corroboration is where ribbons meet at one selector. The commit alias, for example, is reached through GitHub and through WHOIS, both at hop 1. A link that points back to a selector already nearer the anchor cannot be drawn left to right. The diagram notes how many such links there are, and they remain in the evidence log.

Click any selector in the diagram to focus it. The right half then shows its sources, evidence and leads.

The diagram is revealed one column at a time, under presenter control. It opens on the root alone. **Reveal next** (or the right arrow key) adds the next column: first the sources queried from the root, then the selectors they returned, then the next hop. **Back** and **Show all** move the other way. The walkthrough is cumulative. When a new step runs, the earlier steps stay on screen but dimmed, and the reveal picks up at the first column the new step adds. Choosing a different selector in the diagram behaves the same way. **Start over** clears the diagram. Because the diagram keeps the whole story, it can grow wider than the left half of the screen in the later steps. It then scrolls sideways. Labels show the selector's value alongside its name, for example `Application phone (+1 555-0142)`. The full value is in the tooltip. Between steps the diagram animates in place. Persisting selectors and ribbons glide to their new positions, new nodes grow out of the anchor, and dropped nodes fade out. The narration and newest evidence card also ease in. Motion is disabled when the operating system asks for reduced motion.

## Concepts shown

| Concept | Where it appears |
| --- | --- |
| Selector | Every identifier the applicant supplied is a starting point |
| Anchor | One selector everything hangs off; the application pack is the first hop |
| Pivot | Gravatar hash to GitHub; SSH key to second account |
| Corroboration | The alias is "high" confidence only once two independent sources agree |
| Weak link / false positive | A shared coworking-space IP stays "low" and is excluded from the verdict |
| Victim identification | The headshot belongs to a real, unrelated engineer |
| Infrastructure clustering | A shared nameserver reveals three career sites |
| Attribution | The payroll wallet and the advisory-tagged wallet lead to the same cluster |

## Layout

- `data/case.json`: the seeded fictional internet (anchor, records, sources and advisory indicators)
- `static/engine.js`: the investigation engine. Pivoting from the root, hop distances, confidence, Sankey flow data and the verdict. It queries the case data in place of live sources, so a live source would be a new function here.
- `static/case.js`: the case data, generated from `data/case.json` by `scripts/build-case.js`
- `static/guided-steps.js`: the scripted walkthrough and narration
- `static/app.js`: the user interface, which renders the engine's snapshots
- `static/index.html` and `static/style.css`: the page
- `static/vendor/`: d3 and d3-sankey, included so the diagram works offline
- `static/evidence/`: placeholder images for the evidence
- `tests/engine.test.js`: engine tests, run with Node
