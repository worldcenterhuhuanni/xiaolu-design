/** Mount the lineage and group Remotes, then replace the Chat view with the depth stage and route the composer's questions through it. */
import type { Context } from '@deepseek-ai/cordis';
import { type DesignKey } from './locales.ts';
declare module '@deepseek-ai/dsh-api-session-controller/client' {
    interface SessionReferenceSourceMap {
        /** Holds a new branch Session while its first question is sent. */
        xiaoluDesignBranch: unknown;
    }
}
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** Depth stage copy. */
        xiaoluDesign: DesignKey;
    }
}
/** Slots, dictionaries, the Remote carrier, the Session catalog and Session navigation. */
export declare const inject: string[];
/**
 * Mount both Remotes, then register the stage for the same plugin lifetime.
 * @param ctx - Client plugin context.
 * @returns disposer removing the stage before the Remote contributions.
 */
export declare function apply(ctx: Context): Promise<() => Promise<void>>;
//# sourceMappingURL=index.d.ts.map