package com.zip.backend.memo;

import com.zip.backend.auth.AuthRepository;
import com.zip.backend.common.ApiException;
import com.zip.backend.bills.BillInput;
import java.time.Clock;
import java.sql.Timestamp;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
public class LedgerMemoController {
    private final JdbcTemplate jdbc;
    private final AuthRepository auth;
    private final Clock clock;
    public LedgerMemoController(JdbcTemplate jdbc,AuthRepository auth,Clock clock) { this.jdbc=jdbc;this.auth=auth;this.clock=clock; }
    @DeleteMapping("/api/memos/ledger-draft/{key}")
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    @Transactional
    public void discard(@AuthenticationPrincipal Jwt jwt,@PathVariable String key) {
        long user=Long.parseLong(jwt.getSubject()); auth.lockUser(user);
        if(!auth.sessionActive(Long.parseLong(jwt.getClaimAsString("sid")),user,clock.instant())) throw new ApiException(401,"다시 로그인해 주세요.");
        if(!key.matches("[a-fA-F0-9]{32}")) throw new ApiException(400,"메모 작성 정보를 확인해 주세요.");
        jdbc.update("DELETE FROM memos WHERE user_id=? AND ledger_source IN ('income','spend','bill') AND ledger_key IN (?,?)",user,"draft:"+key,"saved:"+key);
    }
    @PostMapping("/api/memos/ledger-draft")
    @Transactional
    public Map<String,Object> prepare(@AuthenticationPrincipal Jwt jwt,@RequestBody Map<String,Object> body) {
        long user=Long.parseLong(jwt.getSubject());auth.lockUser(user);
        if(!auth.sessionActive(Long.parseLong(jwt.getClaimAsString("sid")),user,clock.instant())) throw new ApiException(401,"다시 로그인해 주세요.");
        String source=Objects.toString(body.get("kind"),"");
        if(!Set.of("income","spend","bill").contains(source)) throw new ApiException(400,"가계부 종류를 확인해 주세요.");
        String label=BillInput.text(body.get("label"),"가계부 위치",120);
        if(body.get("memoId")!=null) {
            long id=BillInput.id(body.get("memoId").toString());
            var ids=jdbc.queryForList("SELECT id FROM memos WHERE id=? AND user_id=? AND ledger_source=?",Long.class,id,user,source);
            if(ids.isEmpty()) throw new ApiException(404,"내 가계부 메모를 찾을 수 없어요.");
            return Map.of("id",Long.toString(id));
        }
        String key=Objects.toString(body.get("key"),"");
        if(!key.matches("[a-fA-F0-9]{32}")) throw new ApiException(400,"메모 작성 정보를 확인해 주세요.");
        key="draft:"+key;
        var ids=jdbc.queryForList("SELECT id FROM memos WHERE user_id=? AND ledger_source=? AND (ledger_key=? OR ledger_key=?)",Long.class,user,source,key,"saved:"+key.substring(6));
        if(ids.isEmpty()) {
            String incomeType=Objects.toString(body.get("incomeType"),"fixed");
            if(source.equals("income") && !Set.of("fixed","other").contains(incomeType)) throw new ApiException(400,"수입 종류를 확인해 주세요.");
            String folderName=source.equals("bill") ? "고정 지출" : source.equals("spend") ? "기타 지출" : incomeType.equals("other") ? "기타 수입" : "고정 수입";
            var folderIds=jdbc.queryForList("SELECT id FROM memo_folders WHERE user_id=? AND name=?",Long.class,user,folderName);
            // 분류 폴더가 없으면 만들되, 일반 폴더 만들기와 같은 100개 제한을 지킴. 이미 100개면 폴더 없이(미분류) 초안을 만듦 — 가계부 입력은 막지 않음
            if(folderIds.isEmpty() && jdbc.queryForObject("SELECT COUNT(*) FROM memo_folders WHERE user_id=?",Integer.class,user)<100) {
                jdbc.update("INSERT INTO memo_folders(user_id,name) VALUES (?,?)",user,folderName);
                folderIds=jdbc.queryForList("SELECT id FROM memo_folders WHERE user_id=? AND name=?",Long.class,user,folderName);
            }
            Long folderId=folderIds.isEmpty() ? null : folderIds.get(0);
            var now=Timestamp.from(clock.instant().truncatedTo(java.time.temporal.ChronoUnit.SECONDS));
            if(jdbc.queryForObject("SELECT COUNT(*) FROM memos WHERE user_id=?",Integer.class,user)>=1000) throw new ApiException(400,"메모는 1000개까지 만들 수 있어요.");
            jdbc.update("INSERT INTO memos(user_id,title,body,color,is_pinned,is_checklist,items,created_at,updated_at,ledger_source,ledger_key,ledger_label,folder_id) VALUES (?,?,'','노랑',FALSE,FALSE,'[]',?,?,?,?,?,?)",user,label.substring(0,Math.min(60,label.length())),now,now,source,key,label,folderId);
            ids=jdbc.queryForList("SELECT id FROM memos WHERE user_id=? AND ledger_source=? AND ledger_key=?",Long.class,user,source,key);
        }
        return Map.of("id",ids.get(0).toString());
    }
}
