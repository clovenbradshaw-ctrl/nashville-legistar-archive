import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from './holodeck-drive-select.js';

const order = ['f:a', 'f:b', 's:1', 's:2', 's:3', 's:4', 's:5'];

test('E11 a plain click selects one; ctrl toggles; shift takes the DISPLAYED range from the anchor', () => {
  let st = S.click(S.emptySel(), 's:2', order);
  assert.deepEqual(st.ids, ['s:2']);
  st = S.click(st, 's:4', order, { shift: true });
  assert.deepEqual(st.ids, ['s:2', 's:3', 's:4']);
  assert.equal(st.anchor, 's:2', 'the anchor holds while the range extends');
  st = S.click(st, 's:1', order, { shift: true });
  assert.deepEqual(st.ids, ['s:1', 's:2'], 'shifting back replaces the range, anchor-to-click');
  st = S.click(st, 's:5', order, { meta: true });
  assert.deepEqual(st.ids.sort(), ['s:1', 's:2', 's:5']);
  st = S.click(st, 's:5', order, { meta: true });
  assert.deepEqual(st.ids.sort(), ['s:1', 's:2']);
});

test('E11 the range follows the order on screen: sort changes, same click, different range', () => {
  const byName = ['s:1', 's:2', 's:3', 's:4'], byDate = ['s:4', 's:2', 's:3', 's:1'];
  let a = S.click(S.emptySel(), 's:1', byName); a = S.click(a, 's:3', byName, { shift: true });
  let b = S.click(S.emptySel(), 's:1', byDate); b = S.click(b, 's:3', byDate, { shift: true });
  assert.deepEqual(a.ids, ['s:1', 's:2', 's:3']); assert.deepEqual(b.ids, ['s:3', 's:1']);
});

test('E11 control: a range over insertion order instead of displayed order gives a different (wrong) set', () => {
  const insertion = ['s:1', 's:2', 's:3', 's:4'], displayed = ['s:4', 's:2', 's:3', 's:1'];
  const wrong = S.click(S.click(S.emptySel(), 's:1', insertion), 's:3', insertion, { shift: true }).ids;
  const right = S.click(S.click(S.emptySel(), 's:1', displayed), 's:3', displayed, { shift: true }).ids;
  assert.notDeepEqual(wrong.slice().sort(), right.slice().sort());
});

test('checkboxes add without clearing; select-all counts only what is displayed; prune drops what left the view', () => {
  let st = S.check(S.emptySel(), 's:1', order); st = S.check(st, 's:3', order);
  assert.deepEqual(st.ids, ['s:1', 's:3']);
  st = S.check(st, 's:5', order, { shift: true });
  assert.deepEqual(st.ids.sort(), ['s:1', 's:3', 's:4', 's:5']);
  const shown = ['s:1', 's:2'];
  assert.deepEqual(S.selectAll(shown).ids, shown);
  assert.deepEqual(S.prune(st, shown).ids, ['s:1']);
});

test('E10 exactly one tab stop in the whole surface, wherever focus is', () => {
  const t = S.tabindexOf(order, 's:3');
  assert.equal(Object.values(t).filter(v => v === 0).length, 1); assert.equal(t['s:3'], 0);
  assert.equal(Object.values(S.tabindexOf(order, null)).filter(v => v === 0).length, 1);
  assert.equal(Object.values(S.tabindexOf(order, 'gone')).filter(v => v === 0).length, 1);
});

test('E10 control: giving every tile tabindex 0 is caught by the same count', () => {
  const bad = Object.fromEntries(order.map(k => [k, 0]));
  assert.notEqual(Object.values(bad).filter(v => v === 0).length, 1);
});

test('navigation keys move by the layout: arrows by column count, page by rows, ends clamp', () => {
  const n = 20;
  assert.equal(S.navigate(5, n, 'ArrowRight', { cols: 4 }), 6);
  assert.equal(S.navigate(5, n, 'ArrowDown', { cols: 4 }), 9);
  assert.equal(S.navigate(1, n, 'ArrowUp', { cols: 4 }), 0);
  assert.equal(S.navigate(5, n, 'ArrowDown', { cols: 1 }), 6, 'a list moves by one');
  assert.equal(S.navigate(5, n, 'PageDown', { cols: 4, page: 3 }), 17);
  assert.equal(S.navigate(18, n, 'PageDown', { cols: 4, page: 3 }), 19);
  assert.equal(S.navigate(5, n, 'Home'), 0); assert.equal(S.navigate(5, n, 'End'), 19);
  assert.equal(S.navigate(5, n, 'q'), null); assert.equal(S.navigate(0, 0, 'Home'), null);
});

test('keys map to named actions; Delete is Trash, F2 renames, nothing steals the page', () => {
  const k = (key, o = {}) => S.actionFor({ key, ...o }, { hasSelection: true });
  assert.equal(k('Enter'), 'open'); assert.equal(k(' '), 'toggle'); assert.equal(k('Delete'), 'trash'); assert.equal(k('F2'), 'rename');
  assert.equal(k('a', { metaKey: true }), 'selectAll'); assert.equal(k('z', { ctrlKey: true }), 'undo');
  assert.equal(k('Escape'), 'clear'); assert.equal(k('ContextMenu'), 'menu'); assert.equal(k('F10', { shiftKey: true }), 'menu');
  assert.equal(S.actionFor({ key: 'Delete' }, { hasSelection: true, inTrash: true }), 'deleteForever');
  assert.equal(S.actionFor({ key: 'Delete' }, { hasSelection: false }), null);
  assert.equal(S.actionFor({ key: 'x' }, {}), null);
});

test('roles are the grid pattern for the list and the listbox pattern for tiles', () => {
  assert.equal(S.ROLES.list.container, 'grid'); assert.equal(S.ROLES.list.row, 'row'); assert.equal(S.ROLES.list.cell, 'gridcell');
  assert.equal(S.ROLES.grid.container, 'listbox'); assert.equal(S.ROLES.grid.item, 'option');
  assert.equal(S.ROLES.menu.container, 'menu'); assert.equal(S.ROLES.menu.item, 'menuitem');
});
