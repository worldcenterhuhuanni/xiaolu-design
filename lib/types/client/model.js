/**
 * React-free model of lineage and groups: one snapshot mirrored from the two Remotes, and
 * the mutations that keep it current. Components read the snapshot through an inject hook.
 */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
const EMPTY = { loaded: false, branches: [], groups: [], groupOf: {} };
/**
 * Create the model over the mounted Remotes.
 * @param remote - lineage and group Remote namespaces.
 * @returns the snapshot source and its mutations.
 */
export function createDesignModel(remote) {
    const source = createSnapshotStore(EMPTY, { flush: 'sync' });
    const patch = (change) => { source.set({ ...source.getSnapshot(), ...change }); };
    return {
        source,
        async refresh() {
            const [branches, groups] = await Promise.all([remote.sessionLineage.list(), remote.sessionGroups.list()]);
            // A failed read keeps the previous records: an empty tree would hide branches that still exist.
            patch({
                loaded: true,
                ...(branches.ok ? { branches: branches.value } : {}),
                ...(groups.ok
                    ? {
                        groups: groups.value.groups,
                        groupOf: Object.fromEntries(groups.value.members.map(member => [member.sessionId, member.groupId])),
                    }
                    : {}),
            });
        },
        async link(request) {
            const result = await remote.sessionLineage.link(request);
            if (!result.ok)
                return false;
            patch({ branches: [...source.getSnapshot().branches.filter(branch => branch.sessionId !== request.sessionId), result.value] });
            return true;
        },
        async createGroup(name, theme) {
            const result = await remote.sessionGroups.create({ name, theme });
            if (!result.ok)
                return undefined;
            patch({ groups: [...source.getSnapshot().groups, result.value] });
            return result.value;
        },
        async updateGroup(groupId, change) {
            const result = await remote.sessionGroups.update({ groupId, ...change });
            if (!result.ok)
                return false;
            patch({ groups: source.getSnapshot().groups.map(group => group.groupId === groupId ? result.value : group) });
            return true;
        },
        async removeGroup(groupId) {
            const result = await remote.sessionGroups.dissolve({ groupId });
            if (!result.ok)
                return false;
            const current = source.getSnapshot();
            patch({
                groups: current.groups.filter(group => group.groupId !== groupId),
                groupOf: Object.fromEntries(Object.entries(current.groupOf).filter(([, group]) => group !== groupId)),
            });
            return true;
        },
        async assign(sessionId, groupId) {
            const result = await remote.sessionGroups.assign({ sessionId, ...(groupId === undefined ? {} : { groupId }) });
            if (!result.ok)
                return false;
            const { [sessionId]: _previous, ...rest } = source.getSnapshot().groupOf;
            patch({ groupOf: groupId === undefined ? rest : { ...rest, [sessionId]: groupId } });
            return true;
        },
    };
}
//# sourceMappingURL=model.js.map