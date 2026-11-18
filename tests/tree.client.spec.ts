/** Branch arithmetic: positions keep their identity across forks, and missing Sessions degrade to roots. */
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionBranch } from '../src/types.ts'
import { expect, it } from 'vitest'
import { INITIAL_STATE, routeOf } from '../src/client/state.ts'
import { alternativesAt, bucketOf, chosenAt, followersOf, indexLineage, NO_PREFIX, originOf, rootOf } from '../src/client/tree.ts'

const id = (value: string) => value as SessionId
let clock = 0
const branch = (sessionId: string, parent: string, atSeq?: number): SessionBranch =>
  ({ sessionId: id(sessionId), parent: id(parent), ...(atSeq === undefined ? {} : { atSeq }), kind: 'ask', createdAt: ++clock })

// a: turns end at 10, 20, 30.  b forks a at 10.  c forks b at 10 (another answer to b's second turn).
// d forks b at 25 (inside b's own part).  e replaces a's first turn.
const lineage = indexLineage(
  [branch('b', 'a', 10), branch('c', 'b', 10), branch('d', 'b', 25), branch('e', 'a'), branch('lost', 'gone', 5), branch('gone-child', 'a', 10)],
  sessionId => sessionId !== 'gone' && sessionId !== 'gone-child',
)

it('lists every continuation of one position whichever branch displays it', () => {
  for (const viewer of ['a', 'b', 'c', 'd']) expect(alternativesAt(lineage, id(viewer), 10)).toEqual(['a', 'b', 'c'])
  expect(alternativesAt(lineage, id('d'), 25)).toEqual(['b', 'd'])
  expect(alternativesAt(lineage, id('a'), 20)).toEqual(['a'])
  for (const viewer of ['a', 'c', 'e']) expect(alternativesAt(lineage, id(viewer), NO_PREFIX)).toEqual(['a', 'e'])
})

it('names the continuation a Session follows and the Session that wrote a position', () => {
  expect(chosenAt(lineage, id('d'), 10)).toBe('b')
  expect(chosenAt(lineage, id('c'), 10)).toBe('c')
  expect(chosenAt(lineage, id('a'), 10)).toBe('a')
  expect(chosenAt(lineage, id('d'), NO_PREFIX)).toBe('a')
  expect(chosenAt(lineage, id('e'), NO_PREFIX)).toBe('e')
  expect(originOf(lineage, id('d'), 10)).toBe('a')
  expect(originOf(lineage, id('d'), 25)).toBe('b')
  expect(originOf(lineage, id('d'), 26)).toBe('d')
})

it('treats a branch of a missing parent as a root and ignores records of missing branches', () => {
  expect(lineage.has(id('lost'))).toBe(false)
  expect(lineage.has(id('gone-child'))).toBe(false)
  expect(rootOf(lineage, id('lost'))).toBe('lost')
  expect(rootOf(lineage, id('d'))).toBe('a')
})

it('buckets timestamps by whole local days before today', () => {
  const noon = new Date(2026, 10, 17, 12).getTime()
  const ago = (hours: number) => bucketOf(noon - hours * 36e5, noon)
  expect([ago(1), ago(13), ago(24 * 6), ago(24 * 7), ago(24 * 40)]).toEqual(['today', 'yesterday', 'week', 'month', 'earlier'])
})

it('lists the Sessions below one continuation, which is where a branch switch may land', () => {
  expect(followersOf(lineage, id('b'), 10)).toEqual(['b', 'd'])
  expect(followersOf(lineage, id('a'), 10)).toEqual(['a'])
  expect(followersOf(lineage, id('a'), NO_PREFIX)).toEqual(['a', 'b', 'c', 'd'])
})

it('sends the next question to a branch only while an earlier turn is in view or a question is being rewritten', () => {
  const place = { index: 2, count: 3, cut: 30, settled: true }
  expect(routeOf(INITIAL_STATE)).toBeNull()
  expect(routeOf({ ...INITIAL_STATE, place })).toBeNull()
  expect(routeOf({ ...INITIAL_STATE, place: { ...place, index: 0, cut: 10 } })).toEqual({ cut: 10, kind: 'ask' })
  // An open turn has no end to inherit, so the question continues the Session.
  expect(routeOf({ ...INITIAL_STATE, place: { ...place, index: 0, cut: undefined } })).toBeNull()
  expect(routeOf({ ...INITIAL_STATE, place, editing: { turn: 5, index: 2, cut: 20 } })).toEqual({ cut: 20, kind: 'edit' })
  expect(routeOf({ ...INITIAL_STATE, editing: { turn: 1, index: 0, cut: NO_PREFIX } })).toEqual({ cut: NO_PREFIX, kind: 'edit' })
})

it('keeps a tree together when a Session in the middle or at the root is deleted', () => {
  // m forked a at 10 and was deleted; x forked m inside m's own part, y forked m inside the part m inherited from a.
  const middle = indexLineage([branch('m', 'a', 10), branch('x', 'm', 25), branch('y', 'm', 5)], sessionId => sessionId !== 'm')
  expect(middle.get(id('x'))).toMatchObject({ parent: 'a', atSeq: 10 })
  expect(middle.get(id('y'))).toMatchObject({ parent: 'a', atSeq: 5 })
  expect(alternativesAt(middle, id('a'), 10)).toEqual(['a', 'x'])

  // r was deleted: q inherited the most, so it stands in for r and p is its branch at the prefix both share.
  const root = indexLineage([branch('p', 'r', 10), branch('q', 'r', 20), branch('s', 'q', 30)], sessionId => sessionId !== 'r')
  expect(root.has(id('q'))).toBe(false)
  expect(root.get(id('p'))).toMatchObject({ parent: 'q', atSeq: 10 })
  for (const member of ['p', 'q', 's']) expect(rootOf(root, id(member))).toBe('q')
})
