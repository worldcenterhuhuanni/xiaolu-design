import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Search palette on Cmd/Ctrl+K. Empty, it lists conversations to switch to; with a query it
 * searches conversation titles, the turns of the conversation in view, and the message
 * content of every Session. Branches of one conversation appear as that conversation.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { rootOf } from "./tree.js";
import css from './palette.module.css';
/** Rows kept per source, so one source cannot push the others out of the list. */
const LIMIT = 12;
function Marked({ text, query }) {
    const at = query === '' ? -1 : text.toLowerCase().indexOf(query.toLowerCase());
    if (at < 0)
        return text;
    return _jsxs(_Fragment, { children: [text.slice(0, at), _jsx("mark", { children: text.slice(at, at + query.length) }), text.slice(at + query.length)] });
}
/**
 * Search palette of the application.
 * @param props - the Session catalog, the palette locale and the entry's inject face.
 * @returns a modal dialog, closed until the shortcut opens it.
 */
export function Palette(props) {
    const { useSessions, useShown, useLineage, search, open, openTurn, startSession, t } = props;
    const list = useSessions(snapshot => snapshot);
    const shown = useShown(snapshot => snapshot);
    const lineage = useLineage(snapshot => snapshot);
    const dialog = useRef(null);
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(0);
    const [hits, setHits] = useState([]);
    const needle = query.trim();
    useEffect(() => {
        const onKey = (event) => {
            if (!(event.metaKey || event.ctrlKey) || event.altKey || event.key.toLowerCase() !== 'k')
                return;
            event.preventDefault();
            event.stopPropagation();
            if (dialog.current?.open === true)
                return;
            setQuery('');
            setActive(0);
            dialog.current?.showModal();
        };
        // Capture: the palette takes the shortcut before the application's own Session search does.
        addEventListener('keydown', onKey, true);
        return () => { removeEventListener('keydown', onKey, true); };
    }, []);
    // Content search runs on the Host; a superseded query is cancelled.
    useEffect(() => {
        if (needle === '') {
            setHits([]);
            return;
        }
        const control = new AbortController();
        const timer = setTimeout(() => {
            void search(needle, control.signal).then((found) => { if (!control.signal.aborted)
                setHits(found); }, () => {
                if (!control.signal.aborted)
                    setHits(null);
            });
        }, 180);
        return () => { clearTimeout(timer); control.abort(); };
    }, [needle]);
    const rows = useMemo(() => {
        const title = (sessionId) => list.byId[sessionId]?.title ?? t('wall.untitled');
        const roots = [...new Set(list.ids.map(sessionId => rootOf(lineage, sessionId)))];
        if (needle === '') {
            return [
                { key: 'new', tag: '＋', text: t('shelf.new'), sub: '', pick: startSession },
                ...roots.map((sessionId) => ({ key: sessionId, tag: t('palette.tag.session'), text: title(sessionId), sub: '', pick: () => { open(sessionId); } })),
            ];
        }
        const lower = needle.toLowerCase();
        const here = shown?.sessionId;
        const turns = (shown?.turns ?? []).flatMap((turn) => {
            const asked = turn.prompt.toLowerCase().includes(lower);
            if (!asked && !turn.gist.toLowerCase().includes(lower))
                return [];
            return [{
                    key: `turn:${String(turn.turn)}`,
                    tag: t(asked ? 'palette.tag.ask' : 'palette.tag.answer'),
                    text: asked ? turn.prompt : turn.gist,
                    sub: t('palette.turn', { turn: turn.index + 1 }),
                    pick: () => { if (here !== undefined)
                        openTurn(here, turn.turn); },
                }];
        });
        const titled = roots.filter(sessionId => title(sessionId).toLowerCase().includes(lower)).map((sessionId) => ({ key: `title:${sessionId}`, tag: t('palette.tag.session'), text: title(sessionId), sub: '', pick: () => { open(sessionId); } }));
        const content = (hits ?? []).map((hit) => ({
            key: `hit:${hit.sessionId}`,
            tag: t('palette.tag.content'),
            text: hit.snippet.replace(/\s+/gu, ' '),
            sub: title(hit.sessionId),
            pick: () => { open(hit.sessionId); },
        }));
        return [...turns.slice(0, LIMIT), ...titled.slice(0, LIMIT), ...content.slice(0, LIMIT)];
    }, [needle, list, lineage, shown, hits, t]);
    const at = Math.min(active, Math.max(0, rows.length - 1));
    const choose = (row) => {
        if (row === undefined)
            return;
        dialog.current?.close();
        row.pick();
    };
    return (_jsxs("dialog", { className: css.palette, ref: dialog, "aria-label": t('palette.label'), 
        // A press on the backdrop lands on the dialog element itself.
        onClick: (event) => { if (event.target === event.currentTarget)
            event.currentTarget.close(); }, children: [_jsx("input", { className: css.query, value: query, placeholder: t('palette.placeholder'), "aria-label": t('palette.placeholder'), autoComplete: "off", onChange: (event) => { setQuery(event.target.value); setActive(0); }, onKeyDown: (event) => {
                    if (event.nativeEvent.isComposing)
                        return;
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                        event.preventDefault();
                        setActive((at + (event.key === 'ArrowDown' ? 1 : -1) + rows.length) % Math.max(1, rows.length));
                    }
                    else if (event.key === 'Enter')
                        choose(rows[at]);
                } }), _jsxs("ul", { className: css.rows, role: "listbox", children: [rows.map((row, index) => (_jsxs("li", { role: "option", "aria-selected": index === at, "data-on": index === at || undefined, ref: index === at ? (element) => { element?.scrollIntoView({ block: 'nearest' }); } : undefined, onClick: () => { choose(row); }, children: [_jsx("em", { children: row.tag }), _jsx("span", { children: _jsx(Marked, { text: row.text, query: needle }) }), _jsx("small", { children: row.sub })] }, row.key))), rows.length === 0 && _jsx("li", { className: css.none, children: t('palette.none') }), needle !== '' && hits === null && _jsx("li", { className: css.none, children: t('palette.noContent') })] })] }));
}
//# sourceMappingURL=Palette.js.map