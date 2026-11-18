/**
 * React-free model of lineage and groups: one snapshot mirrored from the two Remotes, and
 * the mutations that keep it current. Components read the snapshot through an inject hook.
 */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionGroup, SessionGroupId, SessionGroupsValue } from '../types.ts'
import type { SessionBranch, SessionBranchLinkRequest } from '../types.ts'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'

/** Lineage and group records as last read from the Host. */
export interface DesignData {
  /** False until the first read of both Remotes settles. */
  readonly loaded: boolean
  readonly branches: readonly SessionBranch[]
  readonly groups: readonly SessionGroup[]
  /** Group of each grouped Session. */
  readonly groupOf: Readonly<Record<SessionId, SessionGroupId>>
}

/** The Remote methods the model calls. */
export interface DesignRemote {
  readonly sessionLineage: {
    list(): Promise<RemoteResult<SessionBranch[]>>
    link(request: SessionBranchLinkRequest): Promise<RemoteResult<SessionBranch>>
  }
  readonly sessionGroups: {
    list(): Promise<RemoteResult<SessionGroupsValue>>
    create(request: { name: string; theme: number }): Promise<RemoteResult<SessionGroup>>
    update(request: { groupId: SessionGroupId; name?: string; theme?: number }): Promise<RemoteResult<SessionGroup>>
    dissolve(request: { groupId: SessionGroupId }): Promise<RemoteResult<SessionId[]>>
    assign(request: { sessionId: SessionId; groupId?: SessionGroupId }): Promise<RemoteResult<void>>
  }
}

/** Snapshot source and mutations; each mutation resolves false when the Host refused it. */
export interface DesignModel {
  readonly source: SnapshotStore<DesignData>
  refresh(): Promise<void>
  link(request: SessionBranchLinkRequest): Promise<boolean>
  createGroup(name: string, theme: number): Promise<SessionGroup | undefined>
  updateGroup(groupId: SessionGroupId, change: { name?: string; theme?: number }): Promise<boolean>
  removeGroup(groupId: SessionGroupId): Promise<boolean>
  assign(sessionId: SessionId, groupId: SessionGroupId | undefined): Promise<boolean>
}

const EMPTY: DesignData = { loaded: false, branches: [], groups: [], groupOf: {} }

/**
 * Create the model over the mounted Remotes.
 * @param remote - lineage and group Remote namespaces.
 * @returns the snapshot source and its mutations.
 */
export function createDesignModel(remote: DesignRemote): DesignModel {
  const source = createSnapshotStore<DesignData>(EMPTY, { flush: 'sync' })
  const patch = (change: Partial<DesignData>): void => { source.set({ ...source.getSnapshot(), ...change }) }
  return {
    source,
    async refresh() {
      const [branches, groups] = await Promise.all([remote.sessionLineage.list(), remote.sessionGroups.list()])
      // A failed read keeps the previous records: an empty tree would hide branches that still exist.
      patch({
        loaded: true,
        ...(branches.ok ? { branches: branches.value } : {}),
        ...(groups.ok
          ? {
            groups: groups.value.groups,
            groupOf: Object.fromEntries(groups.value.members.map(member => [member.sessionId, member.groupId])),
          }
          : {}),
      })
    },
    async link(request) {
      const result = await remote.sessionLineage.link(request)
      if (!result.ok) return false
      patch({ branches: [...source.getSnapshot().branches.filter(branch => branch.sessionId !== request.sessionId), result.value] })
      return true
    },
    async createGroup(name, theme) {
      const result = await remote.sessionGroups.create({ name, theme })
      if (!result.ok) return undefined
      patch({ groups: [...source.getSnapshot().groups, result.value] })
      return result.value
    },
    async updateGroup(groupId, change) {
      const result = await remote.sessionGroups.update({ groupId, ...change })
      if (!result.ok) return false
      patch({ groups: source.getSnapshot().groups.map(group => group.groupId === groupId ? result.value : group) })
      return true
    },
    async removeGroup(groupId) {
      const result = await remote.sessionGroups.dissolve({ groupId })
      if (!result.ok) return false
      const current = source.getSnapshot()
      patch({
        groups: current.groups.filter(group => group.groupId !== groupId),
        groupOf: Object.fromEntries(Object.entries(current.groupOf).filter(([, group]) => group !== groupId)),
      })
      return true
    },
    async assign(sessionId, groupId) {
      const result = await remote.sessionGroups.assign({ sessionId, ...(groupId === undefined ? {} : { groupId }) })
      if (!result.ok) return false
      const { [sessionId]: _previous, ...rest } = source.getSnapshot().groupOf
      patch({ groupOf: groupId === undefined ? rest : { ...rest, [sessionId]: groupId } })
      return true
    },
  }
}
