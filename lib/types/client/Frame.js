import { jsx as _jsx } from "react/jsx-runtime";
/**
 * Water behind the whole Conversation body. The plugin owns one canvas for its lifetime and the
 * frame of the Conversation in view borrows it, so the water keeps flowing while Sessions and
 * branches change; the stage only tells it which theme and how much energy to show.
 */
import { useEffect, useRef } from 'react';
import { themeVars } from "./themes.js";
import css from './frame.module.css';
/**
 * Wrap the Conversation scroll body and paint the water below it once a Session is in view.
 * @param props - the home state, the wrapped scroll body, the scene source and the shared water.
 * @returns a layout-neutral frame around the children.
 */
export function WaterFrame({ hero, children, useScene, water }) {
    const scene = useScene(snapshot => snapshot);
    const frame = useRef(null);
    const background = useRef(null);
    const on = !hero && scene !== null;
    // Creating a WebGL scene compiles shaders on the main thread, so entering a Session or a branch borrows the
    // plugin's one canvas instead of building another; without WebGL the Conversation keeps the application background.
    useEffect(() => {
        const shared = on ? water() : null;
        if (shared === null || frame.current === null)
            return;
        shared.canvas.className = css.canvas ?? '';
        frame.current.prepend(shared.canvas);
        background.current = shared.background;
        return () => {
            background.current = null;
            shared.canvas.remove();
        };
    }, [on]);
    useEffect(() => {
        if (background.current === null || scene === null)
            return;
        background.current.theme = scene.theme;
        background.current.energy = scene.energy;
    }, [on, scene?.theme, scene?.energy]);
    // A sent question raises a warm splash where it left: the top edge of the composer.
    useEffect(() => {
        const seat = document.querySelector('[data-composer-seat]')?.getBoundingClientRect();
        if (scene === null || scene.sent === 0 || seat === undefined)
            return;
        background.current?.splash(seat.left + seat.width / 2, seat.top, true);
    }, [scene?.sent]);
    return (_jsx("div", { ref: frame, className: css.frame, style: scene === null ? undefined : themeVars(scene.theme), "data-water": on || undefined, onPointerDown: (event) => { background.current?.splash(event.clientX, event.clientY); }, children: children }));
}
//# sourceMappingURL=Frame.js.map