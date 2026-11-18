/**
 * Route label above the composer: it always says where the next question lands, and selecting
 * it returns to the plain continuation. Quick follow-ups appear below it while the turn in view
 * has settled and the draft is empty.
 */
import type { ReactNode } from 'react';
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store';
import type { StageState } from './state.ts';
/** Private data and callbacks of the route label entry. */
export interface DockInjected {
    hooks: {
        stage: ObservableSnapshot<StageState>;
    };
    /** Leave the rewrite, or return to the latest turn when no rewrite is open. @returns whether a rewrite was left. */
    reset: () => boolean;
    /** Ask a ready-made question from the turn in view. */
    ask: (text: string) => void;
}
type DockProps = PropsRuntime<'conversation.input.dock'> & PropsLocale<'xiaoluDesign'> & InjectFace<DockInjected>;
/**
 * Route label and quick follow-ups of one Session's composer.
 * @param props - the composer zone, the stage locale and the entry's inject face.
 * @returns the label row, with the follow-ups when they apply.
 */
export declare function RouteDock({ input, inputActions, useStage, reset, ask, t }: DockProps): ReactNode;
export {};
//# sourceMappingURL=Dock.d.ts.map