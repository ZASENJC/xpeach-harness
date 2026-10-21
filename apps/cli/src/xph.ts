/**
 * XPeach Harness entry (pnpm xph): the product's own CLI — pins
 * XPH_HOME=~/.xph so every data root lands away from DeepSeek Harness's
 * ~/.dsh, then boots the xpeach profile through the shared runner.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

process.env.XPH_PRODUCT = '1'
const XPH_HOME = process.env.XPH_HOME ?? join(homedir(), '.xph')
process.env.XPH_HOME = XPH_HOME
// resolveDshHome reads XPH_HOME first (home-paths), so every root — sessions,
// attachments, credentials, settings, logs — lands under ~/.xph untouched by ~/.dsh.
mkdirSync(XPH_HOME, { recursive: true })

// First-boot seeding: carry the xpeach profile over from a legacy ~/.dsh root —
// patches, package links and stored credentials keep working on day one;
// afterwards the two homes evolve independently.
const legacyProfile = join(homedir(), '.dsh', 'profiles', 'xpeach')
const xphProfile = join(XPH_HOME, 'profiles', 'xpeach')
if (!existsSync(xphProfile) && existsSync(legacyProfile)) {
  mkdirSync(join(XPH_HOME, 'profiles'), { recursive: true })
  // Copy the profile skeleton — patches, package.json, workspace links — but
  // NOT credentials: a fresh install must walk the bind gate. Key/session/
  // admin files stay behind in the legacy home.
  // The legacy profile predates the XPeach namespace migration, so its manifest
  // and pnpm workspace resolve to package names that no longer exist. Carry the
  // user's own patch layer and pricing over; let this CLI write a fresh manifest.
  cpSync(legacyProfile, xphProfile, { recursive: true, dereference: false,
    filter: src => !/xpeach\.(key|key\.bak|keys|key\.seeded|session|admin)$|\.credentials|pricing\.json$|package\.json$|pnpm-.*\.yaml$|pnpm-lock\.yaml$|node_modules$/.test(src) })
  // A legacy ~/.dsh profile may carry sub-directory isolation overrides
  // (…/xpeach/sessions). Under ~/.xph those would double-nest; the xph home is
  // already isolated at its root, so drop that block on seed.
  const patchFile = join(xphProfile, 'cordis.patch.yml')
  if (existsSync(patchFile)) {
    const text = readFileSync(patchFile, 'utf8')
    const cleaned = text.replace(/# 旧路径兜底隔离[\s\S]*?(?=- insert:)/, '')
    if (cleaned !== text) writeFileSync(patchFile, cleaned)
  }
  console.log('[xph] seeded profile from ~/.dsh — from now on the two homes are independent')
}

// Delegate: same argv shape as pnpm dsh --profile xpeach ... — user flags pass through.
const skip = new Set(['--profile', 'xpeach'])
const userArgs = process.argv.slice(2).filter(arg => !skip.has(arg))
// First boot of a fresh home: create the profile from the shipped XPeach template
// so its manifest and bundle list exist before the runner loads it.
if (!existsSync(join(XPH_HOME, 'profiles', 'xpeach', 'package.json'))) {
  const { initProfile, PROFILE_TEMPLATES } = await import('@xpeach/xph-app-boot')
  mkdirSync(join(XPH_HOME, 'profiles', 'xpeach'), { recursive: true })
  const template = PROFILE_TEMPLATES.xpeach
  if (template === undefined) throw new Error('xph: the shipped xpeach profile template is missing')
  initProfile(join(XPH_HOME, 'profiles', 'xpeach'), template.bundles)
}
process.argv = [process.argv[0] ?? process.execPath, process.argv[1] ?? '', '--profile', 'xpeach', ...userArgs]
const { runCli } = await import('./bin.ts')
await runCli()
