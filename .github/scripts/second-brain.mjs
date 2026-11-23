import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
import { posix } from 'node:path'
import { pathToFileURL } from 'node:url'
import { scanRange } from './git-safety.mjs'

const TOPIC = /^wiki\/topics\/[a-z0-9-]+\.md$/
const SHA = /^[a-f0-9]{40}$/
const SOURCE = /^(frontend\/(src\/|API\.md$|vite\.config\.ts$|package\.json$)|backend\/(src\/main\/|openapi\.yaml$|build\.gradle$)|db\/(schema\.sql$|migrations\/.*\.sql$|seeds\/.*\.sql$))/

// Prefer links maintained in the wiki. These rules cover new or uncited code.
const AREA_TOPICS = [
  [/trash[_-]?schedule|trashreminder/i, 'trash-schedules'],
  [/anniversar|\/(calendar|notification)\/|\/(Calendar|Noti)Page\./i, 'calendar-notifications'],
  [/homeinfo|housing|\/(onboarding|loan)\/|\/MyInfo\./i, 'home-info'],
  [/\/bills\/|fixedexpense|monthlybill|billingtimezone/i, 'fixed-expenses'],
  [/ledger|\/memo\/|\/(Budget|Income|Spend|Expense|Memo)Page\./i, 'ledger-memos'],
  [/\/(community|support|moderation|admin|notice)\/|\/(Support|Notice)Page\./i, 'community-operations'],
  [/\/map\/|place_review|\/MyReviewsPage\./i, 'map-place-ids'],
  [/\/(ai|legal|weather)\/|gemini|kakaolocal/i, 'service-integrations'],
  [/^db\//, 'database'],
]

function runGit(args, env = process.env) {
  return execFileSync('git', ['--literal-pathspecs', ...args], {
    env,
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

const git = (...args) => runGit(args)

function commit(ref) {
  const oid = git('rev-parse', '--verify', '--end-of-options', ref + '^{commit}').trim()
  if (!SHA.test(oid)) throw new Error('Invalid commit SHA.')
  return oid
}

function treePaths(revision, ...paths) {
  const entries = git('ls-tree', '-r', '-z', revision, '--', ...paths).split('\0')
  return entries.filter(entry => /^100644 blob /.test(entry))
    .map(entry => entry.slice(entry.indexOf('\t') + 1))
}

function blob(revision, path) {
  return git('cat-file', 'blob', revision + ':' + path)
}

function ensureHead(pr, number, token) {
  try {
    commit(pr.head.sha)
    return
  } catch {
    // Fork commits and branches updated during checkout may need a fetch.
  }
  const auth = Buffer.from('x-access-token:' + token).toString('base64')
  runGit(['--config-env=http.extraHeader=SECOND_BRAIN_GIT_AUTH', 'fetch', '--no-tags',
    '--no-recurse-submodules', 'origin', 'refs/pull/' + number + '/head'], {
    ...process.env,
    SECOND_BRAIN_GIT_AUTH: 'AUTHORIZATION: basic ' + auth,
  })
  if (commit('FETCH_HEAD') !== pr.head.sha) throw new Error('PR이 갱신되어 새 실행에서 확인합니다.')
}

export function findGaps(paths, topics, currentTopics) {
  const changed = new Set(paths)
  const links = new Map()
  for (const [topic, markdown] of topics) {
    for (const [, target] of markdown.matchAll(/\]\((\.\.\/\.\.\/[^#)\s]+)(?:#[^)\s]*)?\)/g)) {
      const source = posix.normalize(posix.join(posix.dirname(topic), target))
      if (!links.has(source)) links.set(source, new Set())
      links.get(source).add(topic)
    }
  }
  return paths.filter(path => SOURCE.test(path)).flatMap(source => {
    const area = AREA_TOPICS.find(([pattern]) => pattern.test(source))?.[1] ?? 'application'
    const candidates = [...(links.get(source) ?? ['wiki/topics/' + area + '.md'])]
    const missing = candidates.filter(path => !currentTopics.has(path) || !changed.has(path))
    if (links.has(source)) return missing.length ? [{ source, topics: missing }] : []
    // For uncited source, use the topic by area; a newly documented source may
    // instead be linked directly from a changed topic.
    const newlyLinked = [...currentTopics].some(([path, markdown]) =>
      changed.has(path) && linksToSource(markdown, source))
    return missing.length && !newlyLinked ? [{ source, topics: missing }] : []
  })
}

function linksToSource(markdown, source) {
  const target = '../../' + source
  return markdown.includes('](' + target + ')') || markdown.includes('](' + target + '#')
}

function inspect(base, head) {
  const mergeBase = git('merge-base', base, head).trim()
  const diffArgs = ['diff', '--no-ext-diff', '--no-textconv', '--no-renames', mergeBase, head]
  const paths = git(...diffArgs, '--name-only', '-z').split('\0').filter(Boolean)
  const trusted = new Map(treePaths(base, 'wiki/topics').filter(path => TOPIC.test(path))
    .map(path => [path, blob(base, path)]))
  const currentTopicPaths = new Set(treePaths(head, 'wiki/topics').filter(path => TOPIC.test(path)))
  const current = new Map([...currentTopicPaths].map(path => [
    path,
    // The head may lag behind dev. Only changed documents count as PR edits.
    paths.includes(path) ? blob(head, path) : '',
  ]))
  const gaps = findGaps(paths, trusted, current)
  return gaps
}

function summarize(gaps) {
  if (process.env.GITHUB_STEP_SUMMARY) {
    const topics = [...new Set(gaps.flatMap(gap => gap.topics))].sort()
    appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      '### Second Brain 문서 확인 대상\n\n' + gaps.length + '개 코드 파일 변경을 확인하세요.\n\n' +
      topics.map(path => '- ' + path + '\n').join(''))
  } else {
    console.log(gaps.map(({ source, topics }) => source + ' → ' + topics.join(', ')).join('\n'))
  }
}

function githubApi(url, key, body) {
  return fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    redirect: 'error',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(180_000),
  }).then(async response => {
    if (!response.ok) throw new Error('API request failed (HTTP ' + response.status + ').')
    try {
      return await response.json()
    } catch {
      throw new Error('GitHub 응답 형식을 확인할 수 없습니다.')
    }
  })
}

export async function review(event, env) {
  const { pull_request: pr, number } = event
  if (!Number.isSafeInteger(number) || pr.base.ref !== 'dev' || pr.draft ||
      !SHA.test(pr.head.sha) || !SHA.test(pr.base.sha) ||
      pr.base.repo.full_name !== env.GITHUB_REPOSITORY) {
    throw new Error('지원되는 dev PR 이벤트가 아닙니다.')
  }
  const repository = env.GITHUB_REPOSITORY
  const rest = env.GITHUB_API_URL + '/repos/' + repository
  const gh = (url, body) => githubApi(url, env.GH_TOKEN, body)
  const currentPr = () => gh(rest + '/pulls/' + number)
  const isCurrent = live => live.state === 'open' && !live.draft &&
    live.base.ref === pr.base.ref && live.head.ref === pr.head.ref && live.head.sha === pr.head.sha
  const status = (sha, state, description) => gh(rest + '/statuses/' + sha, {
    context: 'Second Brain / 문서 동기화',
    state,
    description,
    target_url: env.GITHUB_SERVER_URL + '/' + repository + '/actions/runs/' + env.GITHUB_RUN_ID,
  })

  if (!isCurrent(await currentPr())) return
  await status(pr.head.sha, 'pending', '관련 Second Brain 문서를 확인 중입니다.')
  try {
    // Fetch PR objects through the base repo. Never checkout, import or execute the PR.
    ensureHead(pr, number, env.GH_TOKEN)
    scanRange(pr.base.sha, pr.head.sha)
    const gaps = inspect(pr.base.sha, pr.head.sha)
    if (gaps.length) {
      summarize(gaps)
      throw new Error('관련 위키 문서를 같은 PR에서 갱신하세요.')
    }
    await status(pr.head.sha, 'success', '민감정보 패턴 및 관련 문서 누락 후보가 없습니다.')
  } catch (error) {
    await status(pr.head.sha, 'failure', '민감정보 또는 관련 문서를 확인하세요. 실행 로그에 유형이 표시됩니다.')
    throw error
  }
}

async function main(args) {
  if (args[0] === '--check' && args.length === 3) {
    const gaps = inspect(commit(args[1]), commit(args[2]))
    if (gaps.length) summarize(gaps)
    else console.log('관련 Second Brain 문서 누락 후보가 없습니다.')
    return gaps.length ? 1 : 0
  }
  if (args.length) throw new Error('Usage: node .github/scripts/second-brain.mjs --check BASE HEAD')
  await review(JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')), process.env)
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = await main(process.argv.slice(2))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
