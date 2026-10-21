/**
 * Rename every workspace package to the XPeach namespace.
 *
 * This is the mechanical half of `docs/upstream/BRAND-MAP.md`: it rewrites the
 * package manifests, every import specifier that names them, the tsconfig path
 * map and the pnpm workspace links. It is idempotent — running it twice is a
 * no-op — so it can be re-run after absorbing an upstream change.
 *
 * External dependencies are never touched: only names that resolve to a
 * workspace manifest are rewritten.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..', '..')
const OLD_SCOPE = '@deepseek-ai/'
const NEW_SCOPE = '@xpeach/xph-'
const OLD_SCOPE_BARE = '@deepseek-ai'
const NEW_SCOPE_BARE = '@xpeach'

/** Directories that hold workspace manifests. */
const MANIFEST_ROOTS = ['packages', 'apps', 'vendor', 'native']

/** File extensions the import rewrite covers. */
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.mjs', '.cjs', '.js', '.jsx', '.json', '.yaml', '.yml', '.css']

/** Directories never entered. */
const SKIP = new Set(['node_modules', '.git', 'lib', 'dist', '.desktop-build', 'coverage'])

/**
 * Collect every workspace manifest path.
 * @returns {string[]} absolute manifest paths.
 */
function manifests() {
  const found = []
  const walk = (dir) => {
    let entries
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      if (SKIP.has(entry.name)) continue
      const path = join(dir, entry.name)
      if (entry.isDirectory()) { walk(path); continue }
      if (entry.name === 'package.json') found.push(path)
    }
  }
  for (const root of MANIFEST_ROOTS) walk(join(ROOT, root))
  found.push(join(ROOT, 'package.json'))
  return found
}

/**
 * Map one workspace package name onto its XPeach name.
 * @param {string} name - current package name.
 * @returns {string} rewritten name.
 */
function renamePackage(name) {
  if (!name.startsWith(OLD_SCOPE)) return name
  const rest = name.slice(OLD_SCOPE.length)
  return `${NEW_SCOPE}${rest.replace(/^dsh-/, '')}`
}

const paths = manifests()
const renameByName = new Map()
for (const path of paths) {
  const manifest = JSON.parse(readFileSync(path, 'utf8'))
  if (typeof manifest.name !== 'string' || !manifest.name.startsWith(OLD_SCOPE)) continue
  renameByName.set(manifest.name, renamePackage(manifest.name))
}

if (renameByName.size === 0) {
  console.log('brand:map: every workspace package already carries the XPeach namespace')
  process.exit(0)
}

/** Rewrite a package name if it is a workspace rename. */
const mapName = (name) => renameByName.get(name) ?? name

/** Rewrite a dependency specifier, preserving subpaths. */
function mapSpecifier(specifier) {
  if (typeof specifier !== 'string' || !specifier.startsWith(OLD_SCOPE)) return specifier
  const [maybeName] = [specifier.split('/').slice(0, 2).join('/')]
  const renamed = renameByName.get(maybeName)
  if (renamed === undefined) return specifier
  return renamed + specifier.slice(maybeName.length)
}

let manifestsWritten = 0
for (const path of paths) {
  const before = readFileSync(path, 'utf8')
  const manifest = JSON.parse(before)
  let dirty = false
  if (typeof manifest.name === 'string' && renameByName.has(manifest.name)) {
    manifest.name = renameByName.get(manifest.name)
    dirty = true
  }
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const table = manifest[section]
    if (table === undefined || typeof table !== 'object') continue
    const next = {}
    for (const [name, version] of Object.entries(table)) {
      const renamed = mapName(name)
      if (renamed !== name) dirty = true
      next[renamed] = version
    }
    manifest[section] = next
  }
  if (dirty) {
    writeFileSync(path, `${JSON.stringify(manifest, undefined, 2)}\n`)
    manifestsWritten += 1
  }
}

/** Collect source files under one directory. */
function sources(dir, found = []) {
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return found }
  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) { sources(path, found); continue }
    if (!SOURCE_EXTENSIONS.some(extension => entry.name.endsWith(extension))) continue
    if (entry.name === 'package.json') continue
    found.push(path)
  }
  return found
}

let sourcesWritten = 0
for (const file of [...sources(join(ROOT, 'packages')), ...sources(join(ROOT, 'apps')), ...sources(join(ROOT, 'scripts'))]) {
  const before = readFileSync(file, 'utf8')
  let after = before
  for (const [oldName, newName] of renameByName) after = after.split(oldName).join(newName)
  if (after !== before) {
    writeFileSync(file, after)
    sourcesWritten += 1
  }
}

// The tsconfig path facade names every package by hand.
for (const name of ['tsconfig.base.json', 'tsconfig.base.client.json', 'tsconfig.host.json', 'tsconfig.client.json', 'tsconfig.json']) {
  const file = join(ROOT, name)
  if (!existsSync(file)) continue
  const before = readFileSync(file, 'utf8')
  let after = before
  for (const [oldName, newName] of renameByName) after = after.split(oldName).join(newName)
  if (after !== before) writeFileSync(file, after)
}

// tsdown entry maps and vite aliases resolve packages by name too.
for (const file of readdirSync(ROOT).filter(entry => /^tsdown.*\.ts$|^vite.*\.ts$/.test(entry))) {
  const path = join(ROOT, file)
  if (!statSync(path).isFile()) continue
  const before = readFileSync(path, 'utf8')
  let after = before
  for (const [oldName, newName] of renameByName) after = after.split(oldName).join(newName)
  if (after !== before) writeFileSync(path, after)
}

console.log(`brand:map: renamed ${renameByName.size} packages (manifests ${manifestsWritten}, sources ${sourcesWritten})`)
