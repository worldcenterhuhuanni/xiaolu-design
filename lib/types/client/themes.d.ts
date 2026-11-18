/** Water themes: `h` is the hue of the depths, `h2` the hue of highlights, `sat` the overall saturation. */
import type { CSSProperties } from 'react';
/** One water theme, in turns of the hue circle. */
export interface Theme {
    readonly h: number;
    readonly h2: number;
    readonly sat: number;
}
/** Themes a group can use; a group's stored index wraps around this list. */
export declare const THEMES: readonly Theme[];
/**
 * Pick the theme of a Session: its group's theme, or a stable one derived from its id.
 * @param sessionId - Session identity.
 * @param groupTheme - theme index of the Session's group, when it has one.
 * @returns the theme.
 */
export declare function themeOf(sessionId: string, groupTheme: number | undefined): Theme;
/**
 * Express a theme as the custom properties the stage and overview style sheets read.
 * @param theme - water theme.
 * @returns inline style carrying `--h`, `--h2` and `--sat`.
 */
export declare function themeVars(theme: Theme): CSSProperties;
//# sourceMappingURL=themes.d.ts.map