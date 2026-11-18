/** Themes a group can use; a group's stored index wraps around this list. */
export const THEMES = [
    { h: 0.5, h2: 0.56, sat: 1 },
    { h: 0.4, h2: 0.5, sat: 1 },
    { h: 0.62, h2: 0.7, sat: 1 },
    { h: 0.76, h2: 0.88, sat: 0.95 },
    { h: 0.93, h2: 0.03, sat: 0.9 },
    { h: 0.07, h2: 0.12, sat: 0.95 },
    { h: 0.28, h2: 0.18, sat: 0.8 },
    { h: 0.58, h2: 0.6, sat: 0.16 },
];
/**
 * Pick the theme of a Session: its group's theme, or a stable one derived from its id.
 * @param sessionId - Session identity.
 * @param groupTheme - theme index of the Session's group, when it has one.
 * @returns the theme.
 */
export function themeOf(sessionId, groupTheme) {
    let hash = 0;
    for (const char of sessionId)
        hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    // The index is always in range after the modulo.
    return THEMES[(groupTheme ?? hash) % THEMES.length];
}
/**
 * Express a theme as the custom properties the stage and overview style sheets read.
 * @param theme - water theme.
 * @returns inline style carrying `--h`, `--h2` and `--sat`.
 */
export function themeVars(theme) {
    return { '--h': theme.h * 360, '--h2': theme.h2 * 360, '--sat': theme.sat };
}
//# sourceMappingURL=themes.js.map