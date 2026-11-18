import type { SnapshotStore } from '@deepseek-ai/dsh-client-store';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { SessionGroup, SessionGroupId, SessionGroupsValue } from '../types.ts';
import type { SessionBranch, SessionBranchLinkRequest } from '../types.ts';
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
/** Lineage and group records as last read from the Host. */
export interface DesignData {
    /** False until the first read of both Remotes settles. */
    readonly loaded: boolean;
    readonly branches: readonly SessionBranch[];
    readonly groups: readonly SessionGroup[];
    /** Group of each grouped Session. */
    readonly groupOf: Readonly<Record<SessionId, SessionGroupId>>;
}
/** The Remote methods the model calls. */
export interface DesignRemote {
    readonly sessionLineage: {
        list(): Promise<RemoteResult<SessionBranch[]>>;
        link(request: SessionBranchLinkRequest): Promise<RemoteResult<SessionBranch>>;
    };
    readonly sessionGroups: {
        list(): Promise<RemoteResult<SessionGroupsValue>>;
        create(request: {
            name: string;
            theme: number;
        }): Promise<RemoteResult<SessionGroup>>;
        update(request: {
            groupId: SessionGroupId;
            name?: string;
            theme?: number;
        }): Promise<RemoteResult<SessionGroup>>;
        dissolve(request: {
            groupId: SessionGroupId;
        }): Promise<RemoteResult<SessionId[]>>;
        assign(request: {
            sessionId: SessionId;
            groupId?: SessionGroupId;
        }): Promise<RemoteResult<void>>;
    };
}
/** Snapshot source and mutations; each mutation resolves false when the Host refused it. */
export interface DesignModel {
    readonly source: SnapshotStore<DesignData>;
    refresh(): Promise<void>;
    link(request: SessionBranchLinkRequest): Promise<boolean>;
    createGroup(name: string, theme: number): Promise<SessionGroup | undefined>;
    updateGroup(groupId: SessionGroupId, change: {
        name?: string;
        theme?: number;
    }): Promise<boolean>;
    removeGroup(groupId: SessionGroupId): Promise<boolean>;
    assign(sessionId: SessionId, groupId: SessionGroupId | undefined): Promise<boolean>;
}
/**
 * Create the model over the mounted Remotes.
 * @param remote - lineage and group Remote namespaces.
 * @returns the snapshot source and its mutations.
 */
export declare function createDesignModel(remote: DesignRemote): DesignModel;
//# sourceMappingURL=model.d.ts.map