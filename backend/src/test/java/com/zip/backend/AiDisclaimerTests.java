package com.zip.backend;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.zip.backend.ai.AiService;
import org.junit.jupiter.api.Test;

/** 법률·세금·의료·금융 질문에는 서버가 면책 문구를 직접 붙이는지 확인한다. */
class AiDisclaimerTests {
    @Test
    void addsDisclaimerWhenTheQuestionIsLegal() {
        String result = AiService.withDisclaimer("집주인이 보증금을 안 줘요. 소송해야 하나요?", "내용증명을 먼저 보내 보세요.");
        assertTrue(result.startsWith("내용증명을 먼저 보내 보세요."));
        assertTrue(result.contains("※ 참고용 안내예요."));
    }

    @Test
    void addsDisclaimerWhenOnlyTheAnswerIsSensitive() {
        assertTrue(AiService.withDisclaimer("몸이 안 좋아요", "증상이 계속되면 병원에 가 보세요.").contains("※ 참고용"));
    }

    @Test
    void doesNotReactToCommonWordsLikeMethod() {
        assertEquals("식초를 써 보세요.", AiService.withDisclaimer("곰팡이 제거 방법 알려줘요. 약속이에요", "식초를 써 보세요."));
    }

    @Test
    void doesNotAddTwice() {
        String once = AiService.withDisclaimer("세금이 궁금해요", "연말정산을 확인하세요.");
        assertEquals(once, AiService.withDisclaimer("세금이 궁금해요", once));
    }

    @Test
    void keepsEmptyAnswersEmpty() {
        assertEquals("", AiService.withDisclaimer("세금이 궁금해요", ""));
    }
}
