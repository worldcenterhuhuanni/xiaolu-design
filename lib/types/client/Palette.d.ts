import type { ReactNode } from 'react';
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { Shown } from './state.ts';
import type { Lineage } from './tree.ts';
/** One Session whose message content matched. */
export interface ContentHit {
    readonly sessionId: SessionId;
    readonly snippet: string;
}
/** Private data and callbacks of the palette entry. */
export interface PaletteInjected {
    hooks: {
        shown: ObservableSnapshot<Shown | null>;
        lineage: ObservableSnapshot<Lineage>;
    };
    /** Search message content of every Session. Resolves null when the content index is unavailable. */
    search: (query: string, signal: AbortSignal) => Promise<readonly ContentHit[] | null>;
    open: (sessionId: SessionId) => void;
    /** Move the stage of the Session in view to one of its turns. */
    openTurn: (sessionId: SessionId, turn: number) => void;
    startSession: () => void;
}
type PaletteProps = PropsRuntime<'shell.overlay'> & PropsLocale<'xiaoluDesign'> & InjectFace<PaletteInjected>;
/**
 * Search palette of the application.
 * @param props - the Session catalog, the palette locale and the entry's inject face.
 * @returns a modal dialog, closed until the shortcut opens it.
 */
export declare function Palette(props: PaletteProps): ReactNode;
export {};
//# sourceMappingURL=Palette.d.ts.map