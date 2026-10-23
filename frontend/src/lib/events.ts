/**
 * Shared UI coordination events so components can react without prop drilling
 * or reading DOM state. Dispatched on window with `CustomEvent<boolean>`.
 */
export const MENU_OPEN_EVENT = 'safereport:menu-open';
