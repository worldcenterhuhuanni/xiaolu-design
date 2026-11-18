/** Mount the lineage and group Remotes, then replace the Chat view with the depth stage and route the composer's questions through it. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ObservableSnapshot, SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SubmitOutcome } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-message-feedback/remote'
import type { MessageId } from '@deepseek-ai/dsh-llm/brand'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionBranchKind } from '../types.ts'
import designRemote from 'dsh-xiaolu-design/remote'
import { en, zh, type DesignKey } from './locales.ts'
import { createDesignModel } from './model.ts'
import { Palette, type PaletteInjected } from './Palette.tsx'
import { RouteDock, type DockInjected } from './Dock.tsx'
import { createBackground } from './background/bg.ts'
import { WaterFrame, type FrameInjected, type Water } from './Frame.tsx'
import { StageView, type Rating, type StageInjected } from './Stage.tsx'
import { INITIAL_STATE, routeOf, type Scene, type Shown, type ShownTurn, type StageState } from './state.ts'
import { followersOf, indexLineage, NO_PREFIX, type Lineage } from './tree.ts'

declare module '@deepseek-ai/dsh-api-session-controller/client' {
  interface SessionReferenceSourceMap {
    /** Holds a new branch Session while its first question is sent. */
    xiaoluDesignBranch: unknown
  }
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Depth stage copy. */
    xiaoluDesign: DesignKey
  }
}

/** Slots, dictionaries, the Remote carrier, the Session catalog and Session navigation. */
export const inject = ['slots', 'locale', 'remote', 'sessions', 'uiWorkspace']

/**
 * Mount both Remotes, then register the stage for the same plugin lifetime.
 * @param ctx - Client plugin context.
 * @returns disposer removing the stage before the Remote contributions.
 */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const unmount = await ctx.remote.$mount(designRemote)
  const stage = ctx.inject(['remote.sessionLineage', 'remote.sessionGroups'], registerStage)
  try { await stage } catch (error) { await stage.dispose(); await unmount(); throw error }
  return async () => { await stage.dispose(); await unmount() }
}

/** Header of the Conversation column while the stage owns it: nothing. */
function NoHeader(): null {
  return null
}

function registerStage(ctx: Context): void {
  const model = createDesignModel(ctx.remote)
  void model.refresh()
  // Session the stage shows; the shelf (not registered yet, see the TODO below) marks its tree.
  const current = createSnapshotStore<SessionId | null>(null, { flush: 'sync' })
  const scene = createSnapshotStore<Scene | null>(null, { flush: 'sync' })
  const focus = createSnapshotStore(false, { flush: 'sync' })
  // When each Session was last read: switching to a neighbouring answer returns to the branch below it read most recently.
  const readAt = createSnapshotStore<Readonly<Record<string, number>>>({}, { persist: { name: 'xiaolu-design.read-at' } })
  const states = new Map<SessionId, SnapshotStore<StageState>>()
  const votes = new Map<SessionId, SnapshotStore<Readonly<Record<string, Rating>>>>()
  const thinkTimes = new Map<string, number>()
  const shown = createSnapshotStore<Shown | null>(null, { flush: 'sync' })
  // Layers a Session about to be opened shares with the one in view, consumed when its stage mounts.
  const carried = new Map<SessionId, readonly ShownTurn[]>()
  /** Keep the turns that end at or before `cut` for the Session opened next; both Sessions hold the same events up to there. */
  const carry = (target: SessionId, cut: number): void => {
    const turns = shown.getSnapshot()?.turns ?? []
    carried.set(target, turns.filter(turn => turn.endSeq !== undefined && turn.endSeq <= cut))
  }
  const stored = <Value>(stores: Map<SessionId, SnapshotStore<Value>>, sessionId: SessionId, initial: Value): SnapshotStore<Value> => {
    let store = stores.get(sessionId)
    if (store === undefined) stores.set(sessionId, store = createSnapshotStore(initial, { flush: 'sync' }))
    return store
  }
  const stateOf = (sessionId: SessionId): SnapshotStore<StageState> => stored(states, sessionId, INITIAL_STATE)
  const patch = (sessionId: SessionId, change: Partial<StageState>): void => {
    const store = stateOf(sessionId)
    store.set({ ...store.getSnapshot(), ...change })
  }

  // ponytail: re-indexes on every catalog change, running flags included; index by id-set identity if large catalogs make this visible.
  let cache: { branches: unknown; byId: unknown; lineage: Lineage } | undefined
  const lineage: ObservableSnapshot<Lineage> = {
    getSnapshot: () => {
      const { branches } = model.source.getSnapshot()
      const { byId } = ctx.sessions.list.getSnapshot()
      if (cache?.branches !== branches || cache.byId !== byId) {
        cache = { branches, byId, lineage: indexLineage(branches, sessionId => byId[sessionId] !== undefined) }
      }
      return cache.lineage
    },
    subscribe: (listener) => {
      const stops = [model.source.subscribe(listener), ctx.sessions.list.subscribe(listener)]
      return () => { for (const stop of stops) stop() }
    },
  }

  /** Create the branch Session, record where it came from and keep it in its parent's group. */
  const fork = async (parent: SessionId, cut: number, kind: SessionBranchKind): Promise<SessionId> => {
    const cwd = ctx.sessions.list.getSnapshot().byId[parent]?.cwd
    const child = cut === NO_PREFIX
      ? await ctx.sessions.create(cwd === undefined ? {} : { cwd })
      // A branch is the same conversation, so it keeps the conversation's title.
      : await ctx.sessions.fork({ sessionId: parent, atSeq: cut })
    // An unrecorded branch still works as an independent Session, so a refused record does not stop the question.
    await model.link({ sessionId: child, parent, ...(cut === NO_PREFIX ? {} : { atSeq: cut }), kind })
    const group = model.source.getSnapshot().groupOf[parent]
    if (group !== undefined) await model.assign(child, group)
    return child
  }
  /** Show a branch at its newest turn and leave the parent where the reader was. */
  const enter = (parent: SessionId, child: SessionId, cut: number): void => {
    carry(child, cut)
    patch(parent, { editing: null })
    patch(child, { cursor: { kind: 'latest' }, editing: null })
    ctx.uiWorkspace.openSession(child)
  }
  const sent = (): void => {
    const shown = scene.getSnapshot()
    if (shown !== null) scene.set({ ...shown, sent: shown.sent + 1 })
  }
  /** Ask a question that never passed through the composer: a regeneration or a quick follow-up. */
  const ask = async (parent: SessionId, text: string, route: { cut: number; kind: SessionBranchKind } | null): Promise<void> => {
    sent()
    try {
      const target = route === null ? parent : await fork(parent, route.cut, route.kind)
      await ctx.sessions.using(target, { source: 'xiaoluDesignBranch' }, reference =>
        reference.binding.session.prompt([{ type: 'text', text }], 'queue'))
      if (route === null) patch(parent, { cursor: { kind: 'latest' } })
      else enter(parent, target, route.cut)
    } catch (error) {
      ctx.logger.warn('xiaolu-design: question from %s was not sent: %s', parent, String(error))
    }
  }

  // A question sent while reading an earlier turn, or while rewriting one, starts a branch and carries the draft's attachments with it.
  ctx.on('conversation/input-deliver', (delivery) => {
    sent()
    const route = routeOf(states.get(delivery.sessionId)?.getSnapshot() ?? INITIAL_STATE)
    if (route === null) {
      patch(delivery.sessionId, { cursor: { kind: 'latest' } })
      return undefined
    }
    return (async (): Promise<SubmitOutcome> => {
      try {
        const child = await fork(delivery.sessionId, route.cut, route.kind)
        const outcome = await ctx.sessions.using(child, { source: 'xiaoluDesignBranch' }, reference => delivery.send(reference.binding.session))
        enter(delivery.sessionId, child, route.cut)
        return outcome
      } catch (error) {
        ctx.logger.warn('xiaolu-design: branch from %s was not created: %s', delivery.sessionId, String(error))
        return { kind: 'error', text: t('stage.branch.failed') }
      }
    })()
  })

  // Ratings reuse the message-feedback capability and exist only while its Remote is mounted.
  let feedback: Context['remote']['messageFeedback'] | undefined
  ctx.inject(['remote.messageFeedback'], (scope) => {
    scope.effect(() => {
      feedback = scope.remote.messageFeedback
      return () => { feedback = undefined }
    }, 'xiaolu-design: message feedback')
  })
  const loadVotes = async (sessionId: SessionId): Promise<void> => {
    if (feedback === undefined) return
    const listed = await feedback.list({ sessionId })
    if (listed.ok && listed.value.ok) {
      stored(votes, sessionId, {}).set(Object.fromEntries(listed.value.value.items.map(item => [item.messageId, item.rating])))
    }
  }
  const vote = async (sessionId: SessionId, messageId: string, rating: Rating): Promise<void> => {
    if (feedback === undefined) return
    const listed = await feedback.list({ sessionId })
    if (!listed.ok || !listed.value.ok) return
    const existing = listed.value.value.items.find(item => item.messageId === messageId)
    const id = messageId as MessageId
    if (existing?.rating === rating) await feedback.delete({ sessionId, messageId: id, ifVersion: existing.version })
    else await feedback.put({ sessionId, messageId: id, rating, ifVersion: existing?.version ?? null })
    await loadVotes(sessionId)
  }

  ctx.effect(() => ctx.locale.register('xiaoluDesign', { zh, en }), 'xiaolu-design: dictionaries')
  const t = ctx.locale.bind('xiaoluDesign')
  // Registered under the shipped Chat view's id at a lower priority: the stage is the conversation, not another tab.
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'chat',
    priority: -1,
    order: 0,
    locale: 'xiaoluDesign',
    label: () => t('view.stage'),
    inject: (sessionId: SessionId): StageInjected => ({
      hooks: { lineage, design: model.source, stage: stateOf(sessionId), focus, votes: stored(votes, sessionId, {}) },
      seen: () => {
        current.set(sessionId)
        readAt.set({ ...readAt.getSnapshot(), [sessionId]: Date.now() })
        void loadVotes(sessionId).catch((error: unknown) => {
          ctx.logger.warn('xiaolu-design: ratings of %s were not loaded: %s', sessionId, String(error))
        })
      },
      patch: (change) => { patch(sessionId, change) },
      report: (turns) => { shown.set({ sessionId, turns }) },
      inherit: () => {
        const layers = carried.get(sessionId) ?? []
        carried.delete(sessionId)
        return layers
      },
      show: (shown) => { scene.set({ ...shown, sent: scene.getSnapshot()?.sent ?? 0 }) },
      setFocus: (on) => { focus.set(on) },
      regenerate: (cut, text) => { void ask(sessionId, text, { cut, kind: 'regenerate' }) },
      openBranch: (target, cut) => {
        const read = readAt.getSnapshot()
        const followers = followersOf(lineage.getSnapshot(), target, cut)
        // Each follower shares the turn after the cut, so the one read last is where the reader left this answer.
        const chosen = followers.reduce((best, candidate) => (read[candidate] ?? 0) > (read[best] ?? 0) ? candidate : best, target)
        patch(chosen, { cursor: { kind: 'cut', cut }, editing: null })
        carry(chosen, cut)
        ctx.uiWorkspace.openSession(chosen)
      },
      stop: () => { void ctx.sessions.binding(sessionId)?.session.cancel() },
      loadOlder: () => { void ctx.sessions.binding(sessionId)?.session.loadOlder() },
      copy: text => navigator.clipboard.writeText(text).then(() => true, () => false),
      vote: feedback === undefined ? undefined : (messageId, rating) => {
        void vote(sessionId, messageId, rating).catch((error: unknown) => {
          ctx.logger.warn('xiaolu-design: rating in %s was not saved: %s', sessionId, String(error))
        })
      },
      thinkTime: (turn, measured) => {
        const key = `${sessionId}:${String(turn)}`
        if (measured !== undefined) thinkTimes.set(key, measured)
        return thinkTimes.get(key)
      },
    }),
  }, StageView))
  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock',
    id: 'xiaolu-design.route',
    order: -10,
    locale: 'xiaoluDesign',
    inject: (sessionId: SessionId): DockInjected => ({
      hooks: { stage: stateOf(sessionId) },
      reset: () => {
        const state = stateOf(sessionId).getSnapshot()
        if (state.editing === null) { patch(sessionId, { cursor: { kind: 'latest' } }); return false }
        patch(sessionId, { editing: null })
        return true
      },
      ask: (text) => { void ask(sessionId, text, routeOf(stateOf(sessionId).getSnapshot())) },
    }),
  }, RouteDock))
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'xiaolu-design.palette',
    locale: 'xiaoluDesign',
    inject: (): PaletteInjected => ({
      hooks: { shown, lineage },
      search: async (query, signal) => {
        const found = await ctx.sessions.search(query, signal)
        return found.ok ? found.value.items : null
      },
      open: (sessionId) => { ctx.uiWorkspace.openSession(sessionId) },
      openTurn: (sessionId, turn) => { patch(sessionId, { cursor: { kind: 'turn', turn } }) },
      startSession: () => { ctx.uiWorkspace.startSession() },
    }),
  }, Palette))
  // The title row and the View tab strip give way: the whole Conversation column is the stage.
  ctx.slots.inject('conversation.header', () => ctx.slots.register({ name: 'conversation.header', priority: -1 }, NoHeader))
  // One water for the plugin's lifetime: undefined until a Conversation first needs it, null when WebGL is unavailable.
  let water: Water | null | undefined
  const waterOf = (): Water | null => {
    if (water !== undefined) return water
    const canvas = document.createElement('canvas')
    canvas.setAttribute('aria-hidden', 'true')
    try {
      water = { canvas, background: createBackground(canvas) }
    } catch {
      // WebGL is unavailable: the Conversation keeps the application background.
      water = null
    }
    return water
  }
  // Built while the page is idle, so the first question does not wait for shader compilation.
  ctx.effect(() => {
    const warm = setTimeout(waterOf, 1500)
    return () => { clearTimeout(warm) }
  }, 'xiaolu-design: water warm-up')
  ctx.effect(() => () => {
    water?.background.dispose()
    water?.canvas.remove()
    water = undefined
  }, 'xiaolu-design: water')
  ctx.slots.inject('conversation.hero.frame', () => ctx.slots.register({
    name: 'conversation.hero.frame',
    id: 'xiaolu-design.water',
    inject: (): FrameInjected => ({ hooks: { scene }, water: waterOf }),
  }, WaterFrame))
  // TODO: the horizontal Session shelf and its overview are still being designed; restore this registration and the Overview import.
  // ctx.slots.inject('shell.overlay', () => ctx.slots.register({
  //   name: 'shell.overlay',
  //   id: 'xiaolu-design.overview',
  //   locale: 'xiaoluDesign',
  //   inject: (): OverviewInjected => ({
  //     hooks: { design: model.source, lineage, current },
  //     open: (sessionId) => { ctx.uiWorkspace.openSession(sessionId) },
  //     startSession: () => { ctx.uiWorkspace.startSession() },
  //     pin: (sessionId, pinned) => {
  //       void (pinned ? ctx.uiWorkspace.pinSession(sessionId) : ctx.uiWorkspace.unpinSession(sessionId)).catch((error: unknown) => {
  //         ctx.logger.warn('xiaolu-design: pin change for %s failed: %s', sessionId, String(error))
  //       })
  //     },
  //     archive: (sessionId, archived) => {
  //       const change = archived ? ctx.uiWorkspace.archiveSession(sessionId) : ctx.uiWorkspace.unarchiveSession(sessionId)
  //       void change.catch((error: unknown) => {
  //         ctx.logger.warn('xiaolu-design: archive change for %s failed: %s', sessionId, String(error))
  //       })
  //     },
  //     createGroup: async (name, theme) => (await model.createGroup(name, theme))?.groupId,
  //     updateGroup: (groupId, change) => { void model.updateGroup(groupId, change) },
  //     dissolveGroup: (groupId) => { void model.removeGroup(groupId) },
  //     assign: (sessionId, groupId) => { void model.assign(sessionId, groupId) },
  //   }),
  // }, Overview))
}
