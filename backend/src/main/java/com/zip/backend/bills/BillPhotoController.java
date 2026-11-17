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
    private final GeminiClient gemini;
    private final BillService bills;
    private final BillRepository repository;
    private final AiService ai;
    private final AuthRepository auth;
    private final JsonMapper json;
    private final Clock clock;
    private final org.springframework.transaction.support.TransactionTemplate tx;
    public BillPhotoController(GeminiClient gemini, BillService bills, BillRepository repository, AiService ai, AuthRepository auth, JsonMapper json, Clock clock, org.springframework.transaction.support.TransactionTemplate tx) {
        this.gemini=gemini; this.bills=bills; this.repository=repository; this.ai=ai; this.auth=auth; this.json=json; this.clock=clock;
        this.tx=tx;
    }

    @PostMapping(consumes="multipart/form-data")
    public Map<String,Object> register(@AuthenticationPrincipal Jwt jwt, @PathVariable long conversationId, @RequestParam String month,
        @RequestParam String timeZone, @RequestParam(defaultValue="고지서를 읽고 고정 지출에 등록해 주세요.") String question, @RequestParam MultipartFile photo) throws IOException {
        long user=Long.parseLong(jwt.getSubject()), session=Long.parseLong(jwt.getClaimAsString("sid"));
        if (!auth.sessionActive(session,user,clock.instant())) throw new ApiException(401,"로그인이 만료됐어요.");
        ai.requireConversation(user,conversationId);
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
                var root=json.readTree(gemini.billImage(bytes,mime,month,timeZone));
                documentHash=BillDocumentIdentity.from(root);
                if (!root.path("readable").asBoolean(false)) throw new ApiException(422,"금액·납부 기한을 명확히 읽지 못했어요. 선명한 고지서를 올리거나 직접 등록해 주세요.");
                result=new LinkedHashMap<>();
                result.put("name",root.path("name").asText()); result.put("tag",root.path("tag").asText());
                var amount=root.path("amount");
                if (!amount.isIntegralNumber() || !amount.canConvertToLong()) throw BillInput.bad("금액을 읽지 못했어요.");
                result.put("amount",amount.longValue()); result.put("dueDate",root.path("dueDate").asText());
                BillInput.monthly(result,true);
            } catch (ApiException error) { throw error; }
            catch (RuntimeException error) { throw new ApiException(502,"AI 사진 인식에 실패했어요. 잠시 후 다시 시도하거나 직접 등록해 주세요."); }
            return tx.execute(status -> {
                var bill=bills.registerPhoto(user,session,month,timeZone,hash,documentHash,result);
                String answer="고지서에서 읽은 "+bill.get("name")+" "+bill.get("amount")+"원, 납부 기한 "+bill.get("dueDate")+"을 "+month+" 고정 지출에 등록했어요. 원본과 비교해 확인해 주세요.";
                if (documentHash == null) answer+=" 고지서 식별번호·발행처·청구 월을 명확히 읽지 못해 다른 사진과의 중복 여부는 확인하지 못했어요.";
                var exchange=ai.record(user,conversationId,question,answer,new AiService.CardInput("LINK",Map.of("to","/my/budget/expense","bill",bill)));
                return Map.of("bill",bill,"reply",exchange.get("reply"));
            });
        } catch (RuntimeException error) { ai.giveBack(user,date); throw error; }
    }

    private static boolean validImage(byte[] b,String mime) {
        return ("image/jpeg".equals(mime) && b.length>=3 && (b[0]&255)==255 && (b[1]&255)==216 && (b[2]&255)==255)
            || ("image/png".equals(mime) && b.length>=8 && Arrays.equals(Arrays.copyOf(b,8),new byte[]{(byte)137,80,78,71,13,10,26,10}));
    }
}
