package com.zip.backend.bills;

import com.zip.backend.ai.AiService;
import com.zip.backend.ai.GeminiClient;
import com.zip.backend.auth.AuthRepository;
import com.zip.backend.common.ApiException;
import java.io.IOException;
import java.time.*;
import java.util.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.json.JsonMapper;

@RestController
@RequestMapping("/api/ai/conversations/{conversationId}/bill-photo")
public class BillPhotoController {
    private final org.springframework.jdbc.core.JdbcTemplate jdbc;
    private final com.zip.backend.ai.AiRepository conversations;
    private final GeminiClient gemini;
    private final BillService bills;
    private final BillRepository repository;
    private final AiService ai;
    private final AuthRepository auth;
    private final JsonMapper json;
    private final Clock clock;
    private final org.springframework.transaction.support.TransactionTemplate tx;
    public BillPhotoController(GeminiClient gemini, BillService bills, BillRepository repository, AiService ai, AuthRepository auth, JsonMapper json, Clock clock, org.springframework.transaction.support.TransactionTemplate tx, org.springframework.jdbc.core.JdbcTemplate jdbc, com.zip.backend.ai.AiRepository conversations) {
        this.gemini=gemini; this.bills=bills; this.repository=repository; this.ai=ai; this.auth=auth; this.json=json; this.clock=clock;
        this.tx=tx; this.jdbc=jdbc; this.conversations=conversations;
    }

    @PostMapping(consumes="multipart/form-data")
    public Map<String,Object> register(@AuthenticationPrincipal Jwt jwt, @PathVariable long conversationId, @RequestParam String month,
        @RequestParam String timeZone, @RequestParam(defaultValue="고지서의 금액과 납부 기한을 읽어 주세요.") String question, @RequestParam MultipartFile photo) throws IOException {
        long user=Long.parseLong(jwt.getSubject()), session=Long.parseLong(jwt.getClaimAsString("sid"));
        if (!auth.sessionActive(session,user,clock.instant())) throw new ApiException(401,"로그인이 만료됐어요.");
        requireBillConversation(user,conversationId);
        if (question.isBlank() || question.length()>2000) throw BillInput.bad("질문은 1~2000자로 입력해 주세요.");
        var ym=BillInput.month(month);
        ZoneId zone;
        try { zone=ZoneId.of(timeZone); } catch (RuntimeException error) { throw BillInput.bad("올바른 지역 시간대를 보내 주세요."); }
        if (ym.isAfter(YearMonth.from(clock.instant().atZone(zone)))) throw BillInput.bad("미래 월에는 등록할 수 없어요.");
        byte[] bytes=photo.getBytes();
        String mime=photo.getContentType();
        if (bytes.length==0 || bytes.length>2*1024*1024 || !validImage(bytes,mime)) throw BillInput.bad("2MB 이하의 JPG 또는 PNG 사진을 올려 주세요.");
        String hash;
        try { hash=HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(bytes)); }
        catch (java.security.NoSuchAlgorithmException error) { throw new IllegalStateException(error); }
        if (repository.photoImport(user,hash)!=null) throw new ApiException(409,"이미 등록한 사진이에요. 등록된 내역을 확인해 주세요.");
        if (!gemini.enabled()) throw new ApiException(503,"AI 사진 인식 설정이 필요해요. 직접 등록을 이용해 주세요.","AI_DISABLED");
        var date=LocalDate.now(clock.withZone(ZoneId.of("Asia/Seoul")));
        if (!ai.takeQuestion(user,date)) throw new ApiException(429,"오늘 AI 사용량을 모두 사용했어요.","AI_LIMIT");
        try {
            Map<String,Object> result;
            String documentHash;
            try {
                var qr=BillQrReader.read(bytes);
                var root=json.readTree(qr.isBlank()?gemini.billImage(bytes,mime,month,timeZone):gemini.billImage(bytes,mime,month,timeZone,qr));
                documentHash=BillDocumentIdentity.from(root);
                if (!root.path("readable").asBoolean(false)) throw new ApiException(422,"금액·납부 기한을 명확히 읽지 못했어요. 선명한 고지서를 올리거나 직접 등록해 주세요.");
                result=new LinkedHashMap<>();
                result.put("name",root.path("name").asText()); result.put("tag",root.path("tag").asText());
                var amount=root.path("amount");
                if (!amount.isIntegralNumber() || !amount.canConvertToLong()) throw BillInput.bad("금액을 읽지 못했어요.");
                result.put("amount",amount.longValue()); result.put("dueDate",root.path("dueDate").asText());
                BillInput.monthlyCreate(result);
            } catch (ApiException error) { throw error; }
            catch (RuntimeException error) { throw new ApiException(502,"AI 사진 인식에 실패했어요. 잠시 후 다시 시도하거나 직접 등록해 주세요."); }
            return tx.execute(status -> {
                auth.lockUser(user);
                if (!auth.sessionActive(session,user,clock.instant())) throw new ApiException(401,"로그인이 만료됐어요.");
                requireBillConversation(user,conversationId);
                String draftId=UUID.randomUUID().toString();
                jdbc.update("INSERT INTO bill_photo_drafts(id,user_id,conversation_id,period_ym,time_zone,photo_hash,document_hash,input_json,expires_at) VALUES (?,?,?,?,?,?,?,?,?)",
                    draftId,user,conversationId,month,timeZone,hash,documentHash,json.writeValueAsString(result),java.sql.Timestamp.from(clock.instant().plusSeconds(1800)));
                String answer="고지서에서 읽은 "+result.get("name")+" "+result.get("amount")+"원, 납부 기한 "+result.get("dueDate")+"을 "+month+" 가계부에 등록할까요? 아직 등록하지 않았어요.";
                if (documentHash==null) answer+=" 고지서 식별 정보가 불명확해 다른 사진과의 중복 여부는 확인하지 못했어요.";
                var exchange=ai.record(user,conversationId,question,answer,null);
                return Map.of("draftId",draftId,"preview",result,"reply",exchange.get("reply"));
            });
        } catch (RuntimeException error) { ai.giveBack(user,date); throw error; }
    }

    private void requireBillConversation(long user,long conversation) {
        ai.requireConversation(user,conversation);
        if (!"bill".equals(conversations.find(conversation,user).orElseThrow(() -> new ApiException(404,"대화를 찾을 수 없어요.")).topic()))
            throw new ApiException(403,"공과금·생활비 카드에서만 고지서를 등록할 수 있어요.");
    }

    public record Decision(boolean register) {}
    @PostMapping("/{draftId}/decision")
    public Map<String,Object> decide(@AuthenticationPrincipal Jwt jwt,@PathVariable long conversationId,@PathVariable String draftId,@RequestBody Decision decision) {
        long user=Long.parseLong(jwt.getSubject()),session=Long.parseLong(jwt.getClaimAsString("sid"));
        return tx.execute(status -> {
            auth.lockUser(user);
            if (!auth.sessionActive(session,user,clock.instant())) throw new ApiException(401,"로그인이 만료됐어요.");
            requireBillConversation(user,conversationId);
            var drafts=jdbc.queryForList("SELECT * FROM bill_photo_drafts WHERE id=? AND user_id=? AND conversation_id=? FOR UPDATE",draftId,user,conversationId);
            if(drafts.isEmpty()) throw new ApiException(404,"인식 결과를 찾을 수 없어요.");
            var draft=drafts.get(0);
            if(!"PENDING".equals(draft.get("state"))) throw new ApiException(409,"이미 처리한 인식 결과예요.");
            if(!((java.sql.Timestamp)draft.get("expires_at")).toInstant().isAfter(clock.instant())) throw new ApiException(410,"인식 결과가 만료됐어요. 사진을 다시 올려 주세요.");
            BillResponse bill = null;
            if(decision.register()) {
                var root=json.readTree((String)draft.get("input_json"));
                Map<String,Object> input=new LinkedHashMap<>();
                input.put("name",root.path("name").asText()); input.put("tag",root.path("tag").asText());
                input.put("amount",root.path("amount").longValue()); input.put("dueDate",root.path("dueDate").asText());
                bill=bills.registerPhoto(user,session,(String)draft.get("period_ym"),(String)draft.get("time_zone"),(String)draft.get("photo_hash"),(String)draft.get("document_hash"),input);
            }
            jdbc.update("UPDATE bill_photo_drafts SET state=? WHERE id=?",decision.register()?"REGISTERED":"CANCELLED",draftId);
            String answer=decision.register()?"확인하신 고지서를 가계부 고정 지출에 등록했어요.":"가계부에 등록하지 않았어요.";
            var exchange=ai.record(user,conversationId,decision.register()?"가계부에 등록해 주세요.":"등록하지 않을게요.",answer,
                bill==null?null:new AiService.CardInput("LINK",Map.of("to","/my/budget/expense","bill",bill)));
            return Map.of("registered",decision.register(),"reply",exchange.get("reply"));
        });
    }

    private static boolean validImage(byte[] b,String mime) {
        return ("image/jpeg".equals(mime) && b.length>=3 && (b[0]&255)==255 && (b[1]&255)==216 && (b[2]&255)==255)
            || ("image/png".equals(mime) && b.length>=8 && Arrays.equals(Arrays.copyOf(b,8),new byte[]{(byte)137,80,78,71,13,10,26,10}));
    }
}
