import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Depth stage: the Session's turns as layers in depth. The turn under the cursor faces the
 * reader; earlier turns recede upward and show only their top edge. The stage publishes the
 * reading position, and the composer's next question follows it: asked from an earlier turn,
 * regenerated or rewritten, it starts a branch Session instead of replacing turns.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives';
import { alternativesAt, chosenAt, NO_PREFIX } from "./tree.js";
import { themeOf, themeVars } from "./themes.js";
import css from './stage.module.css';
gsap.registerPlugin(useGSAP);
/** Layers kept mounted behind the current turn; deeper ones are fully transparent. */
const DEPTH = 4;
const calm = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const pad = (value) => String(value).padStart(2, '0');
/** One line standing for an answer on a receded layer: code blocks and Markdown marks removed. */
const gistOf = (answer) => answer.replace(/```[\s\S]*?(```|$)/gu, ' ').replace(/[*`#>|]/gu, '').replace(/\s+/gu, ' ').trim().slice(0, 90);
const NO_USER = [];
/** The composer's editor, which the stage focuses and blurs but never owns. */
const COMPOSER = '[data-composer-seat] :is([contenteditable="true"], textarea)';
const ICON = {
    copy: _jsxs(_Fragment, { children: [_jsx("rect", { x: "9", y: "9", width: "11", height: "11", rx: "2.5" }), _jsx("path", { d: "M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15" })] }),
    regen: _jsxs(_Fragment, { children: [_jsx("path", { d: "M20 12a8 8 0 1 1-2.6-5.9" }), _jsx("path", { d: "M20 4v5h-5" })] }),
    ref: _jsxs(_Fragment, { children: [_jsx("path", { d: "M7 17 17 7" }), _jsx("path", { d: "M9 7h8v8" })] }),
    up: (_jsxs(_Fragment, { children: [_jsx("path", { d: "M7 10v10H4V10z" }), _jsx("path", { d: "M7 10l4-6.5a1.8 1.8 0 0 1 3.2 1.4L13.5 9H18a2 2 0 0 1 2 2.4l-1.2 6.9a2 2 0 0 1-2 1.7H7" })] })),
    edit: _jsx("path", { d: "M4 20h4L19.5 8.5l-4-4L4 16z" }),
    focus: _jsx("path", { d: "M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" }),
    stop: _jsx("rect", { x: "6", y: "6", width: "12", height: "12", rx: "2.5" }),
};
function Icon({ name }) {
    return _jsx("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", children: ICON[name] });
}
/** Reasoning of one step: open while it is being written, closed once the answer starts, then the reader's choice. */
function Think({ text, writing, label }) {
    const [manual, setManual] = useState(null);
    useEffect(() => { setManual(null); }, [writing]);
    const open = manual ?? writing;
    return (_jsxs("details", { className: css.think, open: open, onToggle: (event) => { if (event.currentTarget.open !== open)
            setManual(event.currentTarget.open); }, children: [_jsx("summary", { children: label }), _jsx("pre", { children: text })] }));
}
/** The answer facing the reader: status line, reading progress, outline, reasoning, text, tool rows and the tools. */
function Sheet(props) {
    const { turn, live, cut, question, labels, askedAt, t, useChat, useVotes, inputActions, say, onPhase } = props;
    const steps = useChat(snapshot => snapshot.nodes.turnDataSource(turn, 'assistant-step').getSnapshot());
    const votes = useVotes(snapshot => snapshot);
    const body = useRef(null);
    const stick = useRef(true);
    const [heads, setHeads] = useState([]);
    const blocks = steps.flatMap(step => step.blocks.map(block => ({ step, block })));
    const tail = blocks.at(-1);
    const text = blocks.flatMap(({ block }) => block.kind === 'text' ? [block.text] : []).join('\n');
    const interrupted = !live && steps.at(-1)?.status === 'interrupted';
    const phase = !live ? 'rest' : tail === undefined || tail.block.kind === 'reasoning' ? 'thinking' : 'answering';
    const messageId = steps.findLast(step => step.finalNode?.messageId !== undefined)?.finalNode?.messageId;
    const rating = messageId === undefined ? undefined : votes[messageId];
    useEffect(() => { onPhase(phase); }, [phase]);
    // The time to the first answer text exists only while the turn generates, so it is recorded at that moment.
    useEffect(() => {
        if (phase === 'answering' && askedAt !== undefined && props.thinkTime(turn) === undefined)
            props.thinkTime(turn, Date.now() - askedAt);
    }, [phase]);
    // While generating, follow the newest text only if the reader was already at the end.
    useLayoutEffect(() => {
        const element = body.current;
        if (live && stick.current && element !== null)
            element.scrollTop = element.scrollHeight;
    });
    // A settled answer with three or more headings gets an outline.
    useEffect(() => {
        const found = live || body.current === null ? []
            : [...body.current.querySelectorAll(`.${css.md ?? ''} :is(h1, h2, h3, h4)`)].map(head => head.textContent);
        const next = found.length >= 3 ? found : [];
        setHeads(current => current.join('\n') === next.join('\n') ? current : next);
    }, [live, text]);
    const measured = props.thinkTime(turn);
    const closedAt = steps.at(-1)?.time;
    const seconds = (milliseconds) => (milliseconds / 1000).toFixed(1);
    const length = text.length > 300 ? t('stage.status.length', { count: Math.round(text.length / 10) * 10 }) : '';
    const status = phase === 'thinking' ? t('stage.status.thinking')
        : phase === 'answering' ? t('stage.status.answering')
            : interrupted ? t('stage.status.interrupted')
                : measured !== undefined ? t('stage.status.thought', { seconds: seconds(measured) }) + length
                    : askedAt !== undefined && closedAt !== undefined && closedAt > askedAt
                        ? t('stage.status.took', { seconds: seconds(closedAt - askedAt) }) + length
                        : length.replace(/^ · /u, '');
    const jump = (index) => {
        body.current?.querySelectorAll(`.${css.md ?? ''} :is(h1, h2, h3, h4)`)[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    return (_jsxs("section", { className: css.sheet, "data-phase": phase, children: [_jsxs("header", { children: [_jsx("i", { className: css.orb, "aria-hidden": "true" }), _jsx("span", { className: css.status, children: status }), _jsx("span", { className: css.grow }), _jsx("button", { type: "button", className: css.ib, title: t('stage.tool.focus'), "aria-label": t('stage.tool.focus'), onClick: props.toggleFocus, children: _jsx(Icon, { name: "focus" }) })] }), _jsx("i", { className: css.progress }), _jsxs("div", { className: css.body, ref: body, onScroll: (event) => {
                    const element = event.currentTarget;
                    stick.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
                }, children: [heads.length > 0 && (_jsx("nav", { className: css.outline, "aria-label": t('stage.outline'), children: heads.map((head, index) => _jsx("button", { type: "button", onClick: () => { jump(index); }, children: head }, `${String(index)}:${head}`)) })), blocks.map(({ step, block }, index) => {
                        const key = `${String(step.step)}:${String(index)}`;
                        if (block.kind === 'reasoning') {
                            return block.text.trim() === '' ? null
                                : _jsx(Think, { text: block.text, writing: live && block === tail?.block, label: t('stage.think') }, key);
                        }
                        if (block.kind === 'text') {
                            return _jsx("div", { className: css.md, children: _jsx(MarkdownText, { text: block.text, streaming: step.status === 'running', labels: labels }) }, key);
                        }
                        if (block.kind === 'tool-call')
                            return _jsx("p", { className: css.call, children: t('stage.tool', { name: block.name }) }, key);
                        return null;
                    }), interrupted && _jsx("p", { className: css.halted, children: t('stage.halted') }), _jsx("footer", { className: css.tools, children: live
                            ? _jsxs("button", { type: "button", "data-stop": true, onClick: props.stop, children: [_jsx(Icon, { name: "stop" }), t('stage.tool.stop')] })
                            : (_jsxs(_Fragment, { children: [_jsxs("button", { type: "button", onClick: () => { void props.copy(text).then((ok) => { say(t(ok ? 'stage.tool.copied' : 'stage.tool.copyFailed')); }); }, children: [_jsx(Icon, { name: "copy" }), t('stage.tool.copy')] }), cut !== undefined && (_jsxs("button", { type: "button", title: t('stage.tool.regenerate.title'), onClick: () => { props.regenerate(cut, question); }, children: [_jsx(Icon, { name: "regen" }), t('stage.tool.regenerate')] })), _jsxs("button", { type: "button", title: t('stage.tool.quote.title'), onClick: () => { say(t(inputActions.insertQuote(text) ? 'stage.tool.quoted' : 'stage.tool.quoteRefused')); }, children: [_jsx(Icon, { name: "ref" }), t('stage.tool.quote')] }), _jsx("span", { className: css.grow }), props.vote !== undefined && messageId !== undefined && ['positive', 'negative'].map(value => (_jsx("button", { type: "button", className: css.ib, "data-on": rating === value || undefined, "data-down": value === 'negative' || undefined, title: t(`stage.tool.${value}`), "aria-label": t(`stage.tool.${value}`), "aria-pressed": rating === value, onClick: () => { props.vote?.(messageId, value); }, children: _jsx(Icon, { name: "up" }) }, value)))] })) })] })] }));
}
/**
 * Stage view of one Session.
 * @param props - Session standard props, the stage locale and the entry's inject face.
 * @returns the layered turns and the timeline rail.
 */
export function StageView(props) {
    const { sessionId, useChat, useSession, inputActions, useLineage, useDesign, useStage, useFocus, t } = props;
    const { seen, patch, show, setFocus, openBranch, report, inherit, loadOlder } = props;
    const [inherited] = useState(inherit);
    const items = useChat(snapshot => snapshot.navigation.items());
    const timeline = useChat(snapshot => snapshot.timeline);
    const running = useSession(snapshot => snapshot.running);
    const hasMore = useSession(snapshot => snapshot.hasMore);
    const loadingOlder = useSession(snapshot => snapshot.loadingOlder);
    const lineage = useLineage(snapshot => snapshot);
    const cursor = useStage(snapshot => snapshot.cursor);
    const editing = useStage(snapshot => snapshot.editing);
    const focus = useFocus(snapshot => snapshot);
    const groupTheme = useDesign((snapshot) => {
        const groupId = snapshot.groupOf[sessionId];
        return snapshot.groups.find(group => group.groupId === groupId)?.theme;
    });
    const water = themeOf(sessionId, groupTheme);
    const [open, setOpen] = useState(false);
    const [notice, setNotice] = useState('');
    const [query, setQuery] = useState('');
    const rail = useRef(null);
    const [phase, setPhase] = useState('rest');
    const root = useRef(null);
    const placed = useRef(new Set());
    const wheel = useRef({ acc: 0, step: 0, wheel: 0, read: 0 });
    const labels = useMemo(() => ({
        code: { copyLabel: t('markdown.copy'), copiedLabel: t('markdown.copied') }, footnotes: t('markdown.footnotes'),
    }), [t]);
    // Cut before each turn: the previous turn's last event, or the start of a fully loaded Session.
    const cuts = useMemo(() => new Map(items.map((item) => {
        const index = timeline.turnOrder.indexOf(item.turn);
        const previous = index > 0 ? timeline.turns.get(timeline.turnOrder[index - 1] ?? -1)?.end?.seq : undefined;
        return [item.turn, index === 0 && !hasMore ? NO_PREFIX : previous];
    })), [items, timeline, hasMore]);
    const last = items.length - 1;
    const found = cursor.kind === 'turn' ? items.findIndex(item => item.turn === cursor.turn)
        : cursor.kind === 'cut' ? items.findIndex(item => cuts.get(item.turn) === cursor.cut) : last;
    const current = found < 0 ? last : found;
    const item = items[current];
    const endSeq = item === undefined ? undefined : timeline.turns.get(item.turn)?.end?.seq;
    // A turn is generating only while it is the Session's open turn; a running Session whose new turn has not appeared yet is not.
    const generating = running && items[last] !== undefined && timeline.turns.get(items[last].turn)?.end === undefined;
    const live = generating && current === last;
    // The rail preview is bounded, and the note shows attachments; both need the question's own content.
    // The selector must return one stable value while there is no turn: a fresh array on every read re-renders without end.
    const asked = useChat(snapshot => item === undefined ? NO_USER : snapshot.nodes.turnDataSource(item.turn, 'user').getSnapshot());
    const content = asked.flatMap(user => user.content);
    const written = content.flatMap(block => 'text' in block && typeof block.text === 'string' ? [block.text] : []).join('\n');
    const question = written === '' ? item?.prompt ?? '' : written;
    const attached = content.flatMap(block => 'text' in block ? []
        : [{ image: block.type === 'image', name: 'name' in block && typeof block.name === 'string' ? block.name : '' }]);
    const look = (next) => { patch({ cursor: next }); };
    const go = (index) => {
        const target = items[Math.max(0, Math.min(last, index))];
        if (target === undefined)
            return;
        setOpen(false);
        look(target === items[last] ? { kind: 'latest' } : { kind: 'turn', turn: target.turn });
    };
    const say = (text) => { setNotice(text); };
    const cancelEdit = () => {
        if (editing === null)
            return false;
        patch({ editing: null });
        inputActions.setDraft('');
        return true;
    };
    const fork = (turn, direction) => {
        const cut = cuts.get(turn);
        if (cut === undefined)
            return;
        const alternatives = alternativesAt(lineage, sessionId, cut);
        const at = alternatives.indexOf(chosenAt(lineage, sessionId, cut));
        const target = alternatives[(at + direction + alternatives.length) % alternatives.length];
        if (target !== undefined && alternatives.length > 1)
            openBranch(target, cut);
    };
    useEffect(() => { seen(); }, [sessionId]);
    useEffect(() => { show({ theme: water, energy: phase === 'thinking' ? 1 : phase === 'answering' ? 0.45 : 0 }); }, [water, phase]);
    useEffect(() => { if (!live)
        setPhase('rest'); }, [live]);
    // The composer reads the position from the shared state; without a mounted stage the next question continues the Session.
    useEffect(() => {
        patch({ place: item === undefined ? null : { index: current, count: items.length, cut: endSeq, settled: !live } });
    }, [current, items.length, endSeq, live]);
    useEffect(() => () => { patch({ place: null }); }, []);
    useEffect(() => {
        report(items.map((entry, index) => ({ turn: entry.turn, index, prompt: entry.prompt, gist: gistOf(entry.response), endSeq: timeline.turns.get(entry.turn)?.end?.seq })));
    }, [items, timeline]);
    // A long Session scrolls its timeline; the turn under the cursor stays inside the visible part, below the search field.
    useEffect(() => {
        const list = rail.current;
        const mark = list?.querySelector('[data-current]');
        if (list == null || mark == null)
            return;
        const bottom = mark.offsetTop + mark.offsetHeight;
        if (mark.offsetTop - 40 < list.scrollTop)
            list.scrollTop = mark.offsetTop - 40;
        else if (bottom > list.scrollTop + list.clientHeight)
            list.scrollTop = bottom - list.clientHeight + 8;
    }, [current, items.length]);
    useEffect(() => {
        if (notice === '')
            return;
        const timer = setTimeout(() => { setNotice(''); }, 2600);
        return () => { clearTimeout(timer); };
    }, [notice]);
    // Keys follow one order: Escape leaves one layer at a time, arrows move through turns and branches, any character starts typing.
    useEffect(() => {
        const onKey = (event) => {
            const editor = document.querySelector(COMPOSER);
            const target = event.target instanceof HTMLElement ? event.target : null;
            const typing = editor !== null && target !== null && editor.contains(target);
            if (event.key === 'Escape') {
                if (cancelEdit())
                    return;
                if (focus) {
                    setFocus(false);
                    return;
                }
                if (typing)
                    editor.blur();
                return;
            }
            // Keys typed in another field, such as a rename box, are not shortcuts.
            if (!typing && target?.closest('input, textarea, [contenteditable]') != null)
                return;
            if (typing && !event.altKey)
                return;
            const move = item === undefined ? undefined : {
                ArrowUp: () => { go(current - 1); },
                ArrowDown: () => { go(current + 1); },
                ArrowLeft: () => { fork(item.turn, -1); },
                ArrowRight: () => { fork(item.turn, 1); },
            }[event.key];
            if (move !== undefined) {
                event.preventDefault();
                move();
                return;
            }
            if (typing || event.metaKey || event.ctrlKey || event.altKey)
                return;
            if (event.key.toLowerCase() === 'f') {
                setFocus(!focus);
                return;
            }
            if (event.key.length === 1)
                editor?.focus();
        };
        addEventListener('keydown', onKey);
        return () => { removeEventListener('keydown', onKey); };
    });
    useGSAP(() => {
        const duration = calm() ? 0 : 0.8;
        for (const element of gsap.utils.toArray('[data-turn]', root.current)) {
            const turn = Number(element.dataset['turn']);
            const depth = Number(element.dataset['depth']);
            const behind = Math.abs(depth);
            const to = depth === 0 ? { y: 0, z: 0, autoAlpha: 1 }
                : depth < 0 ? { y: -50 * behind, z: -150 * behind, autoAlpha: behind > 3 ? 0 : 1 - behind * 0.16 }
                    : { y: 120, z: 220, autoAlpha: 0 };
            if (!placed.current.has(turn)) {
                placed.current.add(turn);
                gsap.set(element, depth === 0 ? { y: 140, z: 260, autoAlpha: 0 } : to);
            }
            gsap.to(element, { ...to, duration, ease: 'power3.out', overwrite: 'auto' });
        }
    }, { scope: root, dependencies: [current, items.length, sessionId, inherited.length] });
    // A long answer scrolls first; turns change only after the scroll has rested at its end.
    const onWheel = (event) => {
        const state = wheel.current;
        const now = performance.now();
        const body = event.target instanceof Element ? event.target.closest(`.${css.body ?? ''}`) : null;
        const scrollable = body !== null
            && (event.deltaY < 0 ? body.scrollTop > 0 : body.scrollTop + body.clientHeight < body.scrollHeight - 1);
        if (scrollable) {
            state.read = now;
            state.acc = 0;
            return;
        }
        if (now - state.read < 500) {
            state.read = now;
            return;
        }
        if (now - state.wheel > 200)
            state.acc = 0;
        state.wheel = now;
        state.acc += event.deltaY;
        if (Math.abs(state.acc) > 100 && now - state.step > 450) {
            go(current + Math.sign(state.acc));
            state.acc = 0;
            state.step = now;
        }
    };
    // Parallax shifts the layers by depth; the spotlight follows the pointer across the sheet facing the reader.
    const onPointerMove = (event) => {
        const stage = event.currentTarget;
        const frame = stage.getBoundingClientRect();
        stage.style.setProperty('--px', ((event.clientX - frame.left) / frame.width - 0.5).toFixed(3));
        stage.style.setProperty('--py', ((event.clientY - frame.top) / frame.height - 0.5).toFixed(3));
        const sheet = event.target instanceof Element ? event.target.closest(`[data-depth="0"] .${css.sheet ?? ''}`) : null;
        if (sheet === null)
            return;
        const box = sheet.getBoundingClientRect();
        sheet.style.setProperty('--mx', `${String(event.clientX - box.left)}px`);
        sheet.style.setProperty('--my', `${String(event.clientY - box.top)}px`);
    };
    // The timeline search covers every question the reader asked in this Session, not the answers.
    const needle = query.trim().toLowerCase();
    const hits = items.flatMap((entry, index) => needle === '' || entry.prompt.toLowerCase().includes(needle) ? [{ entry, index, line: entry.prompt }] : []);
    // A Session opens with its latest turns only; searching pages in the rest. A page that adds no turn is not asked for again.
    const paged = useRef(-1);
    useEffect(() => {
        if (needle === '' || !hasMore || loadingOlder || paged.current === items.length)
            return;
        paged.current = items.length;
        loadOlder();
    }, [needle, hasMore, loadingOlder, items.length, loadOlder]);
    const first = Math.max(0, current - DEPTH);
    const visible = items.slice(first, Math.min(items.length, current + 2));
    return (_jsxs("div", { className: css.stage, style: themeVars(water), "data-focus": focus || undefined, ref: root, onWheel: onWheel, onPointerMove: onPointerMove, children: [item === undefined && inherited.length === 0 && _jsxs("div", { className: css.empty, children: [_jsx("h2", { children: t('stage.empty.title') }), _jsx("p", { children: t('stage.empty.body') })] }), _jsxs("div", { className: css.scenes, children: [items.length === 0 && inherited.slice(-DEPTH).map((layer, at, layers) => {
                        const depth = at - layers.length;
                        return (_jsxs("article", { className: css.scene, "data-turn": -1 - at, "data-depth": depth, "data-past": true, style: { 'zIndex': 100 + depth, '--d': -depth }, children: [_jsx("section", { className: css.ask, children: _jsx("div", { className: css.note, children: _jsx("h2", { children: layer.prompt }) }) }), _jsx("section", { className: css.sheet, children: _jsxs("header", { children: [_jsx("i", { className: css.orb, "aria-hidden": "true" }), _jsx("span", { className: css.gist, "data-no": pad(layer.index + 1), children: layer.gist })] }) })] }, `inherited:${String(layer.turn)}`));
                    }), visible.map((scene, offset) => {
                        const index = first + offset;
                        const depth = index - current;
                        const cut = cuts.get(scene.turn);
                        const alternatives = cut === undefined ? [] : alternativesAt(lineage, sessionId, cut);
                        const chosen = cut === undefined ? -1 : alternatives.indexOf(chosenAt(lineage, sessionId, cut));
                        const no = pad(index + 1);
                        return (_jsxs("article", { className: css.scene, "data-turn": scene.turn, "data-depth": depth, "data-past": depth < 0 || undefined, "data-status": depth === 0 && live ? 'running' : 'settled', style: { 'zIndex': 100 - Math.abs(depth), '--d': Math.abs(depth) }, onClick: depth < 0 ? () => { go(index); } : undefined, children: [_jsxs("section", { className: css.ask, children: [_jsxs("div", { className: css.askmeta, children: [cut !== undefined && depth === 0 && (_jsx("button", { type: "button", className: css.ib, title: t('stage.tool.edit.title'), "aria-label": t('stage.tool.edit'), onClick: () => {
                                                        inputActions.setDraft(question);
                                                        patch({ editing: { turn: scene.turn, index, cut } });
                                                        document.querySelector(COMPOSER)?.focus();
                                                    }, children: _jsx(Icon, { name: "edit" }) })), alternatives.length > 1 && (_jsxs("span", { className: css.fork, children: [_jsx("button", { type: "button", "aria-label": t('stage.fork.previous'), onClick: () => { fork(scene.turn, -1); }, children: "\u2039" }), t('stage.fork.label', { index: chosen + 1, count: alternatives.length }), _jsx("button", { type: "button", "aria-label": t('stage.fork.next'), onClick: () => { fork(scene.turn, 1); }, children: "\u203A" })] })), _jsx("span", { className: css.no, children: no })] }), _jsxs("div", { className: css.note, title: depth === 0 ? t('stage.note.title') : undefined, "data-open": (depth === 0 && open) || undefined, onClick: depth === 0 ? () => { setOpen(value => !value); } : undefined, children: [_jsx("h2", { children: depth === 0 ? question : scene.prompt }), depth === 0 && attached.length > 0 && (_jsx("div", { className: css.refs, children: attached.map((file, at) => (_jsxs("span", { className: css.chip, children: [t(file.image ? 'stage.note.image' : 'stage.note.file'), file.name === '' ? '' : ` · ${file.name}`] }, `${String(at)}:${file.name}`))) }))] })] }), depth === 0
                                    ? (_jsx(Sheet, { ...props, turn: scene.turn, live: live, cut: cut, question: question, labels: labels, askedAt: asked[0]?.time, say: say, toggleFocus: () => { setFocus(!focus); }, onPhase: setPhase }))
                                    : (_jsx("section", { className: css.sheet, children: _jsxs("header", { children: [_jsx("i", { className: css.orb, "aria-hidden": "true" }), _jsx("span", { className: css.gist, "data-no": no, children: gistOf(scene.response) })] }) }))] }, scene.turn));
                    })] }), items.length > 0 && (_jsxs("nav", { className: css.rail, "aria-label": t('stage.rail.label'), ref: rail, children: [_jsx("input", { className: css.find, type: "search", value: query, placeholder: t('stage.rail.search'), "aria-label": t('stage.rail.search'), onChange: (event) => { setQuery(event.currentTarget.value); }, onKeyDown: (event) => {
                            if (event.key === 'Enter' && hits[0] !== undefined)
                                go(hits[0].index);
                            if (event.key !== 'Escape')
                                return;
                            // Escape belongs to the field first: it clears the search before the stage's own Escape order applies.
                            event.nativeEvent.stopPropagation();
                            setQuery('');
                            event.currentTarget.blur();
                        } }), hits.map(({ entry, index, line }) => {
                        const cut = cuts.get(entry.turn);
                        const count = cut === undefined ? 1 : alternativesAt(lineage, sessionId, cut).length;
                        return (_jsxs("button", { type: "button", "data-current": index === current || undefined, "data-live": (generating && index === last) || undefined, title: entry.prompt, onClick: () => { go(index); }, children: [_jsx("i", { children: pad(index + 1) }), _jsx("span", { children: line }), count > 1 && _jsxs("em", { children: ["\u2442", count] })] }, entry.turn));
                    }), hits.length === 0 && _jsx("p", { className: css.nohit, children: t('stage.rail.none') })] })), notice !== '' && _jsx("div", { className: css.toast, role: "status", children: notice })] }));
}
//# sourceMappingURL=Stage.js.map