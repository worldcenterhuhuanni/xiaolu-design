/** Branch records and Remote requests of Session lineage. */
import type { SessionId } from '@deepseek-ai/dsh-session/types';
/**
 * User action that started a branch: a new question asked from an earlier turn,
 * another answer to the same question, or a rewritten question.
 */
export type SessionBranchKind = 'ask' | 'regenerate' | 'edit';
/** One Session recorded as a branch of another Session. */
export interface SessionBranch {
    /** The branch Session. Each Session has at most one record. */
    readonly sessionId: SessionId;
    /** The Session this branch was started from. */
    readonly parent: SessionId;
    /**
     * Last parent event seq the branch inherits, inclusive. Absent when the branch
     * inherits nothing and replaces the parent's first turn.
     */
    readonly atSeq?: number | undefined;
    readonly kind: SessionBranchKind;
    /** Host clock time of the record, in epoch milliseconds. */
    readonly createdAt: number;
}
/** Request to record one branch; the Host stamps `createdAt`. */
export interface SessionBranchLinkRequest {
    readonly sessionId: SessionId;
    readonly parent: SessionId;
    readonly atSeq?: number | undefined;
    readonly kind: SessionBranchKind;
}
/** Request naming one branch Session. */
export interface SessionBranchRequest {
    readonly sessionId: SessionId;
}
/** Result of removing a branch record. */
export interface SessionBranchUnlinkValue {
    /** False when the Session had no record. */
    readonly removed: boolean;
}
/** Why a link request was rejected. */
export type SessionLineageInvalidReason = 'self-parent' | 'cycle' | 'bad-seq';
//# sourceMappingURL=lineage-types.d.ts.map