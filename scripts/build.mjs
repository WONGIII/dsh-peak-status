#!/usr/bin/env node
/**
 * Build the published plugin artifacts from `src/`.
 *
 * Outputs:
 *   lib/index.js                      host half — an empty `apply` whose only job
 *                                     is to hold the Loader row the browser half
 *                                     is served from
 *   lib/client.js                     browser half — wrapped for
 *                                     `window.__ModuleLoader__`
 *   lib/types/index.d.ts              type of the host half
 *   lib/types/client/index.d.ts       type of the browser half
 *
 * Type annotations and JSX are erased by TypeScript's own transpiler
 * (`ts.transpileModule`), so the emitted JavaScript is the production artifact:
 * there is no bundler, and no dependency is inlined. `react` and
 * `react/jsx-runtime` stay external `require` calls resolved by the DSH loader.
 *
 * Usage:
 *   node scripts/build.mjs           write lib/
 *   node scripts/build.mjs --check   report whether lib/ is up to date
 *
 * This package deliberately declares NO `prepare` script. pnpm refuses to run
 * build scripts of a git-hosted dependency until the user allowlists it, so a
 * `prepare` would force every `dsh plugin add github:WONGIII/dsh-peak-status`
 * through a build-permission prompt even though `lib/` is committed. Rebuild
 * and commit `lib/` before tagging a release instead.
 *
 * TypeScript is a devDependency, so a git install (which fetches no
 * devDependencies) cannot run this script at all — hence the guard in
 * {@link loadTypeScript}.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CHECK = process.argv.includes('--check')
const PACKAGE_NAME = '@dsh-external/dsh-peak-status'

const SOURCE = join(ROOT, 'src', 'client', 'index.tsx')
const HOST_SOURCE = join(ROOT, 'src', 'index.js')
const CLIENT_ARTIFACT = join(ROOT, 'lib', 'client.js')

/** TypeScript is a devDependency; a git install has no devDependencies. */
async function loadTypeScript() {
  try {
    return (await import('typescript')).default
  } catch (error) {
    if (existsSync(CLIENT_ARTIFACT)) {
      console.log('build: TypeScript is unavailable and lib/ is committed — keeping the existing artifacts')
      process.exit(0)
    }
    throw new Error(`build: TypeScript is required to build from src/: ${error.message}`)
  }
}

const ts = await loadTypeScript()

/**
 * Modules the browser half resolves from the host, with the binding name the
 * generated code expects: the classic JSX transform emits `React.createElement`,
 * so `react` must be bound as `React`, not as its own specifier.
 */
const EXTERNALS = [
  { specifier: 'react', binding: 'React' },
  { specifier: 'react/jsx-runtime', binding: 'react_jsx_runtime' },
]

const read = (path) => readFileSync(path, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')

/** Transpile one TypeScript/JSX module and keep the result readable in lib/. */
function transpile(source, fileName) {
  const result = ts.transpileModule(source, {
    fileName,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      // Classic JSX: the host already provides React, so the emitted code calls
      // `React.createElement` instead of importing a JSX runtime.
      jsx: ts.JsxEmit.React,
      removeComments: true,
      newLine: ts.NewLineKind.LineFeed,
    },
    reportDiagnostics: true,
  })
  const errors = (result.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error)
  if (errors.length > 0) {
    const text = ts.formatDiagnostics(errors, {
      getCanonicalFileName: (f) => f,
      getCurrentDirectory: () => ROOT,
      getNewLine: () => '\n',
    })
    throw new Error(`${fileName}: TypeScript reported syntax errors:\n${text}`)
  }
  return result.outputText.replace(/\n+$/, '')
}

/**
 * Rewrite the browser half into the loader form.
 *
 * The exported `inject` and `apply` become the factory's `exports` members, and
 * every remaining line is indented to sit inside the factory, matching the
 * shape `dsh-client-modules` expects from a `dsh.client` bundle.
 */
function wrapLoaderModule(transpiled) {
  const lines = transpiled.split('\n')
  const injectAt = lines.findIndex((line) => /^export const inject = /.test(line))
  const exportConstAt = lines.findIndex((line) => /^export function /.test(line))
  const applyAt = lines.findIndex((line) => /^export function apply\(/.test(line))
  if (injectAt === -1 || exportConstAt === -1 || applyAt === -1) {
    throw new Error('client source must export `const inject` and `export function apply`')
  }
  // The wrapper below already declares the externals as `require` bindings, so
  // drop any module-level import the transpiler emitted for them.
  const imports = lines.filter((line) => /^import\b/.test(line))
  const unexpectedImport = imports.find(
    (line) => !EXTERNALS.some(({ specifier }) => line.includes(`"${specifier}"`) || line.includes(`'${specifier}'`)),
  )
  if (unexpectedImport !== undefined) {
    throw new Error(`client source must not import runtime modules: ${unexpectedImport}`)
  }
  const header = lines
    .slice(0, injectAt)
    .filter((line) => !/^import\b/.test(line))
    .map((line) => `\t\t${line}`)
    .filter((line) => line.trim() !== '')
  const body = lines.slice(injectAt).map((line) => line.replace(/^export /, ''))
  const externals = EXTERNALS.map(
    ({ specifier, binding }) => `\t\tvar ${binding} = require(${JSON.stringify(specifier)});`,
  )
  const footer = [
    '\t\texports.apply = apply;',
    '\t\texports.inject = inject;',
    '\t\treturn module.exports;',
    '\t}',
    '});',
  ]
  return [
    'window.__ModuleLoader__.load({',
    `\tid: ${JSON.stringify(PACKAGE_NAME)},`,
    '\tfactory: (require) => {',
    '\t\tvar module = { exports: {} };',
    '\t\tvar exports = module.exports;',
    '\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });',
    ...externals,
    ...header,
    ...body.map((line) => (line === '' ? '' : `\t\t${line}`)),
    ...footer,
    '',
  ].join('\n')
}

/** Host half: no runtime behaviour, only the Loader row the client half hangs off. */
function hostModule() {
  if (existsSync(HOST_SOURCE)) return read(HOST_SOURCE).replace(/\n+$/, '') + '\n'
  return [
    '/**',
    ' * Host half of dsh-peak-status: a no-op plugin.',
    ' *',
    ' * The Loader row this mounts is what makes `dsh-client-modules` serve the',
    ' * browser half (`./client`) to the web page. Disabling the row removes the',
    ' * status row from the composer; there is no host-side service to stop.',
    ' */',
    `export const name = ${JSON.stringify(PACKAGE_NAME)}`,
    'export function apply() {}',
    '',
  ].join('\n')
}

const files = new Map([
  ['lib/client.js', wrapLoaderModule(transpile(read(SOURCE), SOURCE)) + '\n'],
  ['lib/index.js', hostModule()],
  [
    'lib/types/index.d.ts',
    ['/** Type of the host half: a named, side-effect-free plugin. */', 'export declare const name: string;', 'export declare function apply(): void;', ''].join('\n'),
  ],
  [
    'lib/types/client/index.d.ts',
    ['/** Type of the browser half, as the DSH client module loader consumes it. */', "export declare const inject: readonly ['slots'];", 'export declare function apply(ctx: unknown): void;', ''].join('\n'),
  ],
])

if (CHECK) {
  const stale = []
  for (const [relative, expected] of files) {
    const path = join(ROOT, relative)
    if (!existsSync(path) || read(path) !== expected) stale.push(relative)
  }
  if (stale.length > 0) {
    console.error(`build --check: ${stale.length} artifact(s) out of date: ${stale.join(', ')}`)
    console.error('run `node scripts/build.mjs` and commit the result')
    process.exit(1)
  }
  console.log(`build --check: ${files.size} artifact(s) up to date`)
} else {
  for (const [relative, content] of files) {
    const path = join(ROOT, relative)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, content, 'utf8')
    console.log(`wrote ${relative} (${Buffer.byteLength(content)} bytes)`)
  }
}
