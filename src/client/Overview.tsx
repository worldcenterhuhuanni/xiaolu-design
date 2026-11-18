/**
 * Session shelf and overview. The shelf is a row of named Session tabs at the top of the
 * frame. The overview is a scene in depth: each group is a stack of cards, newest in front,
 * and the stacks stand side by side with the selected one facing the reader.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode, WheelEvent } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionGroupId } from '../types.ts'
import type { DesignData } from './model.ts'
import { THEMES, themeOf, themeVars } from './themes.ts'
import { bucketOf, rootOf } from './tree.ts'
import type { Lineage, TimeBucket } from './tree.ts'
import css from './overview.module.css'

gsap.registerPlugin(useGSAP)

/** Private data and callbacks of the overview entry. */
export interface OverviewInjected {
  hooks: {
    design: ObservableSnapshot<DesignData>
    lineage: ObservableSnapshot<Lineage>
    /** Session the stage shows, or null before any stage has mounted. */
    current: ObservableSnapshot<SessionId | null>
  }
  open: (sessionId: SessionId) => void
  startSession: () => void
  pin: (sessionId: SessionId, pinned: boolean) => void
  archive: (sessionId: SessionId, archived: boolean) => void
  createGroup: (name: string, theme: number) => Promise<SessionGroupId | undefined>
  updateGroup: (groupId: SessionGroupId, change: { name?: string; theme?: number }) => void
  dissolveGroup: (groupId: SessionGroupId) => void
  assign: (sessionId: SessionId, groupId: SessionGroupId | undefined) => void
}

type OverviewProps = PropsRuntime<'shell.overlay'> & PropsLocale<'xiaoluDesign'> & InjectFace<OverviewInjected>

/** One conversation tree shown as a tab or a card. */
interface Row {
  readonly sessionId: SessionId
  readonly title: string
  readonly at: number
  readonly running: boolean
  readonly branches: number
  readonly groupId: SessionGroupId | undefined
  readonly place: string
  readonly pinned: boolean
  readonly archived: boolean
}

/** One stack of the overview: every Session by time, one group, the ungrouped rest, or the new-group slot. */
interface Stack {
  readonly key: string
  readonly name: string
  readonly theme: number | undefined
  readonly groupId?: SessionGroupId
  readonly rows: readonly Row[]
}

const RECENT = 'recent'
const UNGROUPED = 'ungrouped'
const NEW_GROUP = 'new'
/** Each card further back rises by this much, which shows exactly its top edge. */
const STEP = 30
/** Top edges visible behind the front card of the facing stack; side stacks show two. */
const DEEP = 6
/** Tabs on the shelf. */
const SHELF = 6
const RANGES: Readonly<Record<string, readonly TimeBucket[] | null>> = {
  all: null, today: ['today'], week: ['today', 'yesterday', 'week'], month: ['today', 'yesterday', 'week', 'month'],
}
const calm = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Session shelf and overview in the frame-wide overlay layer.
 * @param props - root standard props, the overview locale and the entry's inject face.
 * @returns the shelf, and the overview while it is open.
 */
export function Overview(props: OverviewProps): ReactNode {
  const { useSessions, useWorkspaces, useDesign, useLineage, useCurrent, t } = props
  const { open: openSession, startSession, pin, archive, createGroup, updateGroup, dissolveGroup, assign } = props
  const list = useSessions(snapshot => snapshot)
  const pinnedIds = useWorkspaces(snapshot => snapshot.pinnedSessionIds)
  const archivedIds = useWorkspaces(snapshot => snapshot.archivedSessionIds)
  const design = useDesign(snapshot => snapshot)
  const lineage = useLineage(snapshot => snapshot)
  const current = useCurrent(snapshot => snapshot)
  const [shown, setShown] = useState(false)
  const [book, setBook] = useState(RECENT)
  const [fronts, setFronts] = useState<Readonly<Record<string, number>>>({})
  const [filter, setFilter] = useState('')
  const [range, setRange] = useState('all')
  const [archivedOnly, setArchivedOnly] = useState(false)
  const [renaming, setRenaming] = useState<SessionGroupId | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const flow = useRef<HTMLDivElement>(null)
  const wheel = useRef({ acc: 0, at: 0 })
  const currentRoot = current === null ? null : rootOf(lineage, current)

  // One row per conversation tree: branches fold into their root and lend it their latest activity.
  const rows = useMemo<Row[]>(() => {
    const pinned = new Set<string>(pinnedIds)
    const archived = new Set<string>(archivedIds)
    const trees = new Map<SessionId, { at: number; running: boolean; branches: number }>()
    for (const sessionId of list.ids) {
      const session = list.byId[sessionId]
      if (session === undefined || session.origin === 'subagent') continue
      const root = rootOf(lineage, sessionId)
      const tree = trees.get(root) ?? { at: 0, running: false, branches: 0 }
      trees.set(root, { at: Math.max(tree.at, session.updatedAt), running: tree.running || session.running, branches: tree.branches + 1 })
    }
    return [...trees].flatMap(([sessionId, tree]) => {
      const session = list.byId[sessionId]
      if (session === undefined || session.blank) return []
      return [{
        sessionId, title: session.title ?? t('wall.untitled'), at: tree.at, running: tree.running, branches: tree.branches,
        groupId: design.groupOf[sessionId], place: session.cwd?.split(/[\\/]/).findLast(part => part !== '') ?? '',
        pinned: pinned.has(sessionId), archived: archived.has(sessionId),
      }]
    }).sort((left, right) => Number(right.pinned) - Number(left.pinned) || right.at - left.at)
  }, [list, lineage, design.groupOf, pinnedIds, archivedIds, t])

  const stacks = useMemo<Stack[]>(() => {
    const now = Date.now()
    const needle = filter.trim().toLowerCase()
    const buckets = RANGES[range] ?? null
    const visible = rows.filter(row => row.archived === archivedOnly
      && (needle === '' || row.title.toLowerCase().includes(needle))
      && (buckets === null || row.pinned || buckets.includes(bucketOf(row.at, now))))
    const ungrouped = visible.filter(row => row.groupId === undefined || !design.groups.some(group => group.groupId === row.groupId))
    return [
      { key: RECENT, name: t('wall.recent'), theme: undefined, rows: visible },
      ...design.groups.map(group => ({
        key: group.groupId, name: group.name, theme: group.theme, groupId: group.groupId,
        rows: visible.filter(row => row.groupId === group.groupId),
      })),
      ...(design.groups.length > 0 && ungrouped.length > 0 ? [{ key: UNGROUPED, name: t('wall.ungrouped'), theme: undefined, rows: ungrouped }] : []),
      { key: NEW_GROUP, name: t('wall.newGroup'), theme: undefined, rows: [] },
    ]
  }, [rows, design.groups, filter, range, archivedOnly, t])

  const facing = Math.max(0, stacks.findIndex(stack => stack.key === book))
  const turn = (direction: number): void => {
    const next = stacks[Math.max(0, Math.min(stacks.length - 1, facing + direction))]
    if (next !== undefined) setBook(next.key)
  }
  const flip = (direction: number): void => {
    const stack = stacks[facing]
    if (stack === undefined) return
    const next = Math.max(0, Math.min(stack.rows.length - 1, (fronts[stack.key] ?? 0) + direction))
    setFronts({ ...fronts, [stack.key]: next })
  }
  const pick = (sessionId: SessionId): void => {
    setShown(false)
    openSession(sessionId)
  }
  const addGroup = async (sessionId?: SessionId): Promise<void> => {
    const used = THEMES.map((_, index) => design.groups.filter(group => group.theme % THEMES.length === index).length)
    const groupId = await createGroup(t('wall.group.default'), used.indexOf(Math.min(...used)))
    if (groupId === undefined) return
    if (sessionId !== undefined) assign(sessionId, groupId)
    setBook(groupId)
    setRenaming(groupId)
  }
  const drop = (stack: Stack, sessionId: string): void => {
    setOver(null)
    const row = rows.find(candidate => candidate.sessionId === sessionId)
    if (row === undefined) return
    if (stack.key === NEW_GROUP) void addGroup(row.sessionId)
    else if (stack.key === UNGROUPED) assign(row.sessionId, undefined)
    else if (stack.groupId !== undefined) assign(row.sessionId, stack.groupId)
  }

  useEffect(() => {
    if (!shown) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') { setShown(false); return }
      if (event.target instanceof HTMLElement && event.target.closest('input, select') !== null) return
      if (event.key === 'ArrowLeft') turn(-1)
      else if (event.key === 'ArrowRight') turn(1)
      else if (event.key === 'ArrowUp') flip(1)
      else if (event.key === 'ArrowDown') flip(-1)
      else return
      event.preventDefault()
    }
    addEventListener('keydown', onKey)
    return () => { removeEventListener('keydown', onKey) }
  })

  // Place every stack and every card in depth: the facing stack stays, the others fan out, recede and turn inward.
  useGSAP(() => {
    if (!shown || flow.current === null) return
    const duration = calm() ? 0 : 0.75
    const first = Math.min(392, innerWidth * 0.29)
    const gap = Math.min(168, innerWidth / 8.5)
    gsap.utils.toArray<HTMLElement>('[data-stack]', flow.current).forEach((element, index) => {
      const offset = index - facing
      const away = Math.abs(offset)
      const side = Math.sign(offset)
      gsap.to(element, {
        x: side * (first + (away - 1) * gap), z: away === 0 ? 0 : -230 - (away - 1) * 110, rotationY: -side * 46,
        autoAlpha: away > 3 ? 0 : 1, duration, ease: 'power3.out', overwrite: 'auto',
      })
      const front = fronts[element.dataset['stack'] ?? ''] ?? 0
      gsap.utils.toArray<HTMLElement>('[data-card]', element).forEach((card) => {
        const behind = Number(card.dataset['card']) - front
        gsap.to(card, behind < 0
          ? { y: 120, z: 200, autoAlpha: 0, duration, ease: 'power3.out', overwrite: 'auto' }
          : { y: -STEP * behind, z: -78 * behind, autoAlpha: behind > (away === 0 ? DEEP : 2) ? 0 : 1, duration, ease: 'power3.out', overwrite: 'auto' })
      })
    })
  }, { scope: flow, dependencies: [shown, facing, fronts, stacks] })

  const onWheel = (event: WheelEvent<HTMLDivElement>): void => {
    const state = wheel.current
    const now = performance.now()
    if (now - state.at < 260) return
    state.acc += Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
    if (Math.abs(state.acc) < 60) return
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) turn(Math.sign(state.acc))
    else flip(Math.sign(state.acc))
    state.acc = 0
    state.at = now
  }

  const now = Date.now()
  const groupTheme = (groupId: SessionGroupId | undefined): number | undefined =>
    design.groups.find(group => group.groupId === groupId)?.theme
  const shelf = rows.filter(row => !row.archived || row.sessionId === currentRoot).slice(0, SHELF)

  return (
    <div className={css.root} style={themeVars(themeOf(currentRoot ?? '', groupTheme(currentRoot === null ? undefined : design.groupOf[currentRoot])))}>
      <nav className={css.shelf} aria-label={t('shelf.label')}>
        <button type="button" className={css.newbtn} onClick={() => { setShown(false); startSession() }}><b aria-hidden="true">＋</b>{t('shelf.new')}</button>
        {shelf.map(row => (
          <button
            key={row.sessionId}
            type="button"
            className={css.tab}
            style={themeVars(themeOf(row.sessionId, groupTheme(row.groupId)))}
            data-current={row.sessionId === currentRoot || undefined}
            data-live={row.running || undefined}
            aria-current={row.sessionId === currentRoot || undefined}
            title={row.title}
            onClick={() => { pick(row.sessionId) }}
          >
            <i className={css.orb} aria-hidden="true" /><span>{row.title}</span>
          </button>
        ))}
        <button type="button" className={css.more} aria-expanded={shown} onClick={() => { setShown(value => !value) }}>{t('shelf.all')}</button>
      </nav>

      {shown && (
        <section className={css.wall} aria-label={t('wall.label')}>
          <div className={css.wbar}>
            <input className={css.wfilter} value={filter} placeholder={t('wall.filter')} aria-label={t('wall.filter')} onChange={(event) => { setFilter(event.target.value) }} />
            <span className={css.wrange}>
              {(['all', 'today', 'week', 'month'] as const).map(key => (
                <button key={key} type="button" aria-pressed={range === key} onClick={() => { setRange(key) }}>{t(`wall.range.${key}`)}</button>
              ))}
            </span>
            <button type="button" aria-pressed={archivedOnly} onClick={() => { setArchivedOnly(value => !value) }}>{t('wall.archived')}</button>
            <button type="button" onClick={() => { setShown(false) }}>{t('wall.close')}</button>
          </div>

          <div className={css.flow} ref={flow} onWheel={onWheel}>
            {stacks.map((stack, index) => {
              const front = Math.min(fronts[stack.key] ?? 0, Math.max(0, stack.rows.length - 1))
              const isFacing = index === facing
              return (
                <div
                  key={stack.key}
                  className={css.stack}
                  data-stack={stack.key}
                  data-front={isFacing || undefined}
                  data-over={over === stack.key || undefined}
                  style={{ zIndex: 100 - Math.abs(index - facing), ...themeVars(themeOf(stack.key, stack.theme)) }}
                  onClick={isFacing ? undefined : () => { setBook(stack.key) }}
                  onDragOver={stack.key === RECENT ? undefined : (event) => { event.preventDefault(); setOver(stack.key) }}
                  onDragLeave={() => { setOver(null) }}
                  onDrop={(event) => { event.preventDefault(); drop(stack, event.dataTransfer.getData('text/plain')) }}
                >
                  <div className={css.pile}>
                    {stack.rows.length === 0 && (
                      <button type="button" className={css.wempty} onClick={stack.key === NEW_GROUP && isFacing ? () => { void addGroup() } : undefined}>
                        {stack.key === NEW_GROUP ? <><b aria-hidden="true">＋</b>{t('wall.newGroup')}<small>{t('wall.newGroup.hint')}</small></> : t('wall.empty')}
                      </button>
                    )}
                    {stack.rows.map((row, order) => {
                      // Only the card flying out and the visible top edges are mounted; a catalog can hold hundreds of Sessions.
                      if (order < front - 1 || order > front + DEEP + 1) return null
                      const top = order === front
                      const theme = themeOf(row.sessionId, groupTheme(row.groupId))
                      return (
                        <article
                          key={row.sessionId}
                          className={css.wcard}
                          data-card={order}
                          data-top={top || undefined}
                          data-current={row.sessionId === currentRoot || undefined}
                          draggable={isFacing && top}
                          style={{ zIndex: 50 - Math.abs(order - front), '--k': Math.max(0, order - front), ...themeVars(theme) } as React.CSSProperties}
                          onDragStart={(event) => { event.dataTransfer.setData('text/plain', row.sessionId) }}
                          onClick={isFacing ? (event) => {
                            if (event.target instanceof HTMLElement && event.target.closest('footer') !== null) return
                            if (top) pick(row.sessionId)
                            else setFronts({ ...fronts, [stack.key]: order })
                          } : undefined}
                        >
                          <header>
                            <i className={css.orb} aria-hidden="true" />
                            <h3>{row.title}</h3>
                            {row.running && <i className={css.wlive} aria-hidden="true" />}
                            <time><b>{t(`wall.bucket.${bucketOf(row.at, now)}`)}</b></time>
                          </header>
                          <p className={css.wa}>{row.place}</p>
                          {row.branches > 1 && <p className={css.wq}>{t('wall.branches', { count: row.branches })}</p>}
                          <footer>
                            <label className={css.wmove}>
                              <select
                                aria-label={t('wall.card.move')}
                                value={row.groupId ?? ''}
                                onChange={(event) => {
                                  assign(row.sessionId, design.groups.find(group => group.groupId === event.target.value)?.groupId)
                                }}
                              >
                                <option value="">{t('wall.ungrouped')}</option>
                                {design.groups.map(group => <option key={group.groupId} value={group.groupId}>{group.name}</option>)}
                              </select>
                            </label>
                            <button type="button" onClick={() => { pin(row.sessionId, !row.pinned) }}>{t(row.pinned ? 'wall.card.unpin' : 'wall.card.pin')}</button>
                            <button type="button" onClick={() => { archive(row.sessionId, !row.archived) }}>{t(row.archived ? 'wall.card.unarchive' : 'wall.card.archive')}</button>
                          </footer>
                        </article>
                      )
                    })}
                  </div>
                  <div className={css.cap}>
                    <i className={css.orb} aria-hidden="true" />
                    {stack.groupId !== undefined && renaming === stack.groupId
                      ? (
                        <input
                          autoFocus
                          defaultValue={stack.name}
                          maxLength={40}
                          aria-label={t('wall.group.rename')}
                          onClick={(event) => { event.stopPropagation() }}
                          onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
                          onBlur={(event) => {
                            const name = event.target.value.trim()
                            if (name !== '' && name !== stack.name && stack.groupId !== undefined) updateGroup(stack.groupId, { name })
                            setRenaming(null)
                          }}
                        />
                      )
                      : <h4>{stack.name}</h4>}
                    <small>{stack.key === NEW_GROUP ? '' : t('wall.count', { count: stack.rows.length })}</small>
                    {stack.groupId !== undefined && (
                      <nav>
                        <button type="button" onClick={() => { setRenaming(stack.groupId ?? null) }}>{t('wall.group.rename')}</button>
                        <button type="button" onClick={() => { if (stack.groupId !== undefined) updateGroup(stack.groupId, { theme: ((stack.theme ?? 0) + 1) % THEMES.length }) }}>{t('wall.group.recolor')}</button>
                        <button type="button" data-danger title={t('wall.group.dissolve.title')} onClick={() => { if (stack.groupId !== undefined) dissolveGroup(stack.groupId); setBook(RECENT) }}>{t('wall.group.dissolve')}</button>
                      </nav>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className={css.pills}>
            {stacks.map(stack => (
              <button
                key={stack.key}
                type="button"
                className={css.pill}
                style={themeVars(themeOf(stack.key, stack.theme))}
                data-on={stack.key === book || undefined}
                data-over={over === stack.key || undefined}
                data-add={stack.key === NEW_GROUP || undefined}
                onClick={() => { setBook(stack.key) }}
                onDragOver={stack.key === RECENT ? undefined : (event) => { event.preventDefault(); setOver(stack.key) }}
                onDragLeave={() => { setOver(null) }}
                onDrop={(event) => { event.preventDefault(); drop(stack, event.dataTransfer.getData('text/plain')) }}
              >
                {stack.key === NEW_GROUP ? <b aria-hidden="true">＋</b> : <i className={css.orb} aria-hidden="true" />}
                {stack.name}
                {stack.key !== NEW_GROUP && <small>{stack.rows.length}</small>}
              </button>
            ))}
          </div>
          <p className={css.whint}>{t('wall.hint')}</p>
        </section>
      )}
    </div>
  )
}
