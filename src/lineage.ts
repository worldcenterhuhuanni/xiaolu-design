/**
 * Session lineage: a durable table of which Session branched from which Session and at
 * which event. Forking copies an event prefix and records no source, so this table is the
 * only link between a branch and its origin. Records live outside Session logs.
 */
import { z } from 'zod'
import { Service, type Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type { Domain } from '@deepseek-ai/dsh-storage-domain'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type {
  SessionBranch, SessionBranchLinkRequest, SessionBranchRequest, SessionBranchUnlinkValue, SessionLineageInvalidReason,
} from './lineage-types.ts'



declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host owner of the `sessionLineage` Remote namespace. */
    sessionLineage: SessionLineage
  }
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    'session-lineage/invalid': { readonly sessionId: SessionId; readonly reason: SessionLineageInvalidReason }
  }
}

const sessionId = z.string().min(1).transform(value => brandString<SessionId>(value))

const branchSchema = z.object({
  sessionId,
  parent: sessionId,
  atSeq: z.number().int().nonnegative().optional(),
  kind: z.enum(['ask', 'regenerate', 'edit']),
  createdAt: z.number(),
})

/** Storage domain of branch records, keyed by the branch Session id. */
export const sessionLineageDomain = defineDomain({
  name: 'session_lineage',
  version: 1,
  layout: 'per-record',
  tables: {
    branches: domainTable<SessionId, SessionBranch>(branchSchema),
  },
})

function invalid(sessionId: SessionId, reason: SessionLineageInvalidReason): RemoteError {
  return new RemoteError('session-lineage/invalid', `branch record for session "${sessionId}" was rejected: ${reason}`, {
    sessionId, reason,
  })
}

/**
 * Branch records and their Remote. A record whose parent or branch Session no longer
 * exists stays in the table; readers treat a missing parent as a root.
 */
export class SessionLineage extends TypertRemoteService {
  static inject = ['storageDomain']
  private readonly ready: Promise<Domain<typeof sessionLineageDomain>>
  private readonly initialized: PromiseLike<unknown>
  /** Serializes the cycle check with its write. */
  private tail: Promise<unknown> = Promise.resolve()

  constructor(ctx: Context) {
    super(ctx, 'sessionLineage')
    this.ready = ctx.storageDomain.open(sessionLineageDomain)
    this.initialized = ctx.effect(async () => {
      const domain = await this.ready
      return async () => {
        await this.tail
        await domain.close()
      }
    }, 'session-lineage: storage')
  }

  async [Service.init](): Promise<void> {
    await this.initialized
  }

  /** @returns every branch record, oldest first. */
  @Remote
  async list(): Promise<SessionBranch[]> {
    const table = (await this.ready).table('branches')
    return [...table.entries()].map(([, branch]) => branch).sort((left, right) => left.createdAt - right.createdAt)
  }

  /**
   * Record `request.sessionId` as a branch of `request.parent`, replacing its previous record.
   * @param request - branch Session, its parent, the inherited cut and the starting action.
   * @returns the stored record.
   * @throws RemoteError `session-lineage/invalid` when the Session names itself, the record would
   *   make it its own ancestor, or `atSeq` is not a non-negative safe integer.
   */
  @Remote
  link(request: SessionBranchLinkRequest): Promise<SessionBranch> {
    return this.serialize(async () => {
      if (request.sessionId === request.parent) throw invalid(request.sessionId, 'self-parent')
      if (request.atSeq !== undefined && !(Number.isSafeInteger(request.atSeq) && request.atSeq >= 0)) {
        throw invalid(request.sessionId, 'bad-seq')
      }
      const table = (await this.ready).table('branches')
      // Stored records are acyclic, so the walk from the parent ends at a root or at the new branch.
      for (let ancestor = table.get(request.parent); ancestor !== undefined; ancestor = table.get(ancestor.parent)) {
        if (ancestor.parent === request.sessionId) throw invalid(request.sessionId, 'cycle')
      }
      const branch: SessionBranch = {
        sessionId: request.sessionId,
        parent: request.parent,
        ...(request.atSeq === undefined ? {} : { atSeq: request.atSeq }),
        kind: request.kind,
        createdAt: Date.now(),
      }
      await table.put(request.sessionId, branch)
      return branch
    })
  }

  /**
   * Remove one branch record; branches of that Session keep their own records.
   * @param request - branch Session.
   * @returns whether a record existed.
   */
  @Remote
  unlink(request: SessionBranchRequest): Promise<SessionBranchUnlinkValue> {
    return this.serialize(async () => ({
      removed: await (await this.ready).table('branches').delete(request.sessionId),
    }))
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const pending = this.tail.then(operation)
    this.tail = pending.catch(() => {})
    return pending
  }
}
