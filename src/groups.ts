/**
 * Session groups: user-defined groups and the group each Session belongs to. Groups are
 * labels beside Workspaces, which follow directories. Records live outside Session logs.
 */
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { Service, type Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type { Domain } from '@deepseek-ai/dsh-storage-domain'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type {
  SessionGroup, SessionGroupAssignRequest, SessionGroupCreateRequest, SessionGroupId, SessionGroupMember,
  SessionGroupRequest, SessionGroupsInvalidReason, SessionGroupsValue, SessionGroupUpdateRequest,
} from './groups-types.ts'



declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host owner of the `sessionGroups` Remote namespace. */
    sessionGroups: SessionGroups
  }
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    'session-groups/invalid': { readonly reason: SessionGroupsInvalidReason }
  }
}

/** Longest stored group name, in UTF-16 code units. */
const NAME_MAX = 40

const groupId = z.string().min(1).transform(value => brandString<SessionGroupId>(value))
const sessionId = z.string().min(1).transform(value => brandString<SessionId>(value))

const groupSchema = z.object({
  groupId,
  name: z.string().min(1).max(NAME_MAX),
  theme: z.number().int().nonnegative(),
  createdAt: z.number(),
})

const memberSchema = z.object({ sessionId, groupId })

/** Storage domain of groups, keyed by group id, and memberships, keyed by Session id. */
export const sessionGroupsDomain = defineDomain({
  name: 'session_groups',
  version: 1,
  layout: 'per-record',
  tables: {
    groups: domainTable<SessionGroupId, SessionGroup>(groupSchema),
    members: domainTable<SessionId, SessionGroupMember>(memberSchema),
  },
})

function invalid(reason: SessionGroupsInvalidReason): RemoteError {
  return new RemoteError('session-groups/invalid', `session group request was rejected: ${reason}`, { reason })
}

function validName(value: string): string {
  const trimmed = value.trim()
  if (trimmed === '' || trimmed.length > NAME_MAX) throw invalid('bad-name')
  return trimmed
}

function validTheme(value: number): number {
  if (!(Number.isSafeInteger(value) && value >= 0)) throw invalid('bad-theme')
  return value
}

/**
 * Group records, memberships and their Remote. A membership whose Session no longer
 * exists stays in the table until its group is removed.
 */
export class SessionGroups extends TypertRemoteService {
  static inject = ['storageDomain']
  private readonly ready: Promise<Domain<typeof sessionGroupsDomain>>
  private readonly initialized: PromiseLike<unknown>
  /** Serializes each existence check with its writes. */
  private tail: Promise<unknown> = Promise.resolve()

  constructor(ctx: Context) {
    super(ctx, 'sessionGroups')
    this.ready = ctx.storageDomain.open(sessionGroupsDomain)
    this.initialized = ctx.effect(async () => {
      const domain = await this.ready
      return async () => {
        await this.tail
        await domain.close()
      }
    }, 'session-groups: storage')
  }

  async [Service.init](): Promise<void> {
    await this.initialized
  }

  /** @returns every group, oldest first, and every membership. */
  @Remote
  async list(): Promise<SessionGroupsValue> {
    const domain = await this.ready
    return {
      groups: [...domain.table('groups').entries()].map(([, group]) => group)
        .sort((left, right) => left.createdAt - right.createdAt),
      members: [...domain.table('members').entries()].map(([, member]) => member),
    }
  }

  /**
   * Create an empty group.
   * @param request - display name and theme index.
   * @returns the stored group.
   * @throws RemoteError `session-groups/invalid` for a blank or over-long name or an invalid theme.
   */
  @Remote
  create(request: SessionGroupCreateRequest): Promise<SessionGroup> {
    return this.serialize(async () => {
      const group: SessionGroup = {
        groupId: brandString<SessionGroupId>(`group-${randomUUID()}`),
        name: validName(request.name),
        theme: validTheme(request.theme),
        createdAt: Date.now(),
      }
      await (await this.ready).table('groups').put(group.groupId, group)
      return group
    })
  }

  /**
   * Change a group's name, theme, or both; absent fields keep their value.
   * @param request - group and the fields to change.
   * @returns the stored group.
   * @throws RemoteError `session-groups/invalid` for an unknown group or an invalid field.
   */
  @Remote
  update(request: SessionGroupUpdateRequest): Promise<SessionGroup> {
    return this.serialize(async () => {
      const table = (await this.ready).table('groups')
      const current = table.get(request.groupId)
      if (current === undefined) throw invalid('unknown-group')
      const group: SessionGroup = {
        ...current,
        ...(request.name === undefined ? {} : { name: validName(request.name) }),
        ...(request.theme === undefined ? {} : { theme: validTheme(request.theme) }),
      }
      await table.put(group.groupId, group)
      return group
    })
  }

  /**
   * Remove a group and its memberships. The Sessions themselves are untouched.
   * @param request - group to remove.
   * @returns the Sessions that left the group; empty when the group did not exist.
   */
  @Remote
  dissolve(request: SessionGroupRequest): Promise<SessionId[]> {
    return this.serialize(async () => {
      const domain = await this.ready
      const members = domain.table('members')
      const released = [...members.entries()].filter(([, member]) => member.groupId === request.groupId).map(([id]) => id)
      // Memberships go first: an interruption leaves an empty group, never a membership of a missing group.
      for (const id of released) await members.delete(id)
      await domain.table('groups').delete(request.groupId)
      return released
    })
  }

  /**
   * Move a Session into a group, or out of every group when `groupId` is absent.
   * @param request - Session and its new group.
   * @throws RemoteError `session-groups/invalid` for an unknown group.
   */
  @Remote
  assign(request: SessionGroupAssignRequest): Promise<void> {
    return this.serialize(async () => {
      const domain = await this.ready
      if (request.groupId === undefined) {
        await domain.table('members').delete(request.sessionId)
        return
      }
      if (domain.table('groups').get(request.groupId) === undefined) throw invalid('unknown-group')
      await domain.table('members').put(request.sessionId, { sessionId: request.sessionId, groupId: request.groupId })
    })
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const pending = this.tail.then(operation)
    this.tail = pending.catch(() => {})
    return pending
  }
}
