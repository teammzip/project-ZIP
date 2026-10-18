/* 시안용 계정 정보 보관·확인 (서버가 없어서 이 브라우저 안에서만 동작)
 * - 비밀번호·휴대전화 원문은 저장하지 않고, 소금(salt)을 섞은 해시만 localStorage 의 zip-account 에 저장한다.
 *   저장 내용: { uid(아이디), nick(닉네임), psalt·phoneHash(휴대전화 해시), salt·hash(비밀번호 해시) }
 * - 가입 페이지에서 가입하면 그 정보가 저장되고, 가입 기록이 없으면 체험용 계정(DEMO_ACCOUNT)으로 동작한다.
 * - 쓰는 곳: 내 정보의 비밀번호 변경(verify, set), 가입(set), 아이디 찾기(findId), 비밀번호 찾기(checkReset, resetPassword)
 * - 데이터 초기화·회원 탈퇴는 zip- 키를 모두 지우므로 이 기록도 같이 지워져 체험용 계정으로 돌아간다.
 * 실제 서비스에서는 서버가 해시(bcrypt 등)로 저장·확인해야 하며, 이 파일은 필요 없어진다. */
(function () {
  var KEY = 'zip-account';
  // 가입 기록이 없을 때 쓰는 체험용 계정 (비밀번호 zip12345)
  var DEMO_ACCOUNT = { uid: 'zipdemo', nick: '지기', phone: '1234-5678', password: 'zip12345' };

  function toHex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function weak(text) {   // crypto.subtle 을 못 쓰는 환경(보안되지 않은 주소 등)용 간단한 대체
    var h = 2166136261;
    for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return 'fnv:' + (h >>> 0).toString(16);
  }
  function hash(text, salt) {
    var t = salt + ':' + text;
    if (window.crypto && crypto.subtle && window.TextEncoder) {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)).then(function (b) { return 'sha256:' + toHex(b); });
    }
    return Promise.resolve(weak(t));
  }
  function read() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
  function write(rec) { try { localStorage.setItem(KEY, JSON.stringify(rec)); } catch (e) { } }
  function newSalt() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
  function digits(p) { return String(p || '').replace(/\D/g, ''); }   // "1234-5678" → "12345678"

  /* 입력한 닉네임/아이디·휴대전화가 저장된 계정과 맞는지. 맞으면 계정 정보를, 아니면 null 을 돌려줌 */
  function matchAccount(opts) {
    var a = read();
    if (!a || !a.uid) {   // 가입 기록이 없으면 체험용 계정과 비교
      var d = DEMO_ACCOUNT;
      var ok = digits(opts.phone) === digits(d.phone) &&
        (opts.nick == null || String(opts.nick).trim() === d.nick) && (opts.uid == null || String(opts.uid).trim() === d.uid);
      return Promise.resolve(ok ? { uid: d.uid, nick: d.nick } : null);
    }
    if (!a.phoneHash) return Promise.resolve(null);   // 휴대전화 없이 저장된 옛 기록은 확인할 수 없음
    return hash(digits(opts.phone), a.psalt).then(function (h) {
      var ok = h === a.phoneHash &&
        (opts.nick == null || String(opts.nick).trim() === a.nick) && (opts.uid == null || String(opts.uid).trim() === a.uid);
      return ok ? { uid: a.uid, nick: a.nick } : null;
    });
  }

  /* 비밀번호(와 필요하면 아이디·닉네임·휴대전화)를 저장. 휴대전화를 안 넘기면 이미 저장된 값을 그대로 둠 */
  function save(pw, uid, extra) {
    var cur = read() || {}, salt = newSalt();
    return hash(pw, salt).then(function (h) {
      var rec = { uid: uid || cur.uid || '', nick: (extra && extra.nick != null) ? extra.nick : (cur.nick || ''), psalt: cur.psalt, phoneHash: cur.phoneHash, salt: salt, hash: h };
      if (extra && extra.phone) {
        rec.psalt = newSalt();
        return hash(digits(extra.phone), rec.psalt).then(function (ph) { rec.phoneHash = ph; write(rec); });
      }
      write(rec);
    });
  }

  window.ZipPassword = {
    DEMO_ACCOUNT: DEMO_ACCOUNT,
    DEMO: DEMO_ACCOUNT.password,
    hasCustom: function () { var a = read(); return !!(a && a.hash); },   // 가입 등으로 정한 계정이 있는지
    set: save,                                                            // 가입, 비밀번호 변경
    verify: function (pw) {                                               // 지금 비밀번호가 맞는지
      var a = read();
      if (!a || !a.hash) return Promise.resolve(pw === DEMO_ACCOUNT.password);
      return hash(pw, a.salt).then(function (h) { return h === a.hash; });
    },
    findId: function (nick, phone) {                                      // 아이디 찾기: 닉네임 + 휴대전화가 맞으면 아이디 (아니면 null)
      return matchAccount({ nick: nick, phone: phone }).then(function (m) { return m ? m.uid : null; });
    },
    checkReset: function (uid, phone) {                                   // 비밀번호 찾기 1단계: 아이디 + 휴대전화가 맞는지
      return matchAccount({ uid: uid, phone: phone }).then(function (m) { return !!m; });
    },
    resetPassword: function (pw) {                                        // 비밀번호 찾기 2단계: 새 비밀번호로 바로 재설정
      var a = read();
      if (a && a.uid) return save(pw);
      var d = DEMO_ACCOUNT;   // 체험용 계정이었다면 이제 정식 기록으로 저장
      return save(pw, d.uid, { nick: d.nick, phone: d.phone });
    }
  };
})();
