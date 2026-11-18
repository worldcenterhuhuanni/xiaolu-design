/**
 * Route label above the composer: it always says where the next question lands, and selecting
 * it returns to the plain continuation. Quick follow-ups appear below it while the turn in view
 * has settled and the draft is empty.
 */
import type { ReactNode } from 'react'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import { routeOf } from './state.ts'
import type { StageState } from './state.ts'
import css from './dock.module.css'

/** Private data and callbacks of the route label entry. */
export interface DockInjected {
  hooks: { stage: ObservableSnapshot<StageState> }
  /** Leave the rewrite, or return to the latest turn when no rewrite is open. @returns whether a rewrite was left. */
  reset: () => boolean
  /** Ask a ready-made question from the turn in view. */
  ask: (text: string) => void
}

type DockProps = PropsRuntime<'conversation.input.dock'> & PropsLocale<'xiaoluDesign'> & InjectFace<DockInjected>

const QUICK = ['dock.quick.expand', 'dock.quick.example', 'dock.quick.summary', 'dock.quick.risk'] as const

/**
 * Route label and quick follow-ups of one Session's composer.
 * @param props - the composer zone, the stage locale and the entry's inject face.
 * @returns the label row, with the follow-ups when they apply.
 */
export function RouteDock({ input, inputActions, useStage, reset, ask, t }: DockProps): ReactNode {
  const state = useStage(snapshot => snapshot)
  const { editing, place } = state
  const route = routeOf(state)
  const kind = editing !== null ? 'edit' : route !== null ? 'fork' : undefined
  const label = editing !== null ? t('dock.edit', { turn: editing.index + 1 })
    : place === null ? t('dock.first')
      : route !== null ? t('dock.fork', { turn: place.index + 1 })
        : t('dock.continue', { turn: place.count })
  const title = editing !== null ? t('dock.edit.title')
    : route !== null && place !== null ? t('dock.fork.title', { turn: place.index + 1, count: place.count }) : undefined
  const quick = place?.settled === true && editing === null && input.draft.trim() === '' && input.attachmentIds.length === 0
  return (
    <div className={css.dock}>
      <button type="button" className={css.mode} data-kind={kind} title={title} disabled={kind === undefined} onClick={() => { if (reset()) inputActions.setDraft('') }}>
        {label}{kind !== undefined && <b aria-hidden="true">×</b>}
      </button>
      {quick && QUICK.map(key => <button key={key} type="button" className={css.quick} onClick={() => { ask(t(key)) }}>{t(key)}</button>)}
    </div>
  )
}
