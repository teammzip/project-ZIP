import { expect, test, type Page } from '@playwright/test'

const date = '2026-11-28'
const calendar = `/my/calendar?date=${date}`
const memoPage = '/my/memo?id=1'
const users = [
  { id: '101', username: 'first01', nickname: '첫 번째 회원', address: '', provider: 'email', role: 'USER', firstLogin: false },
  { id: '202', username: 'second01', nickname: '두 번째 회원', address: '', provider: 'email', role: 'USER', firstLogin: false },
]
const token = (owner: string) => `fixture.${Buffer.from(JSON.stringify({ sid: owner })).toString('base64url')}.token`

async function setupApi(page: Page, origin: string) {
  type Item = { id: string; title: string; [field: string]: unknown }
  const makeMemo = (title: string) => ({ id: '1', title, body: '서버에 있는 본문', color: '노랑', pinned: false,
    checklist: false, items: [], folderId: null, draft: false, createdAt: `${date}T00:00:00Z`, updatedAt: `${date}T00:00:00Z` })
  const makeEvent = (title: string) => ({ id: '1', title, date, time: '09:30', category: null, done: false, anniv: false, yearly: false })
  const state = new Map(users.map((user, index) => [user.id, {
    memos: [makeMemo(index === 0 ? '첫 계정 메모' : '둘째 계정 메모')] as Item[],
    events: [makeEvent(index === 0 ? '첫 계정 일정' : '둘째 계정 일정')] as Item[],
  }]))
  const writes: { owner: string; method: string; path: string; body: Item }[] = []
  let nextId = 10
  let refusal: { path: string; message: string } | undefined
  await page.context().route('**/*', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (url.origin !== origin) return route.abort()
    if (!url.pathname.startsWith('/api/')) return route.continue()
    const method = req.method()
    const path = url.pathname
    if (path === '/api/auth/login' && method === 'POST') {
      const user = users.find(({ username }) => username === req.postDataJSON().loginId)
      return user ? route.fulfill({ json: { user, accessToken: token(user.id) } }) : route.fulfill({ status: 401 })
    }
    if (path === '/api/auth/logout') return route.fulfill({ status: 204 })
    const user = users.find(({ id }) => req.headers().authorization === `Bearer ${token(id)}`)
    if (!user) return route.fulfill({ status: 401 })
    if (path === '/api/auth/me') return route.fulfill({ json: user })
    if (path === '/api/me/home-memos') return route.fulfill({ json: { ids: null } })
    if (path === '/api/event-categories') return route.fulfill({ json: [{ id: '1', name: '미분류', ico: '', system: true, items: [] }] })
    if (path === '/api/event-presets' && method === 'POST') return route.fulfill({ status: 201, json: { id: '10', ...req.postDataJSON() } })
    const records = state.get(user.id)!
    const list = path.startsWith('/api/memos') ? records.memos : path.startsWith('/api/events') ? records.events : undefined
    if (list && method === 'GET') return route.fulfill({ json: list })
    if (list && (method === 'POST' || method === 'PATCH')) {
      const body = req.postDataJSON()
      writes.push({ owner: user.id, method, path, body })
      if (refusal?.path === path) {
        const { message } = refusal
        refusal = undefined
        return route.fulfill({ status: 400, json: { message } })
      }
      if (method === 'POST') {
        const record = { id: String(nextId++), ...body }
        list.push(record)
        return route.fulfill({ status: 201, json: record })
      }
      const record = list.find((item) => item.id === path.split('/').at(-1))
      if (!record) return route.fulfill({ status: 404, json: { message: '항목을 찾을 수 없어요.' } })
      Object.assign(record, body)
      return route.fulfill({ json: record })
    }
    if (['/api/event-presets', '/api/memo-folders', '/api/notices/popups', '/api/notices'].includes(path)) return route.fulfill({ json: [] })
    return route.fulfill({ status: 404, json: { message: '테스트 데이터 없음' } })
  })
  return {
    writes, state,
    reject: (path: string, message: string) => { refusal = { path, message } },
  }
}

async function login(page: Page, username: string, destination: string) {
  const fromStart = new URL(page.url()).pathname === '/start'
  if (fromStart) await page.getByRole('banner').getByRole('button', { name: '로그인', exact: true }).click()
  else await page.goto('/login')
  await page.locator('[autocomplete=username]').fill(username)
  await page.locator('[autocomplete=current-password]').fill('fixture')
  const form = fromStart ? page.getByRole('dialog', { name: '로그인' }) : page
  await form.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page).not.toHaveURL(/\/(login|start)$/)
  if (fromStart && destination === memoPage) await myTab(page, '메모')
  else await page.goto(destination)
}

async function logout(page: Page) {
  await myTab(page, '내 정보')
  await page.getByRole('button', { name: '로그아웃', exact: true }).click()
  await expect(page).toHaveURL(/\/start$/)
}

async function myTab(page: Page, name: string) {
  await page.getByRole('navigation', { name: '마이페이지 메뉴' }).getByRole('link', { name, exact: true }).click()
}

test('메모 수정 거절 후 화면 재진입과 다른 계정 로그인을 거쳐 초안을 저장한다', async ({ page, baseURL }) => {
  const api = await setupApi(page, baseURL!)
  await login(page, 'first01', memoPage)
  const body = page.getByRole('textbox', { name: '메모 내용' })
  await expect(body).toHaveValue('서버에 있는 본문')
  api.reject('/api/memos/1', '이 메모를 저장할 수 없어요.')
  await body.fill('첫 계정만 볼 수 있는 메모 초안')
  const notice = page.getByRole('region', { name: '저장하지 못한 메모' })
  await expect(notice.getByText('이 메모를 저장할 수 없어요.')).toBeVisible()
  await expect(body).toHaveValue('서버에 있는 본문')

  await myTab(page, '일정')
  await myTab(page, '메모')
  await notice.getByRole('button', { name: /초안 열기/ }).click()
  const dialog = page.getByRole('dialog', { name: '메모 초안 복구' })
  await expect(dialog.getByRole('textbox', { name: '메모 내용' })).toHaveValue('첫 계정만 볼 수 있는 메모 초안')
  await dialog.getByRole('textbox', { name: '메모 내용' }).fill('다시 편집한 메모 초안')
  await dialog.getByRole('button', { name: '나중에' }).click()
  expect(api.writes).toHaveLength(1)

  await logout(page)
  await login(page, 'second01', memoPage)
  await expect(page.getByRole('textbox', { name: '메모 제목' })).toHaveValue('둘째 계정 메모')
  await expect(notice).toHaveCount(0)
  await expect(page.getByText('다시 편집한 메모 초안')).toHaveCount(0)
  await logout(page)
  await login(page, 'first01', memoPage)

  await notice.getByRole('button', { name: /초안 열기/ }).click()
  await expect(dialog.getByRole('textbox', { name: '메모 내용' })).toHaveValue('다시 편집한 메모 초안')
  await dialog.getByRole('button', { name: '다시 저장' }).click()
  await expect(notice).toHaveCount(0)
  await expect(body).toHaveValue('다시 편집한 메모 초안')
  await page.reload()
  await expect(body).toHaveValue('다시 편집한 메모 초안')
  await expect(notice).toHaveCount(0)
  expect(api.writes.map(({ owner, method }) => [owner, method])).toEqual([['101', 'PATCH'], ['101', 'PATCH']])
  expect(api.state.get('202')?.memos[0].body).toBe('서버에 있는 본문')
})

test('새 일정 거절 후 재진입 시 날짜·시간을 복구하고 다른 계정에 전송하지 않는다', async ({ page, baseURL }) => {
  const api = await setupApi(page, baseURL!)
  await login(page, 'first01', calendar)
  await expect(page.getByRole('button', { name: '첫 계정 일정 일정 수정' })).toBeVisible()
  await page.getByRole('tab', { name: /직접 입력/ }).click()
  await page.getByPlaceholder('예) 월세 이체, 집주인 통화, 장보기').fill('첫 계정만 볼 수 있는 일정 초안')
  await page.getByLabel('시간 (선택)').fill('15:45')
  api.reject('/api/events', '이 일정을 저장할 수 없어요.')
  await page.getByRole('button', { name: '일정 추가', exact: true }).click()
  const notice = page.getByRole('region', { name: '저장하지 못한 일정' })
  await expect(notice.getByText('이 일정을 저장할 수 없어요.')).toBeVisible()

  await logout(page)
  await login(page, 'second01', calendar)
  await expect(page.getByRole('button', { name: '둘째 계정 일정 일정 수정' })).toBeVisible()
  await expect(notice).toHaveCount(0)
  await expect(page.getByText('첫 계정만 볼 수 있는 일정 초안')).toHaveCount(0)
  await logout(page)
  await login(page, 'first01', calendar)
  await page.reload()

  await notice.getByRole('button', { name: /초안 열기/ }).click()
  const dialog = page.getByRole('dialog', { name: '일정 초안 복구' })
  const title = dialog.getByRole('textbox', { name: '일정 제목' })
  await expect(title).toHaveValue('첫 계정만 볼 수 있는 일정 초안')
  await expect(dialog.getByLabel('날짜')).toHaveValue(date)
  await expect(dialog.getByLabel('시간 (선택)')).toHaveValue('15:45')
  expect(api.writes).toHaveLength(1)
  await title.fill('복구한 일정')
  await dialog.getByRole('button', { name: '다시 저장' }).click()
  await expect(notice).toHaveCount(0)
  await expect(page.getByRole('button', { name: '복구한 일정 일정 수정' })).toBeVisible()
  expect(api.writes.map(({ owner, method }) => [owner, method])).toEqual([['101', 'POST'], ['101', 'POST']])
  expect(api.state.get('101')?.events.at(-1)).toMatchObject({ title: '복구한 일정', date, time: '15:45' })
  expect(api.state.get('202')?.events).toHaveLength(1)
})

test('서버에서 원래 일정이 사라지면 편집 내용을 새 일정으로 저장할 수 있다', async ({ page, baseURL }) => {
  const api = await setupApi(page, baseURL!)
  await login(page, 'first01', calendar)
  await page.getByRole('checkbox', { name: '첫 계정 일정 완료' }).focus()
  await page.getByRole('button', { name: '첫 계정 일정 일정 수정' }).click()
  await page.getByRole('textbox', { name: '일정 제목', exact: true }).fill('원래 일정이 사라진 뒤 복구한 입력')
  api.state.get('101')!.events.length = 0
  await page.getByRole('button', { name: '저장', exact: true }).click()

  const notice = page.getByRole('region', { name: '저장하지 못한 일정' })
  await expect(notice.getByText('항목을 찾을 수 없어요.')).toBeVisible()
  await notice.getByRole('button', { name: /초안 열기/ }).click()
  const dialog = page.getByRole('dialog', { name: '일정 초안 복구' })
  await expect(dialog.getByRole('textbox', { name: '일정 제목' })).toHaveValue('원래 일정이 사라진 뒤 복구한 입력')
  await dialog.getByRole('button', { name: '새 항목으로 저장' }).click()
  await expect(notice).toHaveCount(0)
  expect(api.writes.map(({ method, path }) => [method, path])).toEqual([['PATCH', '/api/events/1'], ['POST', '/api/events']])
  expect(api.state.get('101')?.events).toMatchObject([{ id: '10', title: '원래 일정이 사라진 뒤 복구한 입력' }])
})
