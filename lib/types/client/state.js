/** State of a Session nobody has read yet. */
export const INITIAL_STATE = { cursor: { kind: 'latest' }, editing: null, place: null };
/**
 * Decide where the next question lands.
 * @param state - reading state of the Session whose composer sends.
 * @returns the branch to start, or null when the question continues the Session.
 */
export function routeOf(state) {
    if (state.editing !== null)
        return { cut: state.editing.cut, kind: 'edit' };
    const place = state.place;
    if (place === null || place.cut === undefined || place.index >= place.count - 1)
        return null;
    return { cut: place.cut, kind: 'ask' };
}
//# sourceMappingURL=state.js.map