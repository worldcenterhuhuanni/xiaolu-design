/** Group records, memberships and Remote requests of Session groups. */
import type { Branded } from '@deepseek-ai/dsh-brand';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
/** Opaque identity of one user-defined group. */
export type SessionGroupId = Branded<'SessionGroupId'>;
/** One user-defined group. Groups are independent of Workspaces. */
export interface SessionGroup {
    readonly groupId: SessionGroupId;
    /** Trimmed display name, 1 to 40 characters. */
    readonly name: string;
    /** Index into the presenting client's color themes; clients wrap an index they do not have. */
    readonly theme: number;
    /** Host clock time of creation, in epoch milliseconds; groups list in this order. */
    readonly createdAt: number;
}
/** Membership of one Session. A Session belongs to at most one group. */
export interface SessionGroupMember {
    readonly sessionId: SessionId;
    readonly groupId: SessionGroupId;
}
/** Every group and membership. */
export interface SessionGroupsValue {
    readonly groups: SessionGroup[];
    readonly members: SessionGroupMember[];
}
/** Request to create a group. */
export interface SessionGroupCreateRequest {
    readonly name: string;
    readonly theme: number;
}
/** Request to change a group's name, theme, or both. */
export interface SessionGroupUpdateRequest {
    readonly groupId: SessionGroupId;
    readonly name?: string | undefined;
    readonly theme?: number | undefined;
}
/** Request naming one group. */
export interface SessionGroupRequest {
    readonly groupId: SessionGroupId;
}
/** Request to move a Session into a group, or out of every group when `groupId` is absent. */
export interface SessionGroupAssignRequest {
    readonly sessionId: SessionId;
    readonly groupId?: SessionGroupId | undefined;
}
/** Why a group request was rejected. */
export type SessionGroupsInvalidReason = 'bad-name' | 'bad-theme' | 'unknown-group';
//# sourceMappingURL=groups-types.d.ts.map