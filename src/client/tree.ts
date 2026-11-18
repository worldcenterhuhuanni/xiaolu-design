/**
 * Pure branch arithmetic over lineage records. A fork copies an event prefix and keeps its
 * seqs, so one conversation position is identified by the Session that first wrote the event
 * and the event seq, whichever branch displays it.
 */
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionBranch } from '../types.ts'

/** Cut of a branch that inherits nothing: it replaces its parent's first turn. */
export const NO_PREFIX = -1

/** Lineage records indexed by branch Session. */
export type Lineage = ReadonlyMap<SessionId, SessionBranch>

const cutOf = (branch: SessionBranch): number => branch.atSeq ?? NO_PREFIX

/**
 * Index branch records over the Sessions that still exist. Records of deleted Sessions stay in the
 * table, so a branch whose parent was deleted climbs to its nearest surviving ancestor and keeps only
 * the prefix that ancestor also has. When the root itself was deleted, the survivor that inherited
 * the most stands in for it and the other survivors become its branches.
 * @param branches - records from the lineage Remote, including those of deleted Sessions.
 * @param known - whether a Session is still listed by the Host.
 * @returns one record per surviving branch, with `parent` and `atSeq` naming a surviving Session.
 */
export function indexLineage(branches: readonly SessionBranch[], known: (sessionId: SessionId) => boolean): Lineage {
  const stored = new Map(branches.map(branch => [branch.sessionId, branch]))
  const placed = new Map<SessionId, SessionBranch>()
  const orphans = new Map<SessionId, SessionBranch[]>()
  for (const branch of branches) {
    if (!known(branch.sessionId)) continue
    let parent = branch.parent
    let cut = cutOf(branch)
    // Stored records are acyclic; the hop limit only bounds the walk over a damaged table.
    for (let hops = 0; !known(parent) && hops < branches.length; hops++) {
      const gone = stored.get(parent)
      if (gone === undefined) break
      cut = Math.min(cut, cutOf(gone))
      parent = gone.parent
    }
    const resolved: SessionBranch = { ...branch, parent, atSeq: cut === NO_PREFIX ? undefined : cut }
    if (known(parent)) placed.set(branch.sessionId, resolved)
    else orphans.set(parent, [...orphans.get(parent) ?? [], resolved])
  }
  for (const survivors of orphans.values()) {
    const [head, ...rest] = survivors.sort((left, right) => cutOf(right) - cutOf(left) || left.createdAt - right.createdAt)
    // Each survivor shares with the stand-in exactly the prefix it inherited from the deleted root, which is its own cut.
    if (head !== undefined) for (const branch of rest) placed.set(branch.sessionId, { ...branch, parent: head.sessionId })
  }
  return placed
}

/**
 * Find the Session that first wrote the conversation up to `cut`.
 * @param lineage - indexed records.
 * @param sessionId - Session displaying the position.
 * @param cut - inclusive event seq, or `NO_PREFIX` for the start of the conversation.
 * @returns the nearest ancestor, or the Session itself, that did not inherit `cut`.
 */
export function originOf(lineage: Lineage, sessionId: SessionId, cut: number): SessionId {
  let current = sessionId
  for (let branch = lineage.get(current); branch !== undefined && cutOf(branch) >= cut; branch = lineage.get(current)) {
    current = branch.parent
  }
  return current
}

/**
 * List every continuation after one position: the origin's own next turn and each branch cut there.
 * @param lineage - indexed records.
 * @param sessionId - Session displaying the position.
 * @param cut - inclusive event seq the continuations share, or `NO_PREFIX`.
 * @returns the origin Session first, then its branches at this cut, oldest first.
 */
export function alternativesAt(lineage: Lineage, sessionId: SessionId, cut: number): SessionId[] {
  const origin = originOf(lineage, sessionId, cut)
  const branches = [...lineage.values()]
    .filter(branch => cutOf(branch) === cut && originOf(lineage, branch.parent, cut) === origin)
    .sort((left, right) => left.createdAt - right.createdAt)
  return [origin, ...branches.map(branch => branch.sessionId)]
}

/**
 * Find which continuation after `cut` the Session follows.
 * @param lineage - indexed records.
 * @param sessionId - Session displaying the position.
 * @param cut - inclusive event seq, or `NO_PREFIX`.
 * @returns the member of `alternativesAt` that is this Session or its ancestor.
 */
export function chosenAt(lineage: Lineage, sessionId: SessionId, cut: number): SessionId {
  let current = sessionId
  for (let branch = lineage.get(current); branch !== undefined && cutOf(branch) > cut; branch = lineage.get(current)) {
    current = branch.parent
  }
  return current
}

/**
 * List the Sessions that pass through one continuation and differ only after it.
 * @param lineage - indexed records.
 * @param target - a member of `alternativesAt` for `cut`.
 * @param cut - inclusive event seq the continuation follows, or `NO_PREFIX`.
 * @returns `target` first, then every branch below it.
 */
export function followersOf(lineage: Lineage, target: SessionId, cut: number): SessionId[] {
  return [target, ...[...lineage.keys()].filter(sessionId => sessionId !== target && chosenAt(lineage, sessionId, cut) === target)]
}

/**
 * Find the root of the tree a Session belongs to.
 * @param lineage - indexed records.
 * @param sessionId - any Session.
 * @returns the ancestor without a record.
 */
export function rootOf(lineage: Lineage, sessionId: SessionId): SessionId {
  let current = sessionId
  for (let branch = lineage.get(current); branch !== undefined; branch = lineage.get(current)) current = branch.parent
  return current
}

/** Time bucket of a Session row, matching common chat sidebars. */
export type TimeBucket = 'today' | 'yesterday' | 'week' | 'month' | 'earlier'

/**
 * Place a timestamp in a calendar bucket relative to `now`.
 * @param time - epoch milliseconds of the Session's last update.
 * @param now - epoch milliseconds of the reading.
 * @returns the bucket by whole local days before today.
 */
export function bucketOf(time: number, now: number): TimeBucket {
  // ponytail: a day is counted as 24 hours, so a daylight-saving change can shift a boundary by one bucket for that day.
  const days = Math.ceil((new Date(now).setHours(0, 0, 0, 0) - time) / 864e5)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days <= 6) return 'week'
  return days <= 29 ? 'month' : 'earlier'
}
