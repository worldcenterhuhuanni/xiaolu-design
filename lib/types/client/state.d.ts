/**
 * Reading position of one Session, shared by the stage and the composer's route label, and the
 * rule that turns it into the destination of the next question.
 */
import type { SessionBranchKind } from '../types.ts';
import type { Theme } from './themes.ts';
/** Where the reader looks: the latest turn, one turn, or the turn after a cut. */
export type Cursor = {
    readonly kind: 'latest';
} | {
    readonly kind: 'turn';
    readonly turn: number;
} | {
    readonly kind: 'cut';
    readonly cut: number;
};
/** A question being rewritten: its turn, its position on the path and the cut before it. */
export interface Editing {
    readonly turn: number;
    readonly index: number;
    readonly cut: number;
}
/** What the mounted stage shows; absent while the stage is not mounted. */
export interface Place {
    /** Position of the turn under the cursor on the visible path. */
    readonly index: number;
    /** Number of turns on the visible path. */
    readonly count: number;
    /** Last event seq of the turn under the cursor; absent while that turn is still open. */
    readonly cut: number | undefined;
    /** Whether the turn under the cursor has finished generating. */
    readonly settled: boolean;
}
/** Reading state of one Session. */
export interface StageState {
    readonly cursor: Cursor;
    readonly editing: Editing | null;
    readonly place: Place | null;
}
/** State of a Session nobody has read yet. */
export declare const INITIAL_STATE: StageState;
/** A branch the next question starts instead of continuing the Session. */
export interface Route {
    readonly cut: number;
    readonly kind: Extract<SessionBranchKind, 'ask' | 'edit'>;
}
/**
 * Decide where the next question lands.
 * @param state - reading state of the Session whose composer sends.
 * @returns the branch to start, or null when the question continues the Session.
 */
export declare function routeOf(state: StageState): Route | null;
/** One turn of the path in view, as the search palette lists it and a branch inherits it. */
export interface ShownTurn {
    readonly turn: number;
    readonly index: number;
    readonly prompt: string;
    /** One line standing for the answer. */
    readonly gist: string;
    /** Last event seq of the turn; absent while it is still open. */
    readonly endSeq: number | undefined;
}
/** The path the stage shows. */
export interface Shown {
    readonly sessionId: string;
    readonly turns: readonly ShownTurn[];
}
/** What the background shows for the Session in view. */
export interface Scene {
    readonly theme: Theme;
    /** 0 at rest, 0.45 while answering, 1 while reasoning. */
    readonly energy: number;
    /** Incremented for each sent question; the background answers with a warm splash at the composer. */
    readonly sent: number;
}
//# sourceMappingURL=state.d.ts.map