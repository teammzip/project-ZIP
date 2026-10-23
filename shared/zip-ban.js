/* 시안용 이용 정지 기록 (서버가 없어서 이 브라우저 안에서만 동작)
 * - 관리자 화면에서 정지하면 여기에 쌓이고, 로그인·회원가입·커뮤니티 글쓰기가 이 기록을 보고 막는다.
 * - 정지 기간은 1·3·5·10일(기간 정지) 또는 영구. 정지를 걸 때마다 횟수(count)가 1씩 늘고 이력(history)이 남는다.
 *   기간이 끝난 정지는 자동으로 풀리지만 횟수·이력은 남는다. (관리자가 "해제"해도 횟수는 그대로)
 * - 저장 키는 일부러 zip- 으로 시작하지 않는 'zipban-records' : 데이터 초기화·회원 탈퇴가 zip- 키를 모두 지우므로,
 *   정지당한 사람이 초기화해서 풀고 들어오는 일을 막기 위해서다.
 * - 경고(warn)는 정지 없이 기록만 남기는 조치다. 경고 횟수(warns)는 정지 횟수(count)와 따로 센다.
 * - 저장 모양: { "닉네임": { nick, uid, phone, count(정지 횟수), warns(경고 횟수), perm, until, history:[{at, days, reason, warn}] } }
 *   history 의 warn:true 는 경고, days 가 null 이면 영구 정지
 *   uid·phone 은 내 계정을 정지할 때만 채워진다. phone = "숫자만" 또는 { psalt, hash } (재가입 확인용)
 * 실제 서비스에서는 서버의 user_sanctions 표(조치 이력)로 대신한다. */
(function () {
  var KEY = 'zipban-records';
  var DAY = 86400000;

  function read() { try { var v = JSON.parse(localStorage.getItem(KEY)); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
  function write(all) { try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) { } }
  function digits(p) { return String(p || '').replace(/\D/g, ''); }
  function two(n) { return ('0' + n).slice(-2); }
  function fmt(ts) { var d = new Date(ts); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + two(d.getHours()) + ':' + two(d.getMinutes()); }

  // 지금 정지 중인 기록인지 (영구이거나 해제 일시가 아직 안 지남)
  function isActive(rec) { return !!rec && (rec.perm || (rec.until && rec.until > Date.now())); }
  // "영구 정지" / "3일 남음" / "정상"
  function label(rec) {
    if (!isActive(rec)) return '정상';
    if (rec.perm) return '영구 정지';
    var left = Math.ceil((rec.until - Date.now()) / DAY);
    return left + '일 남음';
  }
  // 사용자에게 보여 줄 안내 문구
  function message(rec) {
    var bans = (rec.history || []).filter(function (e) { return !e.warn; });
    var why = bans.length && bans[bans.length - 1].reason;
    return '이용이 정지된 계정입니다. ' + (rec.perm ? '(영구 정지)' : '(' + fmt(rec.until) + ' 해제)') + (why ? ' 사유: ' + why : '');
  }

  // 이 브라우저의 내 계정 (가입한 계정이 없으면 체험용 계정)
  function me() {
    var acc = null, st = {};
    try { acc = JSON.parse(localStorage.getItem('zip-account')); } catch (e) { }
    try { st = JSON.parse(localStorage.getItem('zip-settings')) || {}; } catch (e) { }
    var pw = window.ZipPassword, demo = pw && pw.DEMO_ACCOUNT;
    var uid = (acc && acc.uid) || (demo && demo.uid) || 'zipdemo';
    var nick = (acc && acc.nick) || (demo && demo.nick) || '지기';
    var phone = acc && acc.uid ? (acc.phoneHash ? { psalt: acc.psalt, hash: acc.phoneHash } : null) : (demo ? digits(demo.phone) : null);
    var names = [nick]; if (st.name && names.indexOf(st.name) < 0) names.push(st.name);
    return { uid: uid, nick: nick, names: names, phone: phone };
  }

  // 아이디·닉네임 중 하나라도 정지 중인 기록과 맞으면 그 기록을 돌려줌
  function findActive(who) {
    var all = read(), keys = Object.keys(all);
    for (var i = 0; i < keys.length; i++) {
      var r = all[keys[i]];
      if (!isActive(r)) continue;
      if ((who.names || [who.nick]).indexOf(r.nick) >= 0 || (who.uid && r.uid && r.uid === who.uid)) return r;
    }
    return null;
  }

  window.ZipBan = {
    read: read,
    isActive: isActive,
    label: label,
    message: message,
    fmt: fmt,
    me: me,
    // 지금 이 브라우저의 내 계정이 정지 중이면 그 기록, 아니면 null
    meActive: function () { return findActive(me()); },
    // 정지 걸기: days = 1·3·5·10, 0 이면 영구. info = { uid, phone } (알면 같이 저장)
    ban: function (nick, days, reason, info) {
      var all = read(), r = all[nick] || { nick: nick, count: 0, perm: false, until: null, history: [] };
      if (info && info.uid) r.uid = info.uid;
      if (info && info.phone) r.phone = info.phone;
      r.count = (r.count || 0) + 1;
      r.perm = !days;
      r.until = days ? Date.now() + days * DAY : null;
      r.history.push({ at: Date.now(), days: days || null, reason: reason || '' });
      all[nick] = r; write(all); return r;
    },
    // 경고 주기: 정지는 걸지 않고 경고 횟수와 이력만 남김
    warn: function (nick, reason) {
      var all = read(), r = all[nick] || { nick: nick, count: 0, perm: false, until: null, history: [] };
      r.warns = (r.warns || 0) + 1;
      r.history.push({ at: Date.now(), days: null, reason: reason || '', warn: true });
      all[nick] = r; write(all); return r;
    },
    // 정지 풀기 (횟수·이력은 남김)
    unban: function (nick) {
      var all = read(), r = all[nick]; if (!r) return;
      r.perm = false; r.until = null; write(all);
    },
    // 가입하려는 닉네임·아이디·휴대전화가 정지 중인 계정과 같은지 확인 (같으면 그 기록, 아니면 null)
    checkSignup: function (nick, uid, phone) {
      var hit = findActive({ nick: nick, names: [nick], uid: uid });
      if (hit) return Promise.resolve(hit);
      var all = read(), keys = Object.keys(all), d = digits(phone), jobs = [];
      keys.forEach(function (k) {
        var r = all[k]; if (!isActive(r) || !r.phone) return;
        if (typeof r.phone === 'string') { if (r.phone === d) jobs.push(Promise.resolve(r)); return; }
        if (window.ZipPassword && window.ZipPassword.hashPhone) jobs.push(window.ZipPassword.hashPhone(d, r.phone.psalt).then(function (h) { return h === r.phone.hash ? r : null; }));
      });
      return Promise.all(jobs).then(function (rs) { return rs.filter(Boolean)[0] || null; });
    }
  };
})();
