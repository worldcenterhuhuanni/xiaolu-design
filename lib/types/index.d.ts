/**
 * Host half of the depth-stage design: the branch records and the Session groups its browser
 * half reads. The browser half is discovered through the package client declaration.
 */
import type { Context } from '@deepseek-ai/cordis';
export { SessionGroups, sessionGroupsDomain } from './groups.ts';
export { SessionLineage, sessionLineageDomain } from './lineage.ts';
export type * from './types.ts';
export declare const name = "xiaolu-design";
/** The storage domain facility holds the branch, group and membership tables. */
export declare const inject: string[];
/**
 * Open the tables and mount the `sessionLineage` and `sessionGroups` Remotes; disposing the plugin closes the tables.
 * @param ctx - Owning plugin context.
 */
export declare function apply(ctx: Context): Promise<void>;
//# sourceMappingURL=index.d.ts.map