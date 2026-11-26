import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

// 화면 오류 안내(흰 화면 방지)와 배포 직후 옛 화면 파일 오류의 자동 새로고침 규칙
const read = (file) => readFileSync(new URL(file, import.meta.url), 'utf8')
const compile = (file) => ts.transpileModule(read(file), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText
const chunk = {}
vm.runInNewContext(compile('../src/lib/staleChunk.ts'), { exports: chunk })
const { isStaleChunkError, canAutoReload, markAutoReload } = chunk

const memoryStorage = () => {
  const values = new Map()
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) }
}

test('브라우저별 옛 화면 파일 오류 문구를 알아보고 다른 오류는 구분한다', () => {
  for (const message of [
    'Failed to fetch dynamically imported module: https://zip.example/assets/MapPage-abc.js', // Chrome · Edge
    'Importing a module script failed.', // Safari
    'error loading dynamically imported module: https://zip.example/assets/MapPage-abc.js', // Firefox
    'Unable to preload CSS for /assets/MapPage-abc.css', // Vite
  ]) assert.equal(isStaleChunkError(new Error(message)), true, message)
  for (const error of [new Error("Cannot read properties of undefined (reading 'map')"), new TypeError('x is not a function'), null, undefined, { status: 404 }]) {
    assert.equal(isStaleChunkError(error), false)
  }
})

test('자동 새로고침은 10초 안에 한 번만 해서 무한 새로고침이 되지 않는다', () => {
  const storage = memoryStorage()
  assert.equal(canAutoReload(storage, 100_000), true)
  markAutoReload(storage, 100_000)
  assert.equal(canAutoReload(storage, 105_000), false)
  assert.equal(canAutoReload(storage, 110_000), true)
})

test('저장소를 못 쓰는 브라우저에서는 자동 새로고침 없이 안내 화면만 보여 준다', () => {
  assert.equal(canAutoReload(undefined), false)
  const blocked = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
  assert.equal(canAutoReload(blocked), false)
  assert.doesNotThrow(() => markAutoReload(blocked))
})

test('최상위 화면 경로에 오류 화면이 연결돼 있어 어느 화면 오류든 흰 화면이 되지 않는다', () => {
  const router = read('../src/app/router.tsx')
  assert.match(router, /import \{ RouteErrorPage \} from '@\/pages\/RouteErrorPage'/)
  const root = router.slice(router.indexOf('createBrowserRouter(['), router.indexOf('children: ['))
  assert.match(root, /errorElement: <RouteErrorPage \/>/)
  const page = read('../src/pages/RouteErrorPage.tsx')
  assert.match(page, /role="alert"/)
  assert.match(page, />\s*새로고침\s*</)
  assert.match(page, /href="\/"/)
})
