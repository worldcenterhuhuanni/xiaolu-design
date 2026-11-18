var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
/**
 * Session groups: user-defined groups and the group each Session belongs to. Groups are
 * labels beside Workspaces, which follow directories. Records live outside Session logs.
 */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Service } from '@deepseek-ai/cordis';
import { brandString } from '@deepseek-ai/dsh-brand';
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain';
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
/** Longest stored group name, in UTF-16 code units. */
const NAME_MAX = 40;
const groupId = z.string().min(1).transform(value => brandString(value));
const sessionId = z.string().min(1).transform(value => brandString(value));
const groupSchema = z.object({
    groupId,
    name: z.string().min(1).max(NAME_MAX),
    theme: z.number().int().nonnegative(),
    createdAt: z.number(),
});
const memberSchema = z.object({ sessionId, groupId });
/** Storage domain of groups, keyed by group id, and memberships, keyed by Session id. */
export const sessionGroupsDomain = defineDomain({
    name: 'session_groups',
    version: 1,
    layout: 'per-record',
    tables: {
        groups: domainTable(groupSchema),
        members: domainTable(memberSchema),
    },
});
function invalid(reason) {
    return new RemoteError('session-groups/invalid', `session group request was rejected: ${reason}`, { reason });
}
function validName(value) {
    const trimmed = value.trim();
    if (trimmed === '' || trimmed.length > NAME_MAX)
        throw invalid('bad-name');
    return trimmed;
}
function validTheme(value) {
    if (!(Number.isSafeInteger(value) && value >= 0))
        throw invalid('bad-theme');
    return value;
}
/**
 * Group records, memberships and their Remote. A membership whose Session no longer
 * exists stays in the table until its group is removed.
 */
let SessionGroups = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _list_decorators;
    let _create_decorators;
    let _update_decorators;
    let _dissolve_decorators;
    let _assign_decorators;
    return class SessionGroups extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _list_decorators = [Remote];
            _create_decorators = [Remote];
            _update_decorators = [Remote];
            _dissolve_decorators = [Remote];
            _assign_decorators = [Remote];
            __esDecorate(this, null, _list_decorators, { kind: "method", name: "list", static: false, private: false, access: { has: obj => "list" in obj, get: obj => obj.list }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _create_decorators, { kind: "method", name: "create", static: false, private: false, access: { has: obj => "create" in obj, get: obj => obj.create }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _update_decorators, { kind: "method", name: "update", static: false, private: false, access: { has: obj => "update" in obj, get: obj => obj.update }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _dissolve_decorators, { kind: "method", name: "dissolve", static: false, private: false, access: { has: obj => "dissolve" in obj, get: obj => obj.dissolve }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _assign_decorators, { kind: "method", name: "assign", static: false, private: false, access: { has: obj => "assign" in obj, get: obj => obj.assign }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        static inject = ['storageDomain'];
        ready = __runInitializers(this, _instanceExtraInitializers);
        initialized;
        /** Serializes each existence check with its writes. */
        tail = Promise.resolve();
        constructor(ctx) {
            super(ctx, 'sessionGroups');
            this.ready = ctx.storageDomain.open(sessionGroupsDomain);
            this.initialized = ctx.effect(async () => {
                const domain = await this.ready;
                return async () => {
                    await this.tail;
                    await domain.close();
                };
            }, 'session-groups: storage');
        }
        async [Service.init]() {
            await this.initialized;
        }
        /** @returns every group, oldest first, and every membership. */
        async list() {
            const domain = await this.ready;
            return {
                groups: [...domain.table('groups').entries()].map(([, group]) => group)
                    .sort((left, right) => left.createdAt - right.createdAt),
                members: [...domain.table('members').entries()].map(([, member]) => member),
            };
        }
        /**
         * Create an empty group.
         * @param request - display name and theme index.
         * @returns the stored group.
         * @throws RemoteError `session-groups/invalid` for a blank or over-long name or an invalid theme.
         */
        create(request) {
            return this.serialize(async () => {
                const group = {
                    groupId: brandString(`group-${randomUUID()}`),
                    name: validName(request.name),
                    theme: validTheme(request.theme),
                    createdAt: Date.now(),
                };
                await (await this.ready).table('groups').put(group.groupId, group);
                return group;
            });
        }
        /**
         * Change a group's name, theme, or both; absent fields keep their value.
         * @param request - group and the fields to change.
         * @returns the stored group.
         * @throws RemoteError `session-groups/invalid` for an unknown group or an invalid field.
         */
        update(request) {
            return this.serialize(async () => {
                const table = (await this.ready).table('groups');
                const current = table.get(request.groupId);
                if (current === undefined)
                    throw invalid('unknown-group');
                const group = {
                    ...current,
                    ...(request.name === undefined ? {} : { name: validName(request.name) }),
                    ...(request.theme === undefined ? {} : { theme: validTheme(request.theme) }),
                };
                await table.put(group.groupId, group);
                return group;
            });
        }
        /**
         * Remove a group and its memberships. The Sessions themselves are untouched.
         * @param request - group to remove.
         * @returns the Sessions that left the group; empty when the group did not exist.
         */
        dissolve(request) {
            return this.serialize(async () => {
                const domain = await this.ready;
                const members = domain.table('members');
                const released = [...members.entries()].filter(([, member]) => member.groupId === request.groupId).map(([id]) => id);
                // Memberships go first: an interruption leaves an empty group, never a membership of a missing group.
                for (const id of released)
                    await members.delete(id);
                await domain.table('groups').delete(request.groupId);
                return released;
            });
        }
        /**
         * Move a Session into a group, or out of every group when `groupId` is absent.
         * @param request - Session and its new group.
         * @throws RemoteError `session-groups/invalid` for an unknown group.
         */
        assign(request) {
            return this.serialize(async () => {
                const domain = await this.ready;
                if (request.groupId === undefined) {
                    await domain.table('members').delete(request.sessionId);
                    return;
                }
                if (domain.table('groups').get(request.groupId) === undefined)
                    throw invalid('unknown-group');
                await domain.table('members').put(request.sessionId, { sessionId: request.sessionId, groupId: request.groupId });
            });
        }
        serialize(operation) {
            const pending = this.tail.then(operation);
            this.tail = pending.catch(() => { });
            return pending;
        }
    };
})();
export { SessionGroups };
//# sourceMappingURL=groups.js.map