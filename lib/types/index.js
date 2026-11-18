import { SessionGroups } from "./groups.js";
import { SessionLineage } from "./lineage.js";
export { SessionGroups, sessionGroupsDomain } from "./groups.js";
export { SessionLineage, sessionLineageDomain } from "./lineage.js";
export const name = 'xiaolu-design';
/** The storage domain facility holds the branch, group and membership tables. */
export const inject = ['storageDomain'];
/**
 * Open the tables and mount the `sessionLineage` and `sessionGroups` Remotes; disposing the plugin closes the tables.
 * @param ctx - Owning plugin context.
 */
export async function apply(ctx) {
    await ctx.plugin(SessionLineage);
    await ctx.plugin(SessionGroups);
}
//# sourceMappingURL=index.js.map