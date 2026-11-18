import { Service, type Context } from '@deepseek-ai/cordis';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { SessionGroup, SessionGroupAssignRequest, SessionGroupCreateRequest, SessionGroupId, SessionGroupMember, SessionGroupRequest, SessionGroupsInvalidReason, SessionGroupsValue, SessionGroupUpdateRequest } from './groups-types.ts';
declare module '@deepseek-ai/cordis' {
    interface Context {
        /** Host owner of the `sessionGroups` Remote namespace. */
        sessionGroups: SessionGroups;
    }
}
declare module '@deepseek-ai/dsh-typert-protocol' {
    interface RemoteErrorDetailsMap {
        'session-groups/invalid': {
            readonly reason: SessionGroupsInvalidReason;
        };
    }
}
/** Storage domain of groups, keyed by group id, and memberships, keyed by Session id. */
export declare const sessionGroupsDomain: {
    name: string;
    version: number;
    layout: "per-record";
    tables: {
        groups: import("@deepseek-ai/dsh-storage-domain").DomainTableSpec<SessionGroupId, SessionGroup>;
        members: import("@deepseek-ai/dsh-storage-domain").DomainTableSpec<SessionId, SessionGroupMember>;
    };
};
/**
 * Group records, memberships and their Remote. A membership whose Session no longer
 * exists stays in the table until its group is removed.
 */
export declare class SessionGroups extends TypertRemoteService {
    static inject: string[];
    private readonly ready;
    private readonly initialized;
    /** Serializes each existence check with its writes. */
    private tail;
    constructor(ctx: Context);
    [Service.init](): Promise<void>;
    /** @returns every group, oldest first, and every membership. */
    list(): Promise<SessionGroupsValue>;
    /**
     * Create an empty group.
     * @param request - display name and theme index.
     * @returns the stored group.
     * @throws RemoteError `session-groups/invalid` for a blank or over-long name or an invalid theme.
     */
    create(request: SessionGroupCreateRequest): Promise<SessionGroup>;
    /**
     * Change a group's name, theme, or both; absent fields keep their value.
     * @param request - group and the fields to change.
     * @returns the stored group.
     * @throws RemoteError `session-groups/invalid` for an unknown group or an invalid field.
     */
    update(request: SessionGroupUpdateRequest): Promise<SessionGroup>;
    /**
     * Remove a group and its memberships. The Sessions themselves are untouched.
     * @param request - group to remove.
     * @returns the Sessions that left the group; empty when the group did not exist.
     */
    dissolve(request: SessionGroupRequest): Promise<SessionId[]>;
    /**
     * Move a Session into a group, or out of every group when `groupId` is absent.
     * @param request - Session and its new group.
     * @throws RemoteError `session-groups/invalid` for an unknown group.
     */
    assign(request: SessionGroupAssignRequest): Promise<void>;
    private serialize;
}
//# sourceMappingURL=groups.d.ts.map