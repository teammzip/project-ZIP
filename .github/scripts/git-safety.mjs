import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const OID = /^[a-f0-9]{40}$/
const ZERO = '0'.repeat(40)
const LOCAL_FILE = /(?:^|\/)(?:secrets\/|db\/(?:backups|dumps|exports|private|data)\/|var\/uploads\/|application-local\.(?:properties|ya?ml)$|\.env(?:\.(?!(?:example|sample|template)$)[^/]+)?$|\.my(?:login)?\.cnf$|비밀메모\.txt$|(?:PRIORITY_2|REAL_MYSQL_UI)_VERIFICATION\.md$)|\.(?:key|pem|p12|pfx|jks|keystore|dump|bak|sqlite3?(?:-wal|-shm)?|sql\.(?:gz|zip|7z))$|(?:^|\/)(?:dump(?:[-_][^/]+)?|backup(?:[-_][^/]+)?|mysqldump[^/]*)\.sql$/i
const CREDENTIALS = [
  ['개인 키', /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY(?: BLOCK)?-----/],
  ['서비스 토큰', /\b(?:sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{25,}|glpat-[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{12,}|(?:AKIA|ASIA)[A-Z0-9]{16}|AIza[A-Za-z0-9_-]{35})\b/],
  ['JWT', /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{12,}\b/],
  ['URL에 포함된 자격증명', /\b(?:https?|postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqps?):\/\/[^\s/:@$<>]+:[^\s/@$<>]+@[^/\s<>]+/i],
]
const ASSIGNMENT = /(?:^|[^\w])["']?(?:password|passwd|db_password|mail_password|client_secret|api_key|jwt_secret|access_token|refresh_token|[A-Z][A-Z0-9_]*(?:_API_KEY|_CLIENT_SECRET|_PASSWORD))["']?[ \t]*[:=][ \t]*(?:"([^"\r\n]+)"|'([^'\r\n]+)'|([A-Za-z0-9_+./@=-]{8,})(?=\s*(?:$|[#,;])))/gi
const PLACEHOLDER = /^(?:\$\{[^}]+\}|<[^>]+>|(?:your|example|dummy|placeholder|replace|change|insert|put|test|fake)[-_][a-z0-9_-]+|changeme|password|undefined|x{8,})$/i

class SafetyError extends Error {}

function git(...args) {
  try {
    return execFileSync('git', ['--literal-pathspecs', ...args], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024,
    })
  } catch (error) {
    // Git errors can contain an input path or ref. Never forward their output.
    if (error.status === null) throw new SafetyError('Git 검사 입력을 처리하지 못했습니다.')
    throw new SafetyError('Git 객체 또는 설정을 확인할 수 없습니다.')
  }
}

function checkText(text) {
  for (const [kind, pattern] of CREDENTIALS) {
    if (pattern.test(text)) throw new SafetyError('민감정보 검사 차단 · ' + kind)
  }
  for (const match of text.matchAll(ASSIGNMENT)) {
    const value = (match[1] ?? match[2] ?? match[3]).trim()
    if (value.length >= 8 && !PLACEHOLDER.test(value)) {
      throw new SafetyError('민감정보 검사 차단 · 코드에 저장된 비밀번호 또는 키')
    }
  }
}

function checkDiff(command) {
  const flags = ['--no-ext-diff', '--no-textconv', '--no-renames', '--no-color', '--diff-filter=ACMT']
  const paths = git(...command, ...flags, '--name-only', '-z', '--').split('\0').filter(Boolean)
  for (const path of paths) {
    if (LOCAL_FILE.test(path)) throw new SafetyError('민감정보 검사 차단 · 로컬 전용 파일')
    checkText(path)
  }
  if (!paths.length) return
  // Force text diffs, even for files marked binary by PR-controlled attributes.
  const patch = git(...command, ...flags, '--text', '--unified=0', '--')
  let inHunk = false
  for (const line of patch.split('\n')) {
    if (line.startsWith('diff --git ')) inHunk = false
    else if (line.startsWith('@@ ')) inHunk = true
    else if (inHunk && line.startsWith('+')) checkText(line.slice(1))
  }
}

function checkCommits(commits) {
  for (const commit of commits) {
    if (!commit) continue
    checkText(git('show', '-s', '--format=%B', commit, '--'))
    checkDiff(['show', '--format=', '--diff-merges=first-parent', commit])
  }
}

export function scanRange(base, head) {
  if (!OID.test(base) || !OID.test(head)) throw new SafetyError('검사할 커밋 ID를 확인할 수 없습니다.')
  checkCommits(git('rev-list', base + '..' + head, '--').trim().split('\n'))
}

function checkPush(remote) {
  const commits = new Set()
  for (const update of readFileSync(0, 'utf8').trim().split(/\r?\n/).filter(Boolean)) {
    const [localRef, local, remoteRef, previous] = update.split(' ')
    if (!OID.test(local ?? '') || !OID.test(previous ?? '')) throw new SafetyError('푸시 대상을 확인할 수 없습니다.')
    if (local === ZERO) continue
    checkText(localRef)
    checkText(remoteRef)
    if (git('cat-file', '-t', local).trim() === 'tag') checkText(git('cat-file', 'tag', local))
    const head = git('rev-parse', '--verify', local + '^{commit}').trim()
    const exclude = ['--remotes=' + remote]
    if (previous !== ZERO) {
      try {
        git('cat-file', '-e', previous + '^{commit}')
        exclude.push(previous)
      } catch {
        // Without the previous object, inspect the commits not in local remote-tracking refs.
      }
    }
    for (const commit of git('rev-list', head, '--not', ...exclude, '--').trim().split('\n')) {
      commits.add(commit)
    }
  }
  checkCommits(commits)
}

function installHooks() {
  let configuredPath
  try {
    configuredPath = execFileSync('git', ['config', '--get', 'core.hooksPath'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  } catch (error) {
    if (error.status !== 1) throw new SafetyError('Git 훅 설정을 읽을 수 없습니다.')
  }
  if (configuredPath) throw new SafetyError('이미 지정된 Git 훅 경로가 있습니다. 기존 설정을 보존합니다.')
  const directory = git('rev-parse', '--path-format=absolute', '--git-path', 'hooks').trim()
  const launchers = new Map([
    ['pre-commit', '#!/bin/sh\nexec node .github/scripts/git-safety.mjs --staged\n'],
    ['pre-push', '#!/bin/sh\nexec node .github/scripts/git-safety.mjs --pre-push "$1"\n'],
  ])
  for (const [name, content] of launchers) {
    const path = join(directory, name)
    if (existsSync(path) && readFileSync(path, 'utf8') !== content) {
      throw new SafetyError('이미 사용 중인 Git 훅이 있습니다. 기존 훅을 보존합니다.')
    }
  }
  mkdirSync(directory, { recursive: true })
  for (const [name, content] of launchers) {
    const path = join(directory, name)
    if (!existsSync(path)) writeFileSync(path, content, { flag: 'wx', mode: 0o755 })
  }
  console.log('민감정보 검사용 pre-commit과 pre-push 훅을 연결했습니다.')
}

function main([mode, first, second]) {
  if (mode === '--staged') checkDiff(['diff', '--cached'])
  else if (mode === '--range') scanRange(first, second)
  else if (mode === '--pre-push' && first) checkPush(first)
  else if (mode === '--install-hooks') installHooks()
  else throw new SafetyError('사용법: git-safety.mjs --staged | --range BASE HEAD | --install-hooks')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2))
  } catch (error) {
    console.error(error instanceof SafetyError ? error.message : '민감정보 검사를 완료할 수 없습니다.')
    process.exitCode = 1
  }
}
