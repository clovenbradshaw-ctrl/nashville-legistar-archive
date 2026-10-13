// holodeck-drive-select.js — selection and keyboard navigation for the Sources
// view, as a pure state machine over the DISPLAYED order. No DOM.
//
// Items are addressed by a key: 's:<sourceId>' or 'f:<folderId>'. `order` is the
// array of keys exactly as drawn (folders first, then the sorted sources), so a
// shift-range is a range of what the person sees, never of insertion order.

export const keyOf = { source: id => 's:' + id, folder: id => 'f:' + id };
export const isFolderKey = k => k.startsWith('f:');
export const idOfKey = k => k.slice(2);

export const emptySel = () => ({ ids: [], anchor: null, focus: null });
const has = (st, k) => st.ids.includes(k);

export function click(st, key, order, { shift = false, meta = false } = {}) {
  const i = order.indexOf(key); if (i < 0) return st;
  if (shift && st.anchor != null && order.includes(st.anchor)) {
    const a = order.indexOf(st.anchor), [lo, hi] = a < i ? [a, i] : [i, a];
    const range = order.slice(lo, hi + 1);
    return { ids: meta ? [...new Set([...st.ids, ...range])] : range, anchor: st.anchor, focus: key };
  }
  if (meta) return { ids: has(st, key) ? st.ids.filter(k => k !== key) : [...st.ids, key], anchor: key, focus: key };
  return { ids: [key], anchor: key, focus: key };
}

// a checkbox never clears the others; with shift it adds the range
export function check(st, key, order, { shift = false } = {}) {
  if (shift) return click(st, key, order, { shift: true, meta: true });
  return { ids: has(st, key) ? st.ids.filter(k => k !== key) : [...st.ids, key], anchor: key, focus: key };
}

export const selectAll = (order, st = emptySel()) => ({ ids: order.slice(), anchor: st.anchor, focus: st.focus });
export const clear = st => ({ ids: [], anchor: st.anchor, focus: st.focus });
// after a filter/sort/move: drop what is no longer displayed; order does not matter to membership
export function prune(st, order) {
  const set = new Set(order); const ids = st.ids.filter(k => set.has(k));
  return { ids, anchor: set.has(st.anchor) ? st.anchor : null, focus: set.has(st.focus) ? st.focus : null };
}

// The tab model: exactly one stop in the whole surface (roving tabindex).
export function tabindexOf(order, focus) {
  const f = focus != null && order.includes(focus) ? focus : order[0];
  return Object.fromEntries(order.map(k => [k, k === f ? 0 : -1]));
}

// Where focus goes on a navigation key. `cols` = tiles per row (1 for the list);
// `page` = rows in a viewport. Returns the new index, or null if the key is not navigation.
export function navigate(index, n, key, { cols = 1, page = 1 } = {}) {
  if (n <= 0) return null;
  const c = Math.max(1, cols), clamp = x => Math.max(0, Math.min(n - 1, x));
  const i = index < 0 ? 0 : index;
  switch (key) {
    case 'ArrowRight': return clamp(i + 1);
    case 'ArrowLeft': return clamp(i - 1);
    case 'ArrowDown': return clamp(i + c);
    case 'ArrowUp': return clamp(i - c);
    case 'Home': return 0;
    case 'End': return n - 1;
    case 'PageDown': return clamp(i + page * c);
    case 'PageUp': return clamp(i - page * c);
    default: return null;
  }
}

// key → action name (or null). The DOM module only dispatches on the name.
export function actionFor(e, { inMenu = false, hasSelection = false, inTrash = false } = {}) {
  const mod = e.metaKey || e.ctrlKey;
  if (inMenu) return e.key === 'Escape' ? 'closeMenu' : null;
  if (mod && (e.key === 'a' || e.key === 'A')) return 'selectAll';
  if (mod && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) return 'undo';
  switch (e.key) {
    case 'Enter': return 'open';
    case ' ': case 'Spacebar': return 'toggle';
    case 'Delete': case 'Backspace': return hasSelection ? (inTrash ? 'deleteForever' : 'trash') : null;
    case 'F2': return inTrash ? null : 'rename';
    case 'Escape': return hasSelection ? 'clear' : null;
    case 'ContextMenu': return 'menu';
    case 'F10': return e.shiftKey ? 'menu' : null;
    default: return null;
  }
}

// roles for the two layouts (the DOM module must use exactly these)
export const ROLES = Object.freeze({
  list: { container: 'grid', row: 'row', cell: 'gridcell', header: 'columnheader' },
  grid: { container: 'listbox', item: 'option' },
  menu: { container: 'menu', item: 'menuitem' },
});
