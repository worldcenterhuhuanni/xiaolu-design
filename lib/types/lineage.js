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
 * Session lineage: a durable table of which Session branched from which Session and at
 * which event. Forking copies an event prefix and records no source, so this table is the
 * only link between a branch and its origin. Records live outside Session logs.
 */
import { z } from 'zod';
import { Service } from '@deepseek-ai/cordis';
import { brandString } from '@deepseek-ai/dsh-brand';
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain';
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
const sessionId = z.string().min(1).transform(value => brandString(value));
const branchSchema = z.object({
    sessionId,
    parent: sessionId,
    atSeq: z.number().int().nonnegative().optional(),
    kind: z.enum(['ask', 'regenerate', 'edit']),
    createdAt: z.number(),
});
/** Storage domain of branch records, keyed by the branch Session id. */
export const sessionLineageDomain = defineDomain({
    name: 'session_lineage',
    version: 1,
    layout: 'per-record',
    tables: {
        branches: domainTable(branchSchema),
    },
});
function invalid(sessionId, reason) {
    return new RemoteError('session-lineage/invalid', `branch record for session "${sessionId}" was rejected: ${reason}`, {
        sessionId, reason,
    });
}
/**
 * Branch records and their Remote. A record whose parent or branch Session no longer
 * exists stays in the table; readers treat a missing parent as a root.
 */
let SessionLineage = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _list_decorators;
    let _link_decorators;
    let _unlink_decorators;
    return class SessionLineage extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _list_decorators = [Remote];
            _link_decorators = [Remote];
            _unlink_decorators = [Remote];
            __esDecorate(this, null, _list_decorators, { kind: "method", name: "list", static: false, private: false, access: { has: obj => "list" in obj, get: obj => obj.list }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _link_decorators, { kind: "method", name: "link", static: false, private: false, access: { has: obj => "link" in obj, get: obj => obj.link }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _unlink_decorators, { kind: "method", name: "unlink", static: false, private: false, access: { has: obj => "unlink" in obj, get: obj => obj.unlink }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        static inject = ['storageDomain'];
        ready = __runInitializers(this, _instanceExtraInitializers);
        initialized;
        /** Serializes the cycle check with its write. */
        tail = Promise.resolve();
        constructor(ctx) {
            super(ctx, 'sessionLineage');
            this.ready = ctx.storageDomain.open(sessionLineageDomain);
            this.initialized = ctx.effect(async () => {
                const domain = await this.ready;
                return async () => {
                    await this.tail;
                    await domain.close();
                };
            }, 'session-lineage: storage');
        }
        async [Service.init]() {
            await this.initialized;
        }
        /** @returns every branch record, oldest first. */
        async list() {
            const table = (await this.ready).table('branches');
            return [...table.entries()].map(([, branch]) => branch).sort((left, right) => left.createdAt - right.createdAt);
        }
        /**
         * Record `request.sessionId` as a branch of `request.parent`, replacing its previous record.
         * @param request - branch Session, its parent, the inherited cut and the starting action.
         * @returns the stored record.
         * @throws RemoteError `session-lineage/invalid` when the Session names itself, the record would
         *   make it its own ancestor, or `atSeq` is not a non-negative safe integer.
         */
        link(request) {
            return this.serialize(async () => {
                if (request.sessionId === request.parent)
                    throw invalid(request.sessionId, 'self-parent');
                if (request.atSeq !== undefined && !(Number.isSafeInteger(request.atSeq) && request.atSeq >= 0)) {
                    throw invalid(request.sessionId, 'bad-seq');
                }
                const table = (await this.ready).table('branches');
                // Stored records are acyclic, so the walk from the parent ends at a root or at the new branch.
                for (let ancestor = table.get(request.parent); ancestor !== undefined; ancestor = table.get(ancestor.parent)) {
                    if (ancestor.parent === request.sessionId)
                        throw invalid(request.sessionId, 'cycle');
                }
                const branch = {
                    sessionId: request.sessionId,
                    parent: request.parent,
                    ...(request.atSeq === undefined ? {} : { atSeq: request.atSeq }),
                    kind: request.kind,
                    createdAt: Date.now(),
                };
                await table.put(request.sessionId, branch);
                return branch;
            });
        }
        /**
         * Remove one branch record; branches of that Session keep their own records.
         * @param request - branch Session.
         * @returns whether a record existed.
         */
        unlink(request) {
            return this.serialize(async () => ({
                removed: await (await this.ready).table('branches').delete(request.sessionId),
            }));
        }
        serialize(operation) {
            const pending = this.tail.then(operation);
            this.tail = pending.catch(() => { });
            return pending;
        }
    };
})();
export { SessionLineage };
//# sourceMappingURL=lineage.js.map