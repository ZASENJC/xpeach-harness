/** Filesystem ownership for the Electron-managed desktop installation. */

import { join } from 'node:path'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'

/** XPeach product home; the Desktop shell never writes into DeepSeek's ~/.dsh. */
export const XPEACH_HOME_ENV = 'XPH_HOME'
/** Profile directory name owned by the XPeach product. */
export const XPEACH_PROFILE_NAME = 'xpeach'

/** Stable desktop installation paths under the shared Harness home. */
export interface DesktopPaths {
  readonly profile: string
  readonly lock: string
}

/**
 * Resolve every Electron-owned path without changing the shared data roots.
 * @param dshHome - Harness home shared with npm-installed dsh.
 * @returns immutable desktop path set.
 */
export function resolveDesktopPaths(dshHome: string = resolveDshHome()): DesktopPaths {
  return {
    profile: join(dshHome, 'profiles', XPEACH_PROFILE_NAME),
    lock: join(dshHome, 'profiles', XPEACH_PROFILE_NAME, 'lock'),
  }
}
