import { useState } from 'react'
import { Button, Modal } from '@/components/ui'
import { useCommunityStore } from '@/features/community'
import { banLabel, fmtAt, isActive, useBanStore, type BanRecord } from '@/features/moderation'
import { cx } from '@/lib/cx'
import { relTime } from '@/lib/date'
import styles from './Admin.module.css'

/* 관리자 화면
 * - 회원 관리: 경고 · 기간/영구 정지 · 해제, 정지/경고 횟수 기록 · 검색 · 정렬, 여러 명 한꺼번에 정지, 조치 이력
 * - 게시글 관리: 분류 · 동네 · 검색어로 거르기, 내용·댓글 펼쳐 보기, 글·댓글 삭제 + 작성자 경고/정지
 * 서버가 없어서 회원 목록 대신 커뮤니티 글 · 댓글 작성자와 정지 기록을 모아 보여 줘요. */

type Tab = 'members' | 'posts'
/** 고른 조치: null = 조치 안 함, 'warn' = 경고, 0 = 영구 정지, 그 밖 = 정지 일수 */
type Action = null | 'warn' | number
type DialogState = {
  title: string
  msg: string
  okText: string
  /** 조치 안 함 선택지 (글 삭제할 때) */
  allowNone?: boolean
  /** 경고만 (기간 고르기 없음) */
  warnOnly?: boolean
  initial: string
  onOk: (action: Action, reason: string) => void
}

type Member = { nick: string; uid: string; posts: number; cmts: number; count: number; warns: number; rec: BanRecord | null; active: boolean }

/** 시안이라 가입 기록이 없어서 닉네임으로 정한 예시 가입일 (실제로는 users.created_at) */
function joinedAt(nick: string) {
  let h = 0
  for (const ch of nick) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const d = new Date(new Date(2026, 9, 1).getTime() - (20 + (h % 380)) * 86400000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const actionText = (e: { warn?: boolean; days: number | null }) => (e.warn ? '경고' : e.days ? `${e.days}일 정지` : '영구 정지')

export function AdminConsole({ me, onLogout, logoutPending }: { me: string; onLogout: () => void; logoutPending?: boolean }) {
  const { posts, removePost, removeComment } = useCommunityStore()
  const { records, ban, warn, unban } = useBanStore()
  const [tab, setTab] = useState<Tab>('members')
  const [dialog, setDialog] = useState<DialogState | null>(null)

  // 회원 = 글·댓글 작성자 + 정지 기록이 있는 사람 (나는 빼고)
  const map = new Map<string, Member>()
  const get = (nick: string) => {
    if (!map.has(nick)) map.set(nick, { nick, uid: '', posts: 0, cmts: 0, count: 0, warns: 0, rec: null, active: false })
    return map.get(nick)!
  }
  for (const p of posts) {
    get(p.author).posts++
    for (const c of p.comments) get(c.author).cmts++
  }
  Object.keys(records).forEach(get)
  map.delete(me)
  const members = [...map.values()].map((m) => {
    const rec = records[m.nick] ?? null
    return { ...m, rec, uid: rec?.uid ?? '', count: rec?.count ?? 0, warns: rec?.warns ?? 0, active: isActive(rec) }
  })

  /** 조치 적용 */
  const act = (nick: string, a: Action, reason: string) => {
    if (a === null) return
    if (a === 'warn') warn(nick, reason)
    else ban(nick, a, reason)
  }

  const comments = posts.reduce((t, p) => t + p.comments.length, 0)
  const stats: Array<[number, string]> = [
    [members.length, '전체 회원'],
    [members.filter((m) => m.active).length, '지금 정지 중'],
    [members.reduce((t, m) => t + m.count, 0), '누적 정지 횟수'],
    [members.reduce((t, m) => t + m.warns, 0), '누적 경고'],
    [posts.length, '게시글'],
    [comments, '댓글'],
  ]

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <h1>ZIP 관리자</h1>
        <nav className={styles.tabs} aria-label="관리 메뉴">
          {(['members', 'posts'] as const).map((t) => (
            <button key={t} type="button" className={cx(tab === t && styles.on)} aria-pressed={tab === t} onClick={() => setTab(t)}>
              {t === 'members' ? '회원 관리' : '게시글 관리'}
            </button>
          ))}
        </nav>
        <span className={styles.note}>관리자(ADMIN) 계정으로만 들어올 수 있어요. 서버가 생기면 모든 조치는 서버에 기록돼야 해요.</span>
        <span className={styles.me}>{me} 님</span>
        <Button variant="line" onClick={onLogout} loading={logoutPending}>
          로그아웃
        </Button>
      </header>

      <section className={styles.stats}>
        {stats.map(([n, label]) => (
          <div key={label} className={styles.stat}>
            <b>{n}</b>
            <span>{label}</span>
          </div>
        ))}
      </section>

      {tab === 'members' ? (
        <Members members={members} openDialog={setDialog} act={act} unban={unban} />
      ) : (
        <Posts
          posts={posts}
          isBanned={(nick) => isActive(records[nick])}
          onDelete={(title, msg, author, doDelete) =>
            setDialog({
              title,
              msg: `${msg} 작성자 "${author}"${isActive(records[author]) ? '는 이미 정지 중이에요.' : ' 님께 경고나 정지를 줄까요?'}`,
              okText: '삭제',
              allowNone: true,
              initial: 'none',
              onOk: (a, reason) => {
                doDelete()
                act(author, a, reason)
              },
            })
          }
          removePost={removePost}
          removeComment={removeComment}
        />
      )}

      {dialog && <ActionDialog state={dialog} onClose={() => setDialog(null)} />}
    </div>
  )
}

type MembersProps = {
  members: Member[]
  openDialog: (d: DialogState) => void
  act: (nick: string, a: Action, reason: string) => void
  unban: (nick: string) => void
}

function Members({ members, openDialog, act, unban }: MembersProps) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [minBans, setMinBans] = useState('')
  const [minWarns, setMinWarns] = useState('')
  const [sort, setSort] = useState('')
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [openHist, setOpenHist] = useState<string | null>(null)

  const list = members
    .filter((m) => {
      if (status === 'ok' && m.active) return false
      if (status === 'ban' && !m.active) return false
      if (status === 'temp' && !(m.active && !m.rec?.perm)) return false
      if (status === 'perm' && !(m.active && m.rec?.perm)) return false
      if (m.count < (Number(minBans) || 0) || m.warns < (Number(minWarns) || 0)) return false
      const s = q.trim().toLowerCase()
      return !s || m.nick.toLowerCase().includes(s) || m.uid.toLowerCase().includes(s)
    })
    .sort((a, b) =>
      sort === 'bans' ? b.count - a.count || b.warns - a.warns : sort === 'warns' ? b.warns - a.warns || b.count - a.count : b.posts + b.cmts - (a.posts + a.cmts),
    )
  const picked = Object.keys(selected).filter((k) => selected[k])
  const allOn = list.length > 0 && list.every((m) => selected[m.nick])

  const bulkBan = () => {
    const targets = picked.filter((n) => !members.find((m) => m.nick === n)?.rec?.perm || !members.find((m) => m.nick === n)?.active)
    if (!targets.length) return
    openDialog({
      title: `선택한 ${targets.length}명 정지`,
      msg: '선택한 회원 모두에게 같은 기간으로 정지를 걸어요. 각자 정지 횟수가 1회씩 늘어나요. (이미 영구 정지 중인 사람은 건너뛰어요)',
      okText: '일괄 정지',
      initial: 'perm',
      onOk: (a, reason) => {
        targets.forEach((n) => act(n, a, reason))
        setSelected({})
      },
    })
  }

  return (
    <main className={styles.pane}>
      <div className={styles.tools}>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="닉네임 · 아이디 검색" aria-label="회원 검색" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="상태">
          <option value="">상태 전체</option>
          <option value="ok">정상</option>
          <option value="ban">정지 중 (전체)</option>
          <option value="temp">정지 중 (기간)</option>
          <option value="perm">정지 중 (영구)</option>
        </select>
        <label className={styles.num}>
          정지 <input type="number" min={0} value={minBans} onChange={(e) => setMinBans(e.target.value)} placeholder="0" /> 회 이상
        </label>
        <label className={styles.num}>
          경고 <input type="number" min={0} value={minWarns} onChange={(e) => setMinWarns(e.target.value)} placeholder="0" /> 회 이상
        </label>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="정렬">
          <option value="">기본 정렬 (활동 많은 순)</option>
          <option value="bans">정지 횟수 많은 순</option>
          <option value="warns">경고 많은 순</option>
        </select>
      </div>

      {picked.length > 0 && (
        <div className={styles.bulk}>
          <b>선택 {picked.length}명</b>
          <Button variant="danger" onClick={bulkBan}>
            선택한 회원 정지…
          </Button>
          <Button
            variant="line"
            onClick={() => {
              picked.forEach(unban)
              setSelected({})
            }}
          >
            선택한 회원 정지 해제
          </Button>
          <Button variant="ghost" onClick={() => setSelected({})}>
            선택 취소
          </Button>
        </div>
      )}

      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={allOn}
                  aria-label="검색 결과 전체 선택"
                  onChange={(e) => setSelected({ ...selected, ...Object.fromEntries(list.map((m) => [m.nick, e.target.checked])) })}
                />
              </th>
              <th>닉네임</th>
              <th>아이디</th>
              <th>가입일</th>
              <th>쓴 글</th>
              <th>쓴 댓글</th>
              <th>경고</th>
              <th>정지 횟수</th>
              <th>상태</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {!list.length && (
              <tr>
                <td colSpan={10} className={styles.empty}>
                  해당하는 회원이 없어요.
                </td>
              </tr>
            )}
            {list.map((m) => (
              <MemberRow
                key={m.nick}
                m={m}
                checked={!!selected[m.nick]}
                onCheck={(v) => setSelected({ ...selected, [m.nick]: v })}
                histOpen={openHist === m.nick}
                onHist={() => setOpenHist(openHist === m.nick ? null : m.nick)}
                onWarn={() =>
                  openDialog({
                    title: `"${m.nick}" 회원 경고`,
                    msg: '정지는 걸지 않고 경고만 남겨요. 경고 횟수가 1회 늘어나요.',
                    okText: '경고하기',
                    warnOnly: true,
                    initial: 'warn',
                    onOk: (_a, reason) => act(m.nick, 'warn', reason),
                  })
                }
                onBan={() =>
                  m.active
                    ? unban(m.nick)
                    : openDialog({
                        title: `"${m.nick}" 회원 정지`,
                        msg: '정지 기간과 사유를 정해 주세요. 정지 횟수가 1회 늘어나요. (경고만 고르면 정지 없이 경고 횟수만 늘어나요)',
                        okText: '확인',
                        initial: '1',
                        onOk: (a, reason) => act(m.nick, a, reason),
                      })
                }
              />
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.hint}>
        서버가 없어서 회원 목록 대신 커뮤니티 글 · 댓글 작성자를 모아 보여 줘요 (나는 빼고). 가입일은 예시 값이에요. 정지 중인 회원은 앱에서 로그인 · 글쓰기 · 댓글 ·
        좋아요 · 재가입이 막혀요. 기간이 끝나 풀리거나 해제해도 정지 횟수는 남아요.
      </p>
    </main>
  )
}

type RowProps = { m: Member; checked: boolean; onCheck: (v: boolean) => void; histOpen: boolean; onHist: () => void; onWarn: () => void; onBan: () => void }

function MemberRow({ m, checked, onCheck, histOpen, onHist, onWarn, onBan }: RowProps) {
  const hist = m.rec?.history ?? []
  return (
    <>
      <tr>
        <td>
          <input type="checkbox" checked={checked} onChange={(e) => onCheck(e.target.checked)} aria-label={`${m.nick} 선택`} />
        </td>
        <td>{m.nick}</td>
        <td>{m.uid || '-'}</td>
        <td>{joinedAt(m.nick)}</td>
        <td>{m.posts}</td>
        <td>{m.cmts}</td>
        <td className={cx(m.warns >= 3 && styles.hot)}>{m.warns}회</td>
        <td className={cx(m.count >= 3 && styles.hot)}>{m.count}회</td>
        <td>
          <span className={cx(styles.badge, m.active ? (m.rec?.perm ? styles.ban : styles.temp) : styles.ok)}>{m.active ? banLabel(m.rec) : '정상'}</span>
          {m.active && !m.rec?.perm && <div className={styles.sub}>{fmtAt(m.rec!.until!)} 해제</div>}
        </td>
        <td className={styles.btns}>
          <Button variant="line" onClick={onWarn}>
            경고
          </Button>
          <Button variant={m.active ? 'line' : 'danger'} onClick={onBan}>
            {m.active ? '정지 해제' : '정지'}
          </Button>
          <Button variant="ghost" onClick={onHist} aria-expanded={histOpen}>
            {histOpen ? '기록 닫기' : '기록'}
          </Button>
        </td>
      </tr>
      {histOpen && (
        <tr className={styles.detail}>
          <td colSpan={10}>
            {!hist.length && <div className={styles.sub}>조치 기록이 없어요.</div>}
            {[...hist].reverse().map((e, i) => (
              <div key={e.at + i} className={styles.hist}>
                {hist.length - i}번째 · {fmtAt(e.at)} · {actionText(e)}
                {e.reason && ` · 사유: ${e.reason}`}
              </div>
            ))}
          </td>
        </tr>
      )}
    </>
  )
}

type PostsProps = {
  posts: ReturnType<typeof useCommunityStore.getState>['posts']
  isBanned: (nick: string) => boolean
  onDelete: (title: string, msg: string, author: string, doDelete: () => void) => void
  removePost: (id: number) => void
  removeComment: (id: number, index: number) => void
}

function Posts({ posts, isBanned, onDelete, removePost, removeComment }: PostsProps) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [region, setRegion] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)
  const cats = [...new Set(posts.map((p) => p.cat))]
  const regions = [...new Set(posts.map((p) => p.region).filter(Boolean))]
  const list = posts
    .filter((p) => (!cat || p.cat === cat) && (!region || p.region === region) && (!q || `${p.title} ${p.body} ${p.author}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.ts - a.ts)

  return (
    <main className={styles.pane}>
      <div className={styles.tools}>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="제목 · 내용 · 작성자 검색" aria-label="게시글 검색" />
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="분류">
          <option value="">분류 전체</option>
          {cats.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select value={region} onChange={(e) => setRegion(e.target.value)} aria-label="동네">
          <option value="">동네 전체</option>
          {regions.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </div>
      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>번호</th>
              <th>분류</th>
              <th>제목</th>
              <th>작성자</th>
              <th>동네</th>
              <th>작성</th>
              <th>♥</th>
              <th>댓글</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {!list.length && (
              <tr>
                <td colSpan={9} className={styles.empty}>
                  게시글이 없어요.
                </td>
              </tr>
            )}
            {list.map((p) => (
              <PostRow
                key={p.id}
                p={p}
                open={openId === p.id}
                onToggle={() => setOpenId(openId === p.id ? null : p.id)}
                banned={isBanned(p.author)}
                onDeletePost={() => onDelete('글 삭제', `"${p.title}" 글을 삭제해요. 댓글도 함께 사라져요.`, p.author, () => removePost(p.id))}
                onDeleteComment={(i) => onDelete('댓글 삭제', '이 댓글을 삭제해요.', p.comments[i].author, () => removeComment(p.id, i))}
              />
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.hint}>제목을 누르면 내용과 댓글이 펼쳐져요. 삭제한 글은 앱의 커뮤니티에서도 사라져요.</p>
    </main>
  )
}

type PostRowProps = {
  p: PostsProps['posts'][number]
  open: boolean
  onToggle: () => void
  banned: boolean
  onDeletePost: () => void
  onDeleteComment: (index: number) => void
}

function PostRow({ p, open, onToggle, banned, onDeletePost, onDeleteComment }: PostRowProps) {
  const idText = String(p.id).length > 6 ? `…${String(p.id).slice(-4)}` : String(p.id)
  return (
    <>
      <tr>
        <td>{idText}</td>
        <td>
          <span className={styles.badge}>{p.cat}</span>
        </td>
        <td>
          <button type="button" className={styles.titleBtn} onClick={onToggle} aria-expanded={open}>
            {p.title}
          </button>
        </td>
        <td>
          {p.author} {banned && <span className={cx(styles.badge, styles.ban)}>정지 중</span>}
        </td>
        <td>{p.region || '-'}</td>
        <td>{relTime(p.ts)}</td>
        <td>{p.likes}</td>
        <td>{p.comments.length}</td>
        <td>
          <Button variant="danger" onClick={onDeletePost}>
            삭제
          </Button>
        </td>
      </tr>
      {open && (
        <tr className={styles.detail}>
          <td colSpan={9}>
            <div className={styles.detailBody}>{p.body}</div>
            {!!p.attachments?.length && <div className={styles.sub}>첨부 {p.attachments.length}개: {p.attachments.map((a) => a.name).join(', ')}</div>}
            {p.comments.map((c, i) => (
              <div key={i} className={styles.cmtRow}>
                <b>{c.author}</b>
                <span>{c.text}</span>
                <Button variant="danger" onClick={() => onDeleteComment(i)}>
                  댓글 삭제
                </Button>
              </div>
            ))}
            {!p.comments.length && <div className={styles.sub}>댓글이 없어요.</div>}
          </td>
        </tr>
      )}
    </>
  )
}

/** 정지 · 경고 · 삭제 확인창: 기간(조치 안 함 / 경고 / 1·3·5·10일 / 영구)과 사유 */
function ActionDialog({ state, onClose }: { state: DialogState; onClose: () => void }) {
  const [value, setValue] = useState(state.initial)
  const [reason, setReason] = useState('')
  const confirm = () => {
    const a: Action = value === 'none' ? null : value === 'warn' ? 'warn' : value === 'perm' ? 0 : Number(value)
    state.onOk(a, reason.trim())
    onClose()
  }
  return (
    <Modal open onClose={onClose} title={state.title}>
      <div className={styles.dialog}>
        <h3>{state.title}</h3>
        <p>{state.msg}</p>
        <div className={styles.dialogRow}>
          {!state.warnOnly && (
            <label>
              조치
              <select value={value} onChange={(e) => setValue(e.target.value)}>
                {state.allowNone && <option value="none">조치 안 함</option>}
                <option value="warn">경고만 (정지 없음)</option>
                {[1, 3, 5, 10].map((d) => (
                  <option key={d} value={String(d)}>
                    {d}일 정지
                  </option>
                ))}
                <option value="perm">영구 정지</option>
              </select>
            </label>
          )}
          <label className={styles.grow}>
            사유
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={60} placeholder="예: 운영 정책 위반 (선택)" />
          </label>
        </div>
        <div className={styles.dialogBtns}>
          <Button variant="line" onClick={onClose}>
            취소
          </Button>
          <Button onClick={confirm}>{state.okText}</Button>
        </div>
      </div>
    </Modal>
  )
}
