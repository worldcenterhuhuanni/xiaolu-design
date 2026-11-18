/**
 * Pure branch arithmetic over lineage records. A fork copies an event prefix and keeps its
 * seqs, so one conversation position is identified by the Session that first wrote the event
 * and the event seq, whichever branch displays it.
 */
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { SessionBranch } from '../types.ts';
/** Cut of a branch that inherits nothing: it replaces its parent's first turn. */
export declare const NO_PREFIX = -1;
/** Lineage records indexed by branch Session. */
export type Lineage = ReadonlyMap<SessionId, SessionBranch>;
/**
 * Index branch records over the Sessions that still exist. Records of deleted Sessions stay in the
 * table, so a branch whose parent was deleted climbs to its nearest surviving ancestor and keeps only
 * the prefix that ancestor also has. When the root itself was deleted, the survivor that inherited
 * the most stands in for it and the other survivors become its branches.
 * @param branches - records from the lineage Remote, including those of deleted Sessions.
 * @param known - whether a Session is still listed by the Host.
 * @returns one record per surviving branch, with `parent` and `atSeq` naming a surviving Session.
 */
export declare function indexLineage(branches: readonly SessionBranch[], known: (sessionId: SessionId) => boolean): Lineage;
/**
 * Find the Session that first wrote the conversation up to `cut`.
 * @param lineage - indexed records.
 * @param sessionId - Session displaying the position.
 * @param cut - inclusive event seq, or `NO_PREFIX` for the start of the conversation.
 * @returns the nearest ancestor, or the Session itself, that did not inherit `cut`.
 */
export declare function originOf(lineage: Lineage, sessionId: SessionId, cut: number): SessionId;
/**
 * List every continuation after one position: the origin's own next turn and each branch cut there.
 * @param lineage - indexed records.
 * @param sessionId - Session displaying the position.
 * @param cut - inclusive event seq the continuations share, or `NO_PREFIX`.
 * @returns the origin Session first, then its branches at this cut, oldest first.
 */
export declare function alternativesAt(lineage: Lineage, sessionId: SessionId, cut: number): SessionId[];
/**
 * Find which continuation after `cut` the Session follows.
 * @param lineage - indexed records.
 * @param sessionId - Session displaying the position.
 * @param cut - inclusive event seq, or `NO_PREFIX`.
 * @returns the member of `alternativesAt` that is this Session or its ancestor.
 */
export declare function chosenAt(lineage: Lineage, sessionId: SessionId, cut: number): SessionId;
/**
 * List the Sessions that pass through one continuation and differ only after it.
 * @param lineage - indexed records.
 * @param target - a member of `alternativesAt` for `cut`.
 * @param cut - inclusive event seq the continuation follows, or `NO_PREFIX`.
 * @returns `target` first, then every branch below it.
 */
export declare function followersOf(lineage: Lineage, target: SessionId, cut: number): SessionId[];
/**
 * Find the root of the tree a Session belongs to.
 * @param lineage - indexed records.
 * @param sessionId - any Session.
 * @returns the ancestor without a record.
 */
export declare function rootOf(lineage: Lineage, sessionId: SessionId): SessionId;
/** Time bucket of a Session row, matching common chat sidebars. */
export type TimeBucket = 'today' | 'yesterday' | 'week' | 'month' | 'earlier';
/**
 * Place a timestamp in a calendar bucket relative to `now`.
 * @param time - epoch milliseconds of the Session's last update.
 * @param now - epoch milliseconds of the reading.
 * @returns the bucket by whole local days before today.
 */
export declare function bucketOf(time: number, now: number): TimeBucket;
//# sourceMappingURL=tree.d.ts.map