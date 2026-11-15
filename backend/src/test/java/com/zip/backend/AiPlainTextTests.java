package com.zip.backend;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.zip.backend.ai.AiService;
import org.junit.jupiter.api.Test;

class AiPlainTextTests {
    @Test
    void removesMarkdownMarks() {
        String raw = "안녕하세요! **ZIP AI**입니다.\n\n**1. 원인 차단**\n*   **음식물 관리:** 남기지 마세요.\n* 틈새 막기\n## 제목\n`코드`";
        String expected = "안녕하세요! ZIP AI입니다.\n\n1. 원인 차단\n- 음식물 관리: 남기지 마세요.\n- 틈새 막기\n제목\n코드";
        assertEquals(expected, AiService.plain(raw));
    }

    @Test
    void keepsPlainText() {
        assertEquals("2 * 3 = 6 이에요", AiService.plain("2 * 3 = 6 이에요"));
    }
}
