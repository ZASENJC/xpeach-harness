/** Console navigation bridge shared by surfaces that cannot inject ctx. */

/**
 * The shell.overlay seat offers no layout handle, so the registrar stores the
 * handler here — the bundle module is a singleton per profile. The pill's
 * hover card calls it to select the console main panel.
 */
export const footerBridge: { openConsole: () => void } = {
  openConsole: () => {},
}
