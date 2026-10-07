#!/usr/bin/env node
// strip-e2e.mjs — e2e test of the templatized affordances ("the strip") built into
// the fold's surface (index.html) and the topics search + pager.
//
//   node strip-e2e.mjs            # headed, drives http://127.0.0.1:8813/index.html
//   node strip-e2e.mjs --headless # same, but no visible window
//   node strip-e2e.mjs --hold 0   # close the browser immediately after the run
//
// The run seeds a small corpus (7 pairs of sources, each pair restating a claim) so
// topics exist, then exercises:
//   · the strip chips   Sources ▦ / Segment ⑃ / Read as ◫  (scope · EOQL · perspective)
//   · the topics rail    search + pager
// Screenshots land in .thumbnail/holodeck-test/.
import { openSurface } from "./drive-holodeck.mjs";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, ".thumbnail", "holodeck-test");
const URL = process.env.FOLD_URL || "http://127.0.0.1:8813/index.html";

// 7 pairs; each pair RESTATES one claim (an echo — identical sentences are excluded from
// echo by the engine, so a claim must be re-worded). Vocabulary is kept per-pair so the
// paradigm finder keeps the pairs as separate topics (echoes need 2 shared topic words).
const PAIRS = [
  { t1: "Bridge survey findings", t2: "Bridge survey dispute", year: 2026, pub: "Metro Daily", a: "The bridge survey found 41 cracks in the deck. Engineer Dana Ellis led the inspection. The girders showed new spalling under the load. Repairs were estimated at 12 million dollars. Crews closed two lanes in March. The span reopened in June.", b: "The bridge survey counted 41 cracks in the deck. Dana Ellis oversaw the inspection. Spalling on the girders grew after the frost. Repairs were estimated at 12 million dollars. Two lanes stayed closed into April. The span reopened in June." },
  { t1: "Police overtime budget", t2: "Overtime vote fallout", year: 2025, pub: "City Council Minutes", a: "The finance committee approved a 9 million overtime appropriation. Council member Rhea Sampson voted against it. The tally came to 12 to 3. Officers logged 4,000 overtime hours last year. The mayor defended the figure. Next year the department wants more.", b: "The finance committee passed a 9 million overtime appropriation. Rhea Sampson cast the dissenting vote. The tally stood at 12 to 3. Overtime hours topped 4,000 last year. The mayor backed the number. The department asked for a larger sum next year." },
  { t1: "Superintendent hire", t2: "Parents question salary", year: 2026, pub: "School Board Records", a: "The school board hired Carmen Velez as the new superintendent. The contract paid 240 thousand a year. Enrollment had fallen by 8 percent. Teachers applauded the choice. Two classrooms stayed shuttered this term. The principal welcomed the fresh start.", b: "Carmen Velez was hired by the school board to run the district. Her contract paid 240 thousand a year. Enrollment had fallen by 8 percent. Teachers praised the appointment. The shuttered classrooms reopened in the fall. The new principal backed the change." },
  { t1: "Light rail cancelled", t2: "Riders protest the cut", year: 2025, pub: "Transit Authority Press", a: "The transit authority cancelled the 14th Avenue light rail line. The decision followed a 6 month review. Riders packed the corridor hearing in March. Passengers argued the fares would rise. The line's stations were to open in 2028.", b: "The 14th Avenue light rail line was cancelled by the transit authority. The review dragged on for 6 months. Riders crowded the corridor hearing in March. Passengers warned fares would climb. The 2028 stations never opened." },
  { t1: "St Agnes beds cut", t2: "Hospital budget squeeze", year: 2024, pub: "Health Journal", a: "St. Agnes Hospital cut 120 beds this year. The chief executive Philip North blamed falling reimbursements. The hospital posted 15 million in losses. Nurses said two wards were shuttered. The union organized a petition. Patients faced longer waits.", b: "St. Agnes Hospital eliminated 120 beds this year. Philip North, the chief executive, blamed falling reimbursements. The losses came to 15 million. Two wards closed despite the union's petition. Nurses warned waits would lengthen. The hospital promised to reopen the wards." },
  { t1: "Utility rate increase", t2: "Commissioner dissent", year: 2026, pub: "Energy Wire", a: "The public utilities board approved a rate increase of 6.5 percent. Commissioner Drew Talbert filed a dissent. The increase adds 22 dollars to the average bill. Consumers complained about the timing. The board cited grid upgrades. A refund was ordered for overpayments.", b: "A 6.5 percent rate increase was approved by the public utilities board. Drew Talbert filed a formal dissent. The average bill rises 22 dollars. Consumers called the timing unfair. The board pointed to grid upgrades. Overpayments drew a refund order." },
  { t1: "Mill district rezoning", t2: "Rezoning referendum", year: 2025, pub: "Planning Commission Docket", a: "The planning commission rezoned the old mill district for housing. The vote passed 8 to 1. The plan would add 600 units. Warehouses would become apartments. Existing tenants worried about rent. The ballot question was certified in July.", b: "The old mill district was rezoned for housing by the planning commission. The vote passed 8 to 1. The plan would add 600 units. The warehouses would turn into apartments. Tenants worried about the new rent. The ballot question won certification in July." },
  { t1: "Health director named", t2: "Health director duties", year: 2026, pub: "County Health Record", a: "Dr. Amara Osei replaced Dr. Luis Campos as health director. The department will hire 30 inspectors. A clinic on 5th Street will stay open. The board approved the hiring plan.", b: "Dr. Luis Campos stepped aside for Dr. Amara Osei as health director. Thirty inspectors will be hired this season. The 5th Street clinic stays open. The board approved the hiring plan." },
  { t1: "Wharf stake sold", t2: "Wharf redevelopment", year: 2025, pub: "Port Ledger", a: "Harold Pike sold the Wharf Company, the dockland cranes, and the pier leases to Lena Ortiz. The sale cleared 3 thousand per crane. The dockland redevelopment moved ahead. Pike blamed the new zoning rules. The port authority took no action.", b: "Lena Ortiz bought the pier leases and the dockland cranes when she acquired the Wharf Company from Harold Pike. Each crane drew 3 thousand at sale. The dockland redevelopment advanced. Pike cited the new zoning rules. The port authority stayed silent." },
];

const docs = PAIRS.flatMap((p, i) => [
  { id: "seed" + i + "a", title: p.t1, year: p.year, type: "Text", format: "text", text: p.a, status: "source", publisher: p.pub },
  { id: "seed" + i + "b", title: p.t2, year: p.year, type: "Text", format: "text", text: p.b, status: "source", publisher: p.pub },
]);
const N = docs.length;

let pass = 0, fail = 0;
const ok = (cond, name, extra) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${extra ? " — " + extra : ""}`); } };
const step = n => console.log(`\n── ${n} ──`);

const shot = async (surf, name) => { const f = await surf.shot("strip-" + name); console.log(`  [shot] ${path.basename(f)}`); return f; };

async function main() {
  const headless = process.argv.includes("--headless");
  const holdIdx = process.argv.indexOf("--hold");
  const hold = holdIdx >= 0 ? Number(process.argv[holdIdx + 1] ?? 0) : 0;
  const surf = await openSurface({ headless, url: URL });
  const page = surf.page;
  try {
    await surf.settle(3000);
    console.log(`[strip] opened ${URL} (headless=${headless})`);

    // ── seed the corpus and reload so the app analyzes it ──
    await page.evaluate((docs) => {
      try { localStorage.removeItem("fold-explorer-added"); } catch (e) {}
      try { localStorage.setItem("holodeck-purged-legacy", "1"); } catch (e) {}
      localStorage.setItem("fold-explorer-added", JSON.stringify({ custom: docs }));
      localStorage.setItem("fold-explorer-srcmeta", JSON.stringify({ custom: {} }));
    }, docs);
    await page.reload({ waitUntil: "domcontentloaded" });
    await surf.settle(8000);

    // ── diagnostic: how many paradigm groups formed ──
    const groups = await page.evaluate(() => {
      try { const A = window.__holodeckA; if (!A) return null; return window.__holodeck.paradigms(A).groups.map(g => ({ label: g.label, n: g.n })); } catch (e) { return String(e); }
    });
    console.log("[strip] paradigm groups:", JSON.stringify(groups));
    ok(Array.isArray(groups) && groups.length >= 1, "paradigm groups formed", groups ? groups.length + " groups" : "none");

    // ── the strip chips render ──
    step("strip chips present");
    const chips = await page.evaluate(() => [...document.querySelectorAll("button")].filter(b => /[▦⑃◫]/.test(b.innerText)).map(b => b.innerText.replace(/\s+/g, " ").trim()));
    console.log("  chips:", JSON.stringify(chips));
    ok(chips.length === 3, "three strip chips (▦ Sources, ⑃ Segment, ◫ Read as)");

    const chip = g => page.locator("button", { hasText: g }).first();
    const chipText = async g => (await chip(g).innerText()).replace(/\s+/g, " ").trim();
    await shot(surf, "01-summary-with-strip");
    console.log(`  sources chip: "${await chipText("▦")}"`);
    console.log(`  segment chip: "${await chipText("⑃")}"`);
    ok(new RegExp("All " + N + " sources").test(await chipText("▦")), "sources chip says 'All " + N + " sources'", await chipText("▦"));
    ok(new RegExp(N + " of " + N).test(await chipText("⑃")), "segment chip says '" + N + " of " + N + "'", await chipText("⑃"));

    // ── topics rail: search + pager ──
    step("topics rail: search + pager");
    const topicsInRail = () => page.evaluate(() => {
      const span = [...document.querySelectorAll("span")].find(s => s.textContent.trim() === "Topics");
      if (!span) return null;
      const panel = span.parentElement;
      const btns = [...panel.querySelectorAll("button")].map(b => b.innerText.replace(/\s+/g, " ").trim()).filter(t => /^.+ \d+$/.test(t) && !/^Not in any topic/.test(t));
      const pager = [...panel.querySelectorAll("span")].map(s => s.textContent.trim()).find(t => /^\d+ of \d+$/.test(t)) || null;
      const search = !!panel.querySelector('input[placeholder="Filter topics…"]');
      return { btns, pager, search };
    });
    const T = await topicsInRail();
    console.log("  topics:", JSON.stringify(T));
    ok(T && T.btns.length >= 1, "topics listed in the rail", T ? T.btns.length + " buttons" : "no Topics panel");
    ok(T && T.search, "topics search input rendered");
    const wantPages = Array.isArray(groups) ? Math.ceil(Math.max(1, groups.length) / 6) : 1;
    if (wantPages > 1) {
      ok(T && T.pager === "1 of " + wantPages, `pager shows '1 of ${wantPages}' (${groups.length} groups, 6 per page)`, String(T && T.pager));
    } else {
      console.log(`  (only ${groups.length} topic group(s) — pager not asserted; needs 7+)`);
    }

    if (T && T.btns.length && T.search) {
      const label = T.btns[0].replace(/ \d+$/, "");
      const needle = label.split(" ")[0];
      const filter = page.locator('input[placeholder="Filter topics…"]').first();
      await filter.fill(needle);
      await surf.settle(1200);
      const T1 = await topicsInRail();
      console.log(`  search "${needle}" → ${T1.btns.length} topic(s):`, JSON.stringify(T1.btns));
      ok(T1.btns.length >= 1 && T1.btns.length < T.btns.length, "search narrows the topic list", `${T.btns.length} → ${T1.btns.length}`);
      await shot(surf, "02-topics-search");
      await filter.fill("");
      await surf.settle(1000);
      const T2 = await topicsInRail();
      ok(T2.btns.length === T.btns.length, "clearing search restores the topic list", `${T2.btns.length} vs ${T.btns.length}`);
    }

    if (T && T.pager && /^1 of \d+$/.test(T.pager)) {
      const next = page.locator("button", { hasText: "›" }).first();
      await next.click();
      await surf.settle(1200);
      const T1 = await topicsInRail();
      console.log("  pager after next:", T1.pager);
      const lastPage = "2 of " + (T.pager.split(" of ")[1]);
      ok(T1.pager === lastPage, "pager advances to the next page", String(T1.pager));
      await shot(surf, "03-topics-page2");
      await page.locator("button", { hasText: "‹" }).first().click();
      await surf.settle(1000);
    }

    // ── Sources chip: open, scope a source ──
    step("Sources ▦ — scope the admitted sources");
    await chip("▦").click();
    await surf.settle(1200);
    const srcRows = await page.evaluate(() => {
      const pop = [...document.querySelectorAll("div")].find(d => /Sources the gate · click to scope/.test(d.textContent) && d.offsetParent);
      if (!pop) return null;
      const panel = pop.parentElement;
      return [...panel.querySelectorAll("button")].map(b => b.innerText.replace(/\s+/g, " ").trim()).filter(t => / stmts$/.test(t) || t === "All sources" || t.startsWith("All sources "));
    });
    console.log("  sources popover rows:", JSON.stringify(srcRows));
    ok(Array.isArray(srcRows) && srcRows.length >= 2, "sources popover lists the sources", srcRows ? srcRows.length + " rows" : "no popover");
    await shot(surf, "04-sources-popover");

    if (Array.isArray(srcRows) && srcRows.length >= 3) {
      const lastTitle = srcRows[srcRows.length - 1].replace(/ Text.*/, "");
      const before = await chipText("▦");
      const toggled = await page.evaluate(() => {
        const pop = [...document.querySelectorAll("div")].find(d => /Sources the gate · click to scope/.test(d.textContent) && d.offsetParent);
        const panel = pop.parentElement;
        const rows = [...panel.querySelectorAll("button")].filter(b => / stmts$/.test(b.innerText));
        rows[rows.length - 1].click();
        return rows[rows.length - 1].innerText.replace(/\s+/g, " ").trim();
      });
      await surf.settle(1200);
      const after = await chipText("▦");
      console.log(`  toggled off "${lastTitle}" → "${before}" → "${after}"`);
      ok(new RegExp((N - 1) + " of " + N).test(after), "scoping one source out narrows to '" + (N - 1) + " of " + N + " sources'", after);
      await shot(surf, "05-sources-scoped");
      // toggle it back on so later steps start from all sources
      await page.evaluate(() => {
        const pop = [...document.querySelectorAll("div")].find(d => /Sources the gate · click to scope/.test(d.textContent) && d.offsetParent);
        const panel = pop.parentElement;
        const rows = [...panel.querySelectorAll("button")].filter(b => / stmts$/.test(b.innerText));
        rows[rows.length - 1].click();
      });
      await surf.settle(1000);
      ok(new RegExp("(All " + N + " sources|" + N + " of " + N + " sources)").test(await chipText("▦")), "re-adding restores all sources", await chipText("▦"));
    }
    await page.keyboard.press("Escape");
    await surf.settle(600);

    // ── Segment chip: EOQL in polish, glyphs out ──
    step("Segment ⑃ — EOQL with glyphs");
    await chip("⑃").click();
    await surf.settle(1000);
    const eoql = page.locator('input[placeholder^="SEG(sources)"]').first();
    const hasEO = await eoql.count().then(n => n > 0);
    ok(hasEO, "EOQL input rendered");
    if (hasEO) {
      await eoql.fill("EVA(publisher contains Metro Daily)");
      await surf.settle(900);
      const glyphs = await page.evaluate(() => { const el = [...document.querySelectorAll("div")].find(d => d.textContent.includes("⊨") && d.textContent.includes("publisher")); return el ? el.textContent.replace(/\s+/g, " ").trim() : null; });
      console.log("  glyph line:", glyphs);
      ok(!!glyphs && glyphs.includes("⊨"), "EOQL renders glyphs (EVA → ⊨)", String(glyphs));
      await shot(surf, "06-segment-eoql-glyphs");
      await page.keyboard.press("Enter");
      await surf.settle(1500);
      const lab = await chipText("▦");
      console.log(`  after Apply EOQL → sources chip: "${lab}"`);
      ok(new RegExp("2 of " + N).test(lab), "EOQL filter narrows scope to the 2 Metro Daily sources", lab);
      const seg = await chipText("⑃");
      ok(new RegExp("2 of " + N).test(seg), "segment chip reflects the narrowed scope", seg);
      await shot(surf, "07-segment-eoql-applied");
      // group chips: by year
      const byYear = page.locator("button", { hasText: "by year" }).first();
      if (await byYear.count().then(n => n > 0)) {
        await byYear.click();
        await surf.settle(1000);
        const segLab = await chipText("⑃");
        console.log(`  group by year → segment chip: "${segLab}"`);
        ok(/by year/.test(segLab), "segment grouping chip works", segLab);
        await shot(surf, "07b-segment-by-year");
      }
      const clear = page.locator("button", { hasText: "clear" }).first();
      await clear.click();
      await surf.settle(1200);
      ok(new RegExp("All " + N + " sources").test(await chipText("▦")), "clear restores all sources", await chipText("▦"));
    }
    await page.keyboard.press("Escape");
    await surf.settle(600);

    // ── Read as ◫ — what × where × scale ──
    step("Read as ◫ — the templated perspective");
    await chip("◫").click();
    await surf.settle(1000);
    const ro = await page.evaluate(() => [...document.querySelectorAll("button")]
      .filter(b => b.offsetParent && /^(Cut|Link|Make|Things|Links|Meanings|Background|Figure|Pattern)$/.test(b.innerText.trim()))
      .map(b => b.innerText.trim()));
    console.log("  read-as options:", JSON.stringify(ro));
    ok(ro.includes("Cut") && ro.includes("Link") && ro.includes("Make"), "mode row: Cut / Link / Make", JSON.stringify(ro));
    ok(ro.includes("Things") && ro.includes("Links") && ro.includes("Meanings"), "domain row: Things / Links / Meanings");
    ok(ro.includes("Background") && ro.includes("Figure") && ro.includes("Pattern"), "grain row: Background / Figure / Pattern");
    const readLabel = async () => page.evaluate(() => { const els = [...document.querySelectorAll("div")].filter(d => /terrain .* stance/.test(d.textContent) && d.textContent.length < 200); const el = els[els.length - 1]; if (!el) return null; const prev = el.previousElementSibling; return (prev ? prev.textContent.replace(/\s+/g, " ").trim() : "") + " || " + el.textContent.replace(/\s+/g, " ").trim(); });
    console.log("  read-as label:", await readLabel());
    await shot(surf, "08-read-as-open");

    const pick = async (txt) => { const b = page.locator("button", { hasText: txt }).first(); await b.click(); await surf.settle(900); };
    await pick("Cut");
    console.log("  after mode Cut:", await readLabel(), "| chip:", await chipText("◫"));
    ok(/Deconstructing/.test(await chipText("◫")), "mode switch changes the read-as label", await chipText("◫"));
    await shot(surf, "09-read-as-cut");
    await pick("Things");
    console.log("  after domain Things:", await readLabel(), "| chip:", await chipText("◫"));
    await pick("Background");
    console.log("  after grain Background:", await readLabel(), "| chip:", await chipText("◫"));
    ok(/Emptying Voids/.test(await chipText("◫")), "grain switch resolves the full vocabulary label", await chipText("◫"));
    await shot(surf, "10-read-as-voids");
    await page.keyboard.press("Escape");
    await surf.settle(600);

    // final state
    step("final");
    await shot(surf, "11-final");

    if (surf.consoleErrors.length) {
      console.log(`\n[strip] ${surf.consoleErrors.length} console errors/warnings (reported, not counted):`);
      surf.consoleErrors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
    } else {
      console.log("\n[strip] no console errors or warnings");
    }
    if (surf.badResponses.length) { console.log(`[strip] ${surf.badResponses.length} HTTP >=400:`); surf.badResponses.forEach(e => console.log("  · " + e)); }
    if (surf.failedRequests.length) { console.log(`[strip] ${surf.failedRequests.length} failed requests:`); surf.failedRequests.forEach(e => console.log("  · " + e)); }

    writeFileSync(path.join(OUT, "strip-report.txt"), `pass=${pass} fail=${fail}\n`);
    console.log(`\n[strip] RESULT: ${pass} passed, ${fail} failed`);

    if (hold === 0) return;
    const ms = hold === -1 ? 60_000 : hold;
    console.log(`\n[strip] holding the browser open ${ms}ms — watch it live`);
    await surf.page.waitForTimeout(ms);
  } finally {
    await surf.close();
  }
}

main().catch(e => { console.error(`[strip] fatal: ${e.message}`); process.exit(1); });