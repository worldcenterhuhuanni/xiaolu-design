import type { ReactNode } from 'react';
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store';
import type { DesignData } from './model.ts';
import type { Scene, ShownTurn, StageState } from './state.ts';
import type { Lineage } from './tree.ts';
/** Judgment of one answer, as the message-feedback capability stores it. */
export type Rating = 'positive' | 'negative';
/** Private data and callbacks of the stage entry. */
export interface StageInjected {
    hooks: {
        lineage: ObservableSnapshot<Lineage>;
        design: ObservableSnapshot<DesignData>;
        stage: ObservableSnapshot<StageState>;
        focus: ObservableSnapshot<boolean>;
        /** Ratings of this Session's answers by message id. */
        votes: ObservableSnapshot<Readonly<Record<string, Rating>>>;
    };
    /** Report that the stage now shows this Session. */
    seen: () => void;
    /** Merge a change into the Session's reading state. */
    patch: (change: Partial<StageState>) => void;
    /** Publish the path in view, for the search palette and for the branch that may be opened next. */
    report: (turns: readonly ShownTurn[]) => void;
    /** Consume the layers this Session shares with the one the reader just left; they hold the stage until its own turns load. */
    inherit: () => readonly ShownTurn[];
    /** Describe the Session in view to the background. */
    show: (scene: Pick<Scene, 'theme' | 'energy'>) => void;
    setFocus: (on: boolean) => void;
    /** Ask the same question again in a branch that inherits everything up to `cut`. */
    regenerate: (cut: number, text: string) => void;
    /** Show the neighbouring answer to the turn after `cut`. */
    openBranch: (target: SessionId, cut: number) => void;
    stop: () => void;
    /** Load one more page of this Session's earlier history. */
    loadOlder: () => void;
    /** Write text to the clipboard. Resolves false when the browser refused. */
    copy: (text: string) => Promise<boolean>;
    /** Set or clear a rating; absent when the message-feedback capability is not installed. */
    vote: ((messageId: string, rating: Rating) => void) | undefined;
    /** Time from a question to the first answer text, measured while the turn was generating. */
    thinkTime: (turn: number, measured?: number) => number | undefined;
}
type StageProps = PropsRuntime<'conversation.view'> & PropsLocale<'xiaoluDesign'> & InjectFace<StageInjected>;
/**
 * Stage view of one Session.
 * @param props - Session standard props, the stage locale and the entry's inject face.
 * @returns the layered turns and the timeline rail.
 */
export declare function StageView(props: StageProps): ReactNode;
export {};
//# sourceMappingURL=Stage.d.ts.map