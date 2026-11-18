import type { ReactNode } from 'react';
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store';
import type { Background } from './background/bg.ts';
import type { Scene } from './state.ts';
/** The plugin's one water: its canvas and the scene drawn on it. */
export interface Water {
    readonly canvas: HTMLCanvasElement;
    readonly background: Background;
}
/** Private data of the frame entry. */
export interface FrameInjected {
    hooks: {
        scene: ObservableSnapshot<Scene | null>;
    };
    /** The water shared by every Conversation; created on first use, null when WebGL is unavailable. */
    water: () => Water | null;
}
type FrameProps = PropsRuntime<'conversation.hero.frame'> & InjectFace<FrameInjected> & {
    children?: ReactNode;
};
/**
 * Wrap the Conversation scroll body and paint the water below it once a Session is in view.
 * @param props - the home state, the wrapped scroll body, the scene source and the shared water.
 * @returns a layout-neutral frame around the children.
 */
export declare function WaterFrame({ hero, children, useScene, water }: FrameProps): ReactNode;
export {};
//# sourceMappingURL=Frame.d.ts.map