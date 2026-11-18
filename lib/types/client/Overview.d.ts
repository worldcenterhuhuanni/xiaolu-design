import type { ReactNode } from 'react';
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store';
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { SessionGroupId } from '../types.ts';
import type { DesignData } from './model.ts';
import type { Lineage } from './tree.ts';
/** Private data and callbacks of the overview entry. */
export interface OverviewInjected {
    hooks: {
        design: ObservableSnapshot<DesignData>;
        lineage: ObservableSnapshot<Lineage>;
        /** Session the stage shows, or null before any stage has mounted. */
        current: ObservableSnapshot<SessionId | null>;
    };
    open: (sessionId: SessionId) => void;
    startSession: () => void;
    pin: (sessionId: SessionId, pinned: boolean) => void;
    archive: (sessionId: SessionId, archived: boolean) => void;
    createGroup: (name: string, theme: number) => Promise<SessionGroupId | undefined>;
    updateGroup: (groupId: SessionGroupId, change: {
        name?: string;
        theme?: number;
    }) => void;
    dissolveGroup: (groupId: SessionGroupId) => void;
    assign: (sessionId: SessionId, groupId: SessionGroupId | undefined) => void;
}
type OverviewProps = PropsRuntime<'shell.overlay'> & PropsLocale<'xiaoluDesign'> & InjectFace<OverviewInjected>;
/**
 * Session shelf and overview in the frame-wide overlay layer.
 * @param props - root standard props, the overview locale and the entry's inject face.
 * @returns the shelf, and the overview while it is open.
 */
export declare function Overview(props: OverviewProps): ReactNode;
export {};
//# sourceMappingURL=Overview.d.ts.map