/**
 * XPeach client plugin, node half. The empty apply gives Loader a host entry;
 * the browser half ships via exports["./client"], discovered through the
 * package.json dsh.client declaration.
 */

/** Host plugin body — no host-side behavior for this source plugin. */
export function apply(): void {}
