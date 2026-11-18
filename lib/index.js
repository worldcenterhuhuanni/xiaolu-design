import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Service } from "@deepseek-ai/cordis";
import { brandString } from "@deepseek-ai/dsh-brand";
import { defineDomain, domainTable } from "@deepseek-ai/dsh-storage-domain";
import { Remote, RemoteError, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
//#region lib/types/groups.js
/**
* Session groups: user-defined groups and the group each Session belongs to. Groups are
* labels beside Workspaces, which follow directories. Records live outside Session logs.
*/
var __runInitializers$1 = function(thisArg, initializers, value) {
	var useValue = arguments.length > 2;
	for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
	return useValue ? value : void 0;
};
var __esDecorate$1 = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
	function accept(f) {
		if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
		return f;
	}
	var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
	var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
	var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
	var _, done = false;
	for (var i = decorators.length - 1; i >= 0; i--) {
		var context = {};
		for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
		for (var p in contextIn.access) context.access[p] = contextIn.access[p];
		context.addInitializer = function(f) {
			if (done) throw new TypeError("Cannot add initializers after decoration has completed");
			extraInitializers.push(accept(f || null));
		};
		var result = (0, decorators[i])(kind === "accessor" ? {
			get: descriptor.get,
			set: descriptor.set
		} : descriptor[key], context);
		if (kind === "accessor") {
			if (result === void 0) continue;
			if (result === null || typeof result !== "object") throw new TypeError("Object expected");
			if (_ = accept(result.get)) descriptor.get = _;
			if (_ = accept(result.set)) descriptor.set = _;
			if (_ = accept(result.init)) initializers.unshift(_);
		} else if (_ = accept(result)) if (kind === "field") initializers.unshift(_);
		else descriptor[key] = _;
	}
	if (target) Object.defineProperty(target, contextIn.name, descriptor);
	done = true;
};
/** Longest stored group name, in UTF-16 code units. */
const NAME_MAX = 40;
const groupId = z.string().min(1).transform((value) => brandString(value));
const sessionId$1 = z.string().min(1).transform((value) => brandString(value));
const groupSchema = z.object({
	groupId,
	name: z.string().min(1).max(NAME_MAX),
	theme: z.number().int().nonnegative(),
	createdAt: z.number()
});
const memberSchema = z.object({
	sessionId: sessionId$1,
	groupId
});
/** Storage domain of groups, keyed by group id, and memberships, keyed by Session id. */
const sessionGroupsDomain = defineDomain({
	name: "session_groups",
	version: 1,
	layout: "per-record",
	tables: {
		groups: domainTable(groupSchema),
		members: domainTable(memberSchema)
	}
});
function invalid$1(reason) {
	return new RemoteError("session-groups/invalid", `session group request was rejected: ${reason}`, { reason });
}
function validName(value) {
	const trimmed = value.trim();
	if (trimmed === "" || trimmed.length > NAME_MAX) throw invalid$1("bad-name");
	return trimmed;
}
function validTheme(value) {
	if (!(Number.isSafeInteger(value) && value >= 0)) throw invalid$1("bad-theme");
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
			__esDecorate$1(this, null, _list_decorators, {
				kind: "method",
				name: "list",
				static: false,
				private: false,
				access: {
					has: (obj) => "list" in obj,
					get: (obj) => obj.list
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate$1(this, null, _create_decorators, {
				kind: "method",
				name: "create",
				static: false,
				private: false,
				access: {
					has: (obj) => "create" in obj,
					get: (obj) => obj.create
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate$1(this, null, _update_decorators, {
				kind: "method",
				name: "update",
				static: false,
				private: false,
				access: {
					has: (obj) => "update" in obj,
					get: (obj) => obj.update
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate$1(this, null, _dissolve_decorators, {
				kind: "method",
				name: "dissolve",
				static: false,
				private: false,
				access: {
					has: (obj) => "dissolve" in obj,
					get: (obj) => obj.dissolve
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate$1(this, null, _assign_decorators, {
				kind: "method",
				name: "assign",
				static: false,
				private: false,
				access: {
					has: (obj) => "assign" in obj,
					get: (obj) => obj.assign
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			if (_metadata) Object.defineProperty(this, Symbol.metadata, {
				enumerable: true,
				configurable: true,
				writable: true,
				value: _metadata
			});
		}
		static inject = ["storageDomain"];
		ready = __runInitializers$1(this, _instanceExtraInitializers);
		initialized;
		/** Serializes each existence check with its writes. */
		tail = Promise.resolve();
		constructor(ctx) {
			super(ctx, "sessionGroups");
			this.ready = ctx.storageDomain.open(sessionGroupsDomain);
			this.initialized = ctx.effect(async () => {
				const domain = await this.ready;
				return async () => {
					await this.tail;
					await domain.close();
				};
			}, "session-groups: storage");
		}
		async [Service.init]() {
			await this.initialized;
		}
		/** @returns every group, oldest first, and every membership. */
		async list() {
			const domain = await this.ready;
			return {
				groups: [...domain.table("groups").entries()].map(([, group]) => group).sort((left, right) => left.createdAt - right.createdAt),
				members: [...domain.table("members").entries()].map(([, member]) => member)
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
					createdAt: Date.now()
				};
				await (await this.ready).table("groups").put(group.groupId, group);
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
				const table = (await this.ready).table("groups");
				const current = table.get(request.groupId);
				if (current === void 0) throw invalid$1("unknown-group");
				const group = {
					...current,
					...request.name === void 0 ? {} : { name: validName(request.name) },
					...request.theme === void 0 ? {} : { theme: validTheme(request.theme) }
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
				const members = domain.table("members");
				const released = [...members.entries()].filter(([, member]) => member.groupId === request.groupId).map(([id]) => id);
				for (const id of released) await members.delete(id);
				await domain.table("groups").delete(request.groupId);
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
				if (request.groupId === void 0) {
					await domain.table("members").delete(request.sessionId);
					return;
				}
				if (domain.table("groups").get(request.groupId) === void 0) throw invalid$1("unknown-group");
				await domain.table("members").put(request.sessionId, {
					sessionId: request.sessionId,
					groupId: request.groupId
				});
			});
		}
		serialize(operation) {
			const pending = this.tail.then(operation);
			this.tail = pending.catch(() => {});
			return pending;
		}
	};
})();
//#endregion
//#region lib/types/lineage.js
/**
* Session lineage: a durable table of which Session branched from which Session and at
* which event. Forking copies an event prefix and records no source, so this table is the
* only link between a branch and its origin. Records live outside Session logs.
*/
var __runInitializers = function(thisArg, initializers, value) {
	var useValue = arguments.length > 2;
	for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
	return useValue ? value : void 0;
};
var __esDecorate = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
	function accept(f) {
		if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
		return f;
	}
	var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
	var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
	var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
	var _, done = false;
	for (var i = decorators.length - 1; i >= 0; i--) {
		var context = {};
		for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
		for (var p in contextIn.access) context.access[p] = contextIn.access[p];
		context.addInitializer = function(f) {
			if (done) throw new TypeError("Cannot add initializers after decoration has completed");
			extraInitializers.push(accept(f || null));
		};
		var result = (0, decorators[i])(kind === "accessor" ? {
			get: descriptor.get,
			set: descriptor.set
		} : descriptor[key], context);
		if (kind === "accessor") {
			if (result === void 0) continue;
			if (result === null || typeof result !== "object") throw new TypeError("Object expected");
			if (_ = accept(result.get)) descriptor.get = _;
			if (_ = accept(result.set)) descriptor.set = _;
			if (_ = accept(result.init)) initializers.unshift(_);
		} else if (_ = accept(result)) if (kind === "field") initializers.unshift(_);
		else descriptor[key] = _;
	}
	if (target) Object.defineProperty(target, contextIn.name, descriptor);
	done = true;
};
const sessionId = z.string().min(1).transform((value) => brandString(value));
/** Storage domain of branch records, keyed by the branch Session id. */
const sessionLineageDomain = defineDomain({
	name: "session_lineage",
	version: 1,
	layout: "per-record",
	tables: { branches: domainTable(z.object({
		sessionId,
		parent: sessionId,
		atSeq: z.number().int().nonnegative().optional(),
		kind: z.enum([
			"ask",
			"regenerate",
			"edit"
		]),
		createdAt: z.number()
	})) }
});
function invalid(sessionId, reason) {
	return new RemoteError("session-lineage/invalid", `branch record for session "${sessionId}" was rejected: ${reason}`, {
		sessionId,
		reason
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
			__esDecorate(this, null, _list_decorators, {
				kind: "method",
				name: "list",
				static: false,
				private: false,
				access: {
					has: (obj) => "list" in obj,
					get: (obj) => obj.list
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _link_decorators, {
				kind: "method",
				name: "link",
				static: false,
				private: false,
				access: {
					has: (obj) => "link" in obj,
					get: (obj) => obj.link
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _unlink_decorators, {
				kind: "method",
				name: "unlink",
				static: false,
				private: false,
				access: {
					has: (obj) => "unlink" in obj,
					get: (obj) => obj.unlink
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			if (_metadata) Object.defineProperty(this, Symbol.metadata, {
				enumerable: true,
				configurable: true,
				writable: true,
				value: _metadata
			});
		}
		static inject = ["storageDomain"];
		ready = __runInitializers(this, _instanceExtraInitializers);
		initialized;
		/** Serializes the cycle check with its write. */
		tail = Promise.resolve();
		constructor(ctx) {
			super(ctx, "sessionLineage");
			this.ready = ctx.storageDomain.open(sessionLineageDomain);
			this.initialized = ctx.effect(async () => {
				const domain = await this.ready;
				return async () => {
					await this.tail;
					await domain.close();
				};
			}, "session-lineage: storage");
		}
		async [Service.init]() {
			await this.initialized;
		}
		/** @returns every branch record, oldest first. */
		async list() {
			return [...(await this.ready).table("branches").entries()].map(([, branch]) => branch).sort((left, right) => left.createdAt - right.createdAt);
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
				if (request.sessionId === request.parent) throw invalid(request.sessionId, "self-parent");
				if (request.atSeq !== void 0 && !(Number.isSafeInteger(request.atSeq) && request.atSeq >= 0)) throw invalid(request.sessionId, "bad-seq");
				const table = (await this.ready).table("branches");
				for (let ancestor = table.get(request.parent); ancestor !== void 0; ancestor = table.get(ancestor.parent)) if (ancestor.parent === request.sessionId) throw invalid(request.sessionId, "cycle");
				const branch = {
					sessionId: request.sessionId,
					parent: request.parent,
					...request.atSeq === void 0 ? {} : { atSeq: request.atSeq },
					kind: request.kind,
					createdAt: Date.now()
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
			return this.serialize(async () => ({ removed: await (await this.ready).table("branches").delete(request.sessionId) }));
		}
		serialize(operation) {
			const pending = this.tail.then(operation);
			this.tail = pending.catch(() => {});
			return pending;
		}
	};
})();
//#endregion
//#region lib/types/index.js
const name = "xiaolu-design";
/** The storage domain facility holds the branch, group and membership tables. */
const inject = ["storageDomain"];
/**
* Open the tables and mount the `sessionLineage` and `sessionGroups` Remotes; disposing the plugin closes the tables.
* @param ctx - Owning plugin context.
*/
async function apply(ctx) {
	await ctx.plugin(SessionLineage);
	await ctx.plugin(SessionGroups);
}
//#endregion
export { SessionGroups, SessionLineage, apply, inject, name, sessionGroupsDomain, sessionLineageDomain };
