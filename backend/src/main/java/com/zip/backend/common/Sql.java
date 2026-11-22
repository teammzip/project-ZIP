package com.zip.backend.common;

import java.util.Collections;
import java.util.List;

/** 여러 저장소가 같이 쓰는 SQL 조각 */
public final class Sql {
    private Sql() {}

    /**
     * 지금 걸려 있는 정지 (user_sanctions 를 s 로 부를 때, ? = 지금 두 번).
     * 로그인 거절(AuthRepository)과 관리자 회원 목록(ModerationRepository)이 같은 기준을 써야 해요.
     */
    public static final String ACTIVE_SUSPENSION =
        "s.sanction_type IN ('SUSPEND', 'BAN') AND s.revoked_at IS NULL AND s.starts_at <= ? AND (s.ends_at IS NULL OR s.ends_at > ?)";

    /**
     * 같은 회원의 요청을 한 줄로 세우는 잠금 (? = 회원 번호, 트랜잭션 안에서 맨 처음에).
     * "처음 쓰면 기본값을 만들어 줌" 처럼 없으면 만드는 일은 두 기기 · 두 화면이 동시에 하면 둘 다 만들려다 부딪혀요.
     * 맨 처음에 잠가야 뒤의 조회가 앞 요청이 만든 것을 봐요(REPEATABLE READ 는 첫 일반 조회 때의 모습을 계속 봄).
     */
    public static final String LOCK_USER = "SELECT id FROM users WHERE id = ? FOR UPDATE";

    /** LIKE '…' ESCAPE '!' 에 넣을 "이 글자가 들어 있음" 패턴 (%, _, ! 는 글자 그대로) */
    public static String likeContains(String keyword) {
        return "%" + keyword.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
    }

    /** IN (?, ?, …) 의 물음표 */
    public static String marks(List<?> values) {
        return String.join(",", Collections.nCopies(values.size(), "?"));
    }
}
