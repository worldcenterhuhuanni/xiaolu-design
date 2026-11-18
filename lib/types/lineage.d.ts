import { Service, type Context } from '@deepseek-ai/cordis';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { SessionBranch, SessionBranchLinkRequest, SessionBranchRequest, SessionBranchUnlinkValue, SessionLineageInvalidReason } from './lineage-types.ts';
declare module '@deepseek-ai/cordis' {
    interface Context {
        /** Host owner of the `sessionLineage` Remote namespace. */
        sessionLineage: SessionLineage;
    }
}
declare module '@deepseek-ai/dsh-typert-protocol' {
    interface RemoteErrorDetailsMap {
        'session-lineage/invalid': {
            readonly sessionId: SessionId;
            readonly reason: SessionLineageInvalidReason;
        };
    }
}
/** Storage domain of branch records, keyed by the branch Session id. */
export declare const sessionLineageDomain: {
    name: string;
    version: number;
    layout: "per-record";
    tables: {
        branches: import("@deepseek-ai/dsh-storage-domain").DomainTableSpec<SessionId, SessionBranch>;
    };
};
/**
 * Branch records and their Remote. A record whose parent or branch Session no longer
 * exists stays in the table; readers treat a missing parent as a root.
 */
export declare class SessionLineage extends TypertRemoteService {
    static inject: string[];
    private readonly ready;
    private readonly initialized;
    /** Serializes the cycle check with its write. */
    private tail;
    constructor(ctx: Context);
    [Service.init](): Promise<void>;
    /** @returns every branch record, oldest first. */
    list(): Promise<SessionBranch[]>;
    /**
     * Record `request.sessionId` as a branch of `request.parent`, replacing its previous record.
     * @param request - branch Session, its parent, the inherited cut and the starting action.
     * @returns the stored record.
     * @throws RemoteError `session-lineage/invalid` when the Session names itself, the record would
     *   make it its own ancestor, or `atSeq` is not a non-negative safe integer.
     */
    link(request: SessionBranchLinkRequest): Promise<SessionBranch>;
    /**
     * Remove one branch record; branches of that Session keep their own records.
     * @param request - branch Session.
     * @returns whether a record existed.
     */
    unlink(request: SessionBranchRequest): Promise<SessionBranchUnlinkValue>;
    private serialize;
}
//# sourceMappingURL=lineage.d.ts.map