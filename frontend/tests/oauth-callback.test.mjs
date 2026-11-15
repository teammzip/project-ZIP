import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const exports = {}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/features/auth/oauthCallback.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports, URLSearchParams })

test('토큰은 fragment를 우선하고 query 전환 호환성을 유지한다', () => {
  assert.equal(exports.readOAuthCallback('?token=legacy', '#token=current').token, 'current')
  assert.equal(exports.readOAuthCallback('?token=legacy', '').token, 'legacy')
  assert.equal(exports.readOAuthCallback('', '#token=current').token, 'current')
})
test('실패 이유와 토큰 없는 응답을 구분한다', () => {
  assert.equal(exports.readOAuthCallback('?error=cancelled', '').error, 'cancelled')
  assert.equal(exports.readOAuthCallback('', '').token, null)
})

function callbackPage(me) {
  const events = []
  const effects = []
  const auth = { token: 'previous-session', user: { id: 'previous-user' },
    clearAuth() { events.push('clear'); this.token = null; this.user = null },
    setAuth(user, token) { events.push('login'); auth.user = user; auth.token = token },
  }
  const store = (selector) => selector(auth)
  store.getState = () => auth
  store.setState = (patch) => Object.assign(auth, patch)
  const component = {}
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/pages/auth/OAuthCallbackPage.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports: component,
    window: { location: { pathname: '/oauth/callback' }, history: { state: {}, replaceState(_state, _title, url) { events.push(`url:${url}`) } } },
    require: (name) => {
      if (name === 'react') return { useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}], useRef: () => ({ current: false }), useEffect: (effect) => effects.push(effect) }
      if (name === 'react-router-dom') return { Link: 'a', useNavigate: () => () => events.push('navigate'), useLocation: () => ({ search: '', hash: '#token=current-session' }) }
      if (name === '@/features/auth/oauthCallback') return exports
      if (name === '@/features/auth') return { useAuthStore: store, authApi: { me: () => {
        events.push('me')
        assert.equal(auth.user, null)
        assert.equal(auth.token, 'current-session')
        return me()
      } } }
      if (name === '@/lib/apiClient') return { getErrorMessage: () => 'error' }
      if (name.endsWith('.css')) return { default: {} }
      return require(name)
    },
  })
  component.OAuthCallbackPage()
  return { events, auth, start: () => effects[0]() }
}

test('서버 요청 전에 URL 토큰과 이전 회원 상태를 제거한다', async () => {
  const page = callbackPage(async () => ({ id: 'new-user' }))
  page.start()
  assert.deepEqual(page.events.slice(0, 3), ['url:/oauth/callback', 'clear', 'me'])
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(page.auth.user.id, 'new-user')
  assert.equal(page.events.at(-1), 'navigate')
})

test('콜백 조회 중 다른 세션으로 바뀌면 이전 응답을 적용하지 않는다', async () => {
  let resolve
  const page = callbackPage(() => new Promise((done) => { resolve = done }))
  page.start()
  page.auth.token = 'another-session'; page.auth.user = { id: 'another-user' }
  resolve({ id: 'stale-user' })
  await new Promise((done) => setImmediate(done))
  assert.equal(page.auth.user.id, 'another-user')
  assert.ok(!page.events.includes('login'))
})
