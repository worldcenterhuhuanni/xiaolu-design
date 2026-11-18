import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { routeOf } from "./state.js";
import css from './dock.module.css';
const QUICK = ['dock.quick.expand', 'dock.quick.example', 'dock.quick.summary', 'dock.quick.risk'];
/**
 * Route label and quick follow-ups of one Session's composer.
 * @param props - the composer zone, the stage locale and the entry's inject face.
 * @returns the label row, with the follow-ups when they apply.
 */
export function RouteDock({ input, inputActions, useStage, reset, ask, t }) {
    const state = useStage(snapshot => snapshot);
    const { editing, place } = state;
    const route = routeOf(state);
    const kind = editing !== null ? 'edit' : route !== null ? 'fork' : undefined;
    const label = editing !== null ? t('dock.edit', { turn: editing.index + 1 })
        : place === null ? t('dock.first')
            : route !== null ? t('dock.fork', { turn: place.index + 1 })
                : t('dock.continue', { turn: place.count });
    const title = editing !== null ? t('dock.edit.title')
        : route !== null && place !== null ? t('dock.fork.title', { turn: place.index + 1, count: place.count }) : undefined;
    const quick = place?.settled === true && editing === null && input.draft.trim() === '' && input.attachmentIds.length === 0;
    return (_jsxs("div", { className: css.dock, children: [_jsxs("button", { type: "button", className: css.mode, "data-kind": kind, title: title, disabled: kind === undefined, onClick: () => { if (reset())
                    inputActions.setDraft(''); }, children: [label, kind !== undefined && _jsx("b", { "aria-hidden": "true", children: "\u00D7" })] }), quick && QUICK.map(key => _jsx("button", { type: "button", className: css.quick, onClick: () => { ask(t(key)); }, children: t(key) }, key))] }));
}
//# sourceMappingURL=Dock.js.map