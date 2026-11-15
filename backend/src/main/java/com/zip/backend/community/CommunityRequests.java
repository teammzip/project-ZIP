package com.zip.backend.community;

import java.util.List;

/** 커뮤니티 요청 본문 (frontend/API.md 7장). 검사는 CommunityService 에서 */
public final class CommunityRequests {
    private CommunityRequests() {}

    /** category: FREE · TIP · QUESTION · TOWN, attachmentIds: POST /api/files 로 올린 내 파일 id (순서 = 표시 순서) */
    public record PostInput(String category, String title, String body, List<String> attachmentIds) {}

    /** parentId: 답글이면 단 댓글 번호 (답글의 답글은 같은 묶음의 맨 위 댓글로) */
    public record CommentInput(String body, String parentId) {}

    /** targetType: POST · COMMENT, reason: ABUSE · FALSE_INFO · PRIVACY · AD_ILLEGAL · COPYRIGHT · OTHER (기타는 detail 필수) */
    public record ReportInput(String targetType, String targetId, String reason, String detail) {}
}
