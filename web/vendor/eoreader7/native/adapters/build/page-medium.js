// adapters/build/page-medium.js — the page as a MEDIUM of the one build
// pipeline (organs/talk-build.js): only what makes a page a page. The core
// reads the request, sources each part, hears it, reasons over the record,
// and checks every element's provenance for any medium; this says what a
// page's whole is called, which of the request's words name the page
// itself, which parts hold fields, which details are numbers, and how a page
// is drawn (adapters/build/belief-page.js) and checked.
import { renderBeliefMapped, RENDERED_ELEMENTS } from "./belief-page.js";

/** A page medium, set by hand 2026-09-27 from the page build's own words. */
export const PAGE_MEDIUM = Object.freeze({
  kind: "page",
  root: "site",                          // the whole a page build is on the record as
  wholeFallback: "the site",             // what an ask calls the whole when the request named none
  // nouns a page request uses for the page itself, never a part of it
  wholeWords: Object.freeze(new Set(["site", "page", "website", "webpage", "app", "application", "reddit", "forum", "wiki"])),
  // a named part of this kind whose request lists details ("a form … with a
  // title and a community") holds them as fields
  fieldHolders: Object.freeze(new Set(["form"])),
  // a detail that is a number besides any "… count" ("karma")
  numericDetails: Object.freeze(new Set(["karma", "votes", "upvotes", "score", "points"])),
  showsVerb: "shows",
  render: renderBeliefMapped,
  elements: RENDERED_ELEMENTS,
});
