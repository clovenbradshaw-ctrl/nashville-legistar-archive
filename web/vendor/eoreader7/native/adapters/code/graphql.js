// adapters/code/graphql.js — a GraphQL schema artifact, read structurally.
//
// A schema introspection dump (`{ "__schema": { types, queryType, … } }`) is
// neither prose nor a minified code hunk: `isCodeHunk` refuses it (pretty
// JSON has short lines), and the causal text perceiver would read zero
// referents from it. But its own structure carries the whole "what is this?" —
// the root operation types, the type inventory, the pagination convention
// (`*Connection`/`*Edge`), the mutation payload convention, the enums, the
// unions, the domain vocabulary of its type names, the mutation verbs it
// measures. This adapter reads that structure and nothing else.
//
// DISCIPLINES (the what-organ's law set, applied to a schema):
//   - SEPARATE CHANNEL — nothing here feeds the prose referent/cast system.
//   - READ OFF THE SCHEMA'S OWN BYTES — every count and name comes from the
//     introspection document itself; convention patterns (`Connection`,
//     `Payload`, mutation verbs) are received GraphQL-naming knowledge, the
//     same class of received knowledge scan.js licenses for package names, and
//     are disclosed as heuristics, never verdicts.
//   - BOUNDED, NEVER SILENT — field lists are capped with full counts
//     disclosed; a giant schema's skipped rows are counted, not dropped.
//   - NON-LATIN SAFE — all name extraction is on the JSON structure, not a
//     Latin-script word list; a schema in any language's type names reads the
//     same.

// The one structural test: it must parse as JSON and carry the introspection
// shape (a `__schema` with a non-empty `types` array of kinded entries). JSON
// that fails to parse is refused, never guessed at.
export function isGraphqlSchema(text) {
  if (typeof text !== "string" || !text.trim()) return false;
  let doc;
  try { doc = JSON.parse(text); } catch { return false; }
  const schema = doc?.__schema;
  if (!schema || !Array.isArray(schema.types) || schema.types.length === 0) return false;
  return schema.types.every((t) => t && typeof t.name === "string" && typeof t.kind === "string");
}

// Resolve a TypeRef ({kind:"NON_NULL", ofType:{…}}) to its leaf name —
// the same unwrap the GraphQL spec's own introspection tools use.
function typeRefName(t) {
  if (!t) return null;
  if (t.kind === "NON_NULL" || t.kind === "LIST") return typeRefName(t.ofType);
  return t.name ?? null;
}

// The first CamelCase word of a type name ("SurveyAssignment" -> "Survey"),
// used for the domain-vocabulary tally — a received naming convention (PascalCase
// type names), never a word list about the domain itself.
const FIRST_WORD = /^[A-Z][a-z0-9]+/;
const ROOTISH = /^(Root|PageInfo)$/;
const CONVENTION_TAIL = /(Connection|Edge|Payload|Input|Filter|Where|Order)$/;

// The next char after the verb must be a CamelCase boundary (`createSurvey`),
// end-of-name, or a separator — `\b` would not fire between `create` and
// `Survey`, and without a boundary `settle` would be misread as `set`.
const MUTATION_VERB = /^(create|update|delete|submit|add|remove|set|request|approve|revoke|cancel|resend|clear|generate|import|export|publish|unpublish|renew|issue|upload|download|accept|reject|close|open|start|stop|restart|sync|reset|resume|pause|send|verify|confirm|deny|grant|assign|unassign|move|copy|share|unshare|like|unlike|follow|unfollow|join|leave|invite|kick|ban|unban|mute|unmute|hide|unhide|pin|unpin|archive|unarchive|restore|purge|merge|split|convert|transform|transfer|withdraw|deposit|refund|charge|pay|subscribe|unsubscribe|book|schedule|reschedule|checkout|purchase|redeem|claim|dispute|appeal|escalate|triage|resolve|reopen)(?=[A-Z]|$|[-_])/i;

function fieldsOf(type) {
  return (type?.fields ?? []).map((f) => ({
    name: f.name,
    args: (f.args ?? []).map((a) => ({ name: a.name, type: typeRefName(a.type), required: a.type?.kind === "NON_NULL" })),
    returns: typeRefName(f.type),
    deprecated: Boolean(f.isDeprecated),
  }));
}

/**
 * schemaScan(text, { maxRootFields, maxSamples }) -> GraphQLSchemaScan@1
 * Every figure below comes from the introspection document's own bytes.
 * `maxRootFields` caps each root type's listed fields (full count disclosed);
 * `maxSamples` caps the enum/domain lists.
 */
export function schemaScan(text, { maxRootFields = 60, maxSamples = 24 } = {}) {
  const s = String(text ?? "");
  let doc;
  try { doc = JSON.parse(s); } catch { throw new TypeError("schemaScan: not JSON — use isGraphqlSchema before scanning"); }
  const schema = doc.__schema;
  if (!schema?.types?.length) throw new TypeError("schemaScan: not a GraphQL introspection document (no __schema.types)");

  const types = schema.types;
  const kindCount = (n) => types.filter((t) => t.kind === n).length;
  const counts = {
    total: types.length,
    object: kindCount("OBJECT"),
    interface: kindCount("INTERFACE"),
    enum: kindCount("ENUM"),
    union: kindCount("UNION"),
    input: kindCount("INPUT_OBJECT"),
    scalar: kindCount("SCALAR"),
  };

  const root = {
    query: schema.queryType?.name ?? null,
    mutation: schema.mutationType?.name ?? null,
    subscription: schema.subscriptionType?.name ?? null,
  };
  const byName = new Map(types.map((t) => [t.name, t]));
  const queryFields = root.query ? fieldsOf(byName.get(root.query)).slice(0, maxRootFields) : [];
  const mutationFields = root.mutation ? fieldsOf(byName.get(root.mutation)).slice(0, maxRootFields) : [];
  const subscriptionFields = root.subscription ? fieldsOf(byName.get(root.subscription)).slice(0, maxRootFields) : [];

  const objects = types.filter((t) => t.kind === "OBJECT");
  const connections = objects
    .filter((t) => /Connection$/.test(t.name))
    .map((t) => ({ name: t.name, fields: (t.fields ?? []).length }));
  const payloads = objects.filter((t) => /Payload$/.test(t.name)).map((t) => t.name);
  const enums = types
    .filter((t) => t.kind === "ENUM")
    .map((t) => ({ name: t.name, values: (t.enumValues ?? []).map((v) => v.name) }));
  const unions = types.filter((t) => t.kind === "UNION").map((t) => t.name);
  const inputs = types.filter((t) => t.kind === "INPUT_OBJECT").map((t) => t.name);

  // Domain vocabulary: the first word of every OBJECT type name that is not
  // root-shaped or a pure convention tail — the schema's own recurring domains
  // ("Survey", "License", "Asset", "Calendar"), tallied by the schema's own
  // names, never a word list about the domain.
  const domainTally = new Map();
  for (const t of objects) {
    const first = (t.name.match(FIRST_WORD) ?? [])[0];
    if (!first || ROOTISH.test(first) || CONVENTION_TAIL.test(t.name)) continue;
    domainTally.set(first, (domainTally.get(first) ?? 0) + 1);
  }
  const domain = [...domainTally.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxSamples).map(([word, n]) => ({ word, n }));

  // Mutation verb family: how many root mutations open with each action verb —
  // the schema's own measure of what its API DOES, not a guess.
  const verbTally = new Map();
  for (const f of mutationFields) {
    const v = (f.name.match(MUTATION_VERB) ?? [])[1];
    if (!v) continue;
    verbTally.set(v.toLowerCase(), (verbTally.get(v.toLowerCase()) ?? 0) + 1);
  }
  const verbs = [...verbTally.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxSamples).map(([verb, n]) => ({ verb, n }));

  // Byte anchors for the account's evidence — first occurrence of each root
  // type name in the raw document (a real byte address, whitespace-agnostic:
  // a pretty-printed introspection dump writes `"name": "RootQueryType"`).
  const offsetOf = (name) => (name ? s.indexOf(`"${name}"`) : -1);
  const evidenceAnchors = [root.query, root.mutation, root.subscription].filter(Boolean).map((n) => ({ name: n, offset: offsetOf(n) }));

  return Object.freeze({
    schema: "GraphQLSchemaScan@1",
    bytes: s.length,
    counts,
    root,
    queryFields,
    mutationFields,
    subscriptionFields,
    connections: connections.slice(0, maxSamples),
    connectionTotal: connections.length,
    payloads: payloads.slice(0, maxSamples),
    payloadTotal: payloads.length,
    enums: enums.slice(0, maxSamples),
    enumTotal: enums.length,
    unions: unions.slice(0, maxSamples),
    unionTotal: unions.length,
    inputs: inputs.slice(0, maxSamples),
    inputTotal: inputs.length,
    domain,
    verbs,
    evidenceAnchors,
    disclosure: Object.freeze({
      queryFieldsTotal: root.query ? (byName.get(root.query)?.fields?.length ?? 0) : 0,
      mutationFieldsTotal: root.mutation ? (byName.get(root.mutation)?.fields?.length ?? 0) : 0,
      subscriptionFieldsTotal: root.subscription ? (byName.get(root.subscription)?.fields?.length ?? 0) : 0,
      maxRootFields,
      basis: `${counts.total} types read from the introspection document itself; conventions (Connection/Payload/enum names/mutation verbs) are received GraphQL-naming knowledge, disclosed, never verdicts`,
    }),
  });
}