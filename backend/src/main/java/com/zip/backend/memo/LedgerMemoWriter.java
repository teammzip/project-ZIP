package com.zip.backend.memo;

import java.time.Clock;
import java.sql.Timestamp;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** 가계부 저장 트랜잭션 안에서 기존 메모장에 등록. 같은 원본은 한 메모만 유지한다. */
@Service
public class LedgerMemoWriter {
    private final JdbcTemplate jdbc;
    private final Clock clock;
    public LedgerMemoWriter(JdbcTemplate jdbc,Clock clock) { this.jdbc=jdbc;this.clock=clock; }
    public void save(long user,String source,String key,String title,String body) {
        var ids=jdbc.queryForList("SELECT id FROM memos WHERE user_id=? AND ledger_source=? AND ledger_key=?",Long.class,user,source,key);
        var now=Timestamp.from(clock.instant().truncatedTo(java.time.temporal.ChronoUnit.SECONDS));
        if(!ids.isEmpty()) {
            jdbc.update("UPDATE memos SET body=?,updated_at=?,ledger_label=? WHERE id=? AND user_id=?",body,now,title,ids.get(0),user);
        } else if(!body.isBlank()) {
            jdbc.update("INSERT INTO memos(user_id,title,body,color,is_pinned,is_checklist,items,created_at,updated_at,ledger_source,ledger_key,ledger_label) VALUES (?,?,?,'노랑',FALSE,FALSE,'[]',?,?,?,?,?)",user,title.length()>60?title.substring(0,60):title,body,now,now,source,key,title);
        }
    }
    public MapMemo attach(long user,String source,String key,String memoId,String context) {
        long id=com.zip.backend.bills.BillInput.id(memoId);
        var rows=jdbc.query("SELECT title,body,ledger_source,ledger_key FROM memos WHERE id=? AND user_id=?",(rs,n)-> {
            var data=new java.util.HashMap<String,String>(); data.put("title",rs.getString("title")); data.put("body",rs.getString("body")); data.put("ledger_source",rs.getString("ledger_source")); data.put("ledger_key",rs.getString("ledger_key")); return data;
        },id,user);
        if(rows.isEmpty()) throw new com.zip.backend.common.ApiException(404,"내 메모를 찾을 수 없어요.");
        var row=rows.get(0);
        String memoKey=java.util.Objects.toString(row.get("ledger_key"),"");
        if(!source.equals(row.get("ledger_source")) || !(key.equals(memoKey) || memoKey.startsWith("draft:") || memoKey.startsWith("saved:"))) throw new com.zip.backend.common.ApiException(409,"다른 가계부 기록의 메모예요.");
        var existing=jdbc.queryForList("SELECT id FROM memos WHERE user_id=? AND ledger_source=? AND ledger_key=? AND id<>?",Long.class,user,source,key,id);
        if(!existing.isEmpty()) throw new com.zip.backend.common.ApiException(409,"이미 연결된 메모가 있어요. 기존 메모를 열어 주세요.");
        jdbc.update("UPDATE memos SET ledger_key=?,ledger_label=? WHERE id=? AND user_id=?",key,context,id,user);
        return new MapMemo(memoId,java.util.Objects.toString(row.get("title"),""),java.util.Objects.toString(row.get("body"),""));
    }
    public record MapMemo(String id,String title,String body) {}
    public java.util.Map<String,Object> reference(long user,String source,String key) {
        var rows=jdbc.queryForList("SELECT id,title FROM memos WHERE user_id=? AND ledger_source=? AND ledger_key=?",user,source,key);
        return rows.isEmpty()?java.util.Map.of():java.util.Map.of("memoId",rows.get(0).get("id").toString(),"memoTitle",java.util.Objects.toString(rows.get(0).get("title"),""));
    }
}
