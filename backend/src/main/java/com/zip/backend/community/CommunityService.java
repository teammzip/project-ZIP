package com.zip.backend.community;

import com.zip.backend.common.ApiException;
import com.zip.backend.files.ProfileFileService;
import com.zip.backend.notification.NotificationService;
import java.time.Clock;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 커뮤니티 (frontend/API.md 7장). 모두 로그인 후 요청이고, 정지된 회원의 토큰은 보안 설정에서 이미 막혀요.
 * 글쓰기 · 댓글 · 공감은 동네(users.region_id)가 있고 동네 인증(POST /api/me/region-verify)한 지 30일 안이어야 해요.
 */
@Service
public class CommunityService {
    static final int PAGE_SIZE = 20;
    static final int TITLE_MAX = 100;
    static final int BODY_MAX = 2_000;
    static final int COMMENT_MAX = 200;
    static final int KEYWORD_MAX = 40;
    static final int ATTACHMENT_MAX = 5;
    static final long ATTACHMENT_BYTES_MAX = 2L * 1024 * 1024;
    static final int HOME_POST_LIMIT = 3;

    private static final Set<String> CATEGORIES = Set.of("FREE", "TIP", "QUESTION", "TOWN");
    private static final Set<String> SCOPES = Set.of("here", "near", "all");
    private static final Set<String> REASONS = Set.of("ABUSE", "FALSE_INFO", "PRIVACY", "AD_ILLEGAL", "COPYRIGHT", "OTHER");
    private static final Pattern ID = Pattern.compile("[1-9][0-9]{0,18}");
    private static final Pattern CONTROL = Pattern.compile("[\\p{Cntrl}&&[^\\n\\t]]");

    private final CommunityRepository repository;
    private final ProfileFileService files;
    private final com.zip.backend.region.RegionVerifyService regionVerify;
    private final NotificationService notifications;
    private final Clock clock;

    public CommunityService(CommunityRepository repository, ProfileFileService files,
        com.zip.backend.region.RegionVerifyService regionVerify, NotificationService notifications, Clock clock) {
        this.repository = repository;
        this.files = files;
        this.regionVerify = regionVerify;
        this.notifications = notifications;
        this.clock = clock;
    }

    // ---------- 읽기 ----------

    public long myPostCount(long userId) {
        return repository.countVisiblePostsByUser(userId);
    }

    /**
     * 글 목록. regionId 를 주면 내 동네 대신 그 동네를 기준으로 걸러요 ("주변 동네" 탭의 다른 동네 둘러보기).
     * regionId 와 함께 쓰는 scope 는 here(그 동네만, 기본) · near(그 동네 + 주변). 내 동네 · 글 쓰기 동네는 바뀌지 않아요.
     */
    public PostResponse.Page posts(long viewerId, String scope, String category, String q, String sort, int page, String regionId) {
        boolean browsing = regionId != null && !regionId.isBlank();
        var range = scope == null || scope.isBlank() ? (browsing ? "here" : "all") : scope;
        if (!SCOPES.contains(range)) throw new ApiException(400, "scope 는 here, near, all 중 하나예요.");
        if (browsing && range.equals("all")) throw new ApiException(400, "regionId 는 scope here 또는 near 와 함께 써요.");
        var filter = filter(category, q, page);
        var order = postSort(sort, filter.keyword());

        List<Long> regions = null;
        if (browsing) {
            long base = id(regionId, "동네");
            if (!repository.regionExists(base)) throw notFound("동네");
            regions = range.equals("here") ? List.of(base) : repository.regionWithNeighbors(base);
        } else if (!range.equals("all")) {
            var home = repository.userRegion(viewerId);
            if (home.isEmpty()) return new PostResponse.Page(List.of(), false); // 동네가 없으면 우리 동네 · 주변 동네 글도 없음
            regions = range.equals("here") ? List.of(home.get()) : repository.regionWithNeighbors(home.get());
        }
        var rows = repository.searchPosts(viewerId, regions, filter.category(), filter.keyword(), order, PAGE_SIZE + 1, page * PAGE_SIZE);
        boolean hasNext = rows.size() > PAGE_SIZE;
        var items = rows.stream().limit(PAGE_SIZE).map(p -> postSummary(p, viewerId)).toList();
        String suggestion = null;
        if (page == 0 && rows.isEmpty()) {
            for (String candidate : CommunitySearchSuggestion.candidates(filter.keyword())) {
                if (repository.searchPosts(viewerId, regions, filter.category(), candidate,
                    CommunityRepository.PostSort.LATEST, 1, 0).isEmpty()) continue;
                if (suggestion != null) {
                    suggestion = null;
                    break;
                }
                suggestion = candidate;
            }
        }
        return new PostResponse.Page(items, hasNext, suggestion);
    }

    public List<PostResponse> homeTips(long viewerId) {
        return repository.homeTips(viewerId, HOME_POST_LIMIT).stream().map(p -> postSummary(p, viewerId)).toList();
    }

    /**
     * "주변 동네" 탭 안내: 내 동네(주거 설문 · 내 정보 주소로 정해진 users.region_id)와 이웃 동네 이름.
     * 글 목록 scope=near 가 거르는 기준과 같아서, 안내와 실제로 보이는 글의 동네가 항상 같아요.
     * 이웃은 같은 시 · 도 먼저, 그다음 시 · 도 · 이름 순. 동네가 없으면 region = null, neighbors = [].
     */
    public Map<String, Object> neighbors(long viewerId) {
        var mine = repository.userRegionName(viewerId);
        var result = new java.util.LinkedHashMap<String, Object>(); // region 이 null 일 수 있어서 Map.of 대신
        result.put("region", mine.map(CommunityService::regionView).orElse(null));
        result.put("neighbors", mine.map(r -> repository.neighborNames(r.id()).stream()
            .sorted(java.util.Comparator.comparing((CommunityRepository.RegionName n) -> !java.util.Objects.equals(n.sido(), r.sido()))
                .thenComparing(CommunityRepository.RegionName::sido, java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder()))
                .thenComparing(CommunityRepository.RegionName::name))
            .map(CommunityService::regionView).toList()).orElse(List.of()));
        return result;
    }

    /** { id, name: "마포구", sido: "서울특별시" } — 시 · 도가 없는 동네(시 · 도 자체)는 sido 가 null */
    private static Map<String, Object> regionView(CommunityRepository.RegionName region) {
        var view = new java.util.LinkedHashMap<String, Object>();
        view.put("id", Long.toString(region.id()));
        view.put("name", region.name());
        view.put("sido", region.sido());
        return view;
    }

    public List<PostResponse> popularPosts(long viewerId) {
        var region = repository.userRegion(viewerId);
        if (region.isEmpty()) return List.of();
        return repository.popularPosts(viewerId, region.get(), HOME_POST_LIMIT).stream()
            .map(p -> postSummary(p, viewerId)).toList();
    }

    public void recordView(String postId) {
        if (!repository.incrementViews(id(postId, "글"))) throw notFound("글");
    }

    public PostResponse post(long viewerId, String postId) {
        var row = repository.visiblePost(viewerId, id(postId, "글")).orElseThrow(() -> notFound("글"));
        var ids = List.of(row.id());
        return post(row, viewerId, repository.comments(viewerId, ids).getOrDefault(row.id(), List.of()),
            repository.attachments(ids).getOrDefault(row.id(), List.of()));
    }

    // ---------- 글 ----------

    @Transactional
    public PostResponse createPost(long userId, CommunityRequests.PostInput input) {
        var region = requireRegion(userId);
        var valid = validPost(input);
        var attachments = validAttachments(userId, input == null ? null : input.attachmentIds(), null);
        long postId = repository.insertPost(userId, region, valid.category(), valid.title(), valid.body());
        repository.replaceAttachments(postId, attachments);
        return post(userId, Long.toString(postId));
    }

    @Transactional
    public PostResponse updatePost(long userId, String postId, CommunityRequests.PostInput input) {
        long id = id(postId, "글");
        requireOwner(repository.lockVisiblePostOwner(id).orElseThrow(() -> notFound("글")), userId, "글");
        var valid = validPost(input);
        var attachments = validAttachments(userId, input == null ? null : input.attachmentIds(), id);
        repository.updatePost(id, valid.category(), valid.title(), valid.body());
        var removed = repository.replaceAttachments(id, attachments);
        // 수정에서 뺀 첨부는 연결을 끊고 파일도 지움 (커밋 뒤)
        files.deleteAfterCommit(repository.markFilesDeleted(removed, clock.instant()));
        return post(userId, postId);
    }

    @Transactional
    public void deletePost(long userId, String postId) {
        long id = id(postId, "글");
        requireOwner(repository.lockVisiblePostOwner(id).orElseThrow(() -> notFound("글")), userId, "글");
        repository.deletePost(id, clock.instant(), userId, null);
    }

    @Transactional
    public Map<String, Object> like(long userId, String postId, boolean on) {
        long id = id(postId, "글");
        if (on) requireRegion(userId);
        repository.lockVisiblePostOwner(id).orElseThrow(() -> notFound("글"));
        if (on) repository.addLike(id, userId);
        else repository.removeLike(id, userId);
        return Map.of("liked", on, "likes", repository.likeCount(id));
    }

    // ---------- 댓글 ----------

    @Transactional
    public PostResponse.Comment addComment(long userId, String postId, CommunityRequests.CommentInput input) {
        long id = id(postId, "글");
        requireRegion(userId);
        var body = validComment(input);
        long owner = repository.lockVisiblePostOwner(id).orElseThrow(() -> notFound("글"));
        var reply = replyTo(id, input);
        long commentId = repository.insertComment(id, userId, body, reply.parentId());
        var saved = repository.visibleComment(userId, commentId).orElseThrow();
        notifyComment(id, owner, reply, saved);
        return comment(saved, userId);
    }

    @Transactional
    public PostResponse.Comment updateComment(long userId, String commentId, CommunityRequests.CommentInput input) {
        long id = id(commentId, "댓글");
        var lock = repository.lockVisibleComment(id).orElseThrow(() -> notFound("댓글"));
        requireOwner(lock.ownerId(), userId, "댓글");
        repository.updateComment(id, validComment(input));
        return comment(repository.visibleComment(userId, id).orElseThrow(), userId);
    }

    @Transactional
    public void deleteComment(long userId, String commentId) {
        long id = id(commentId, "댓글");
        var lock = repository.lockVisibleComment(id).orElseThrow(() -> notFound("댓글"));
        requireOwner(lock.ownerId(), userId, "댓글");
        repository.deleteComment(id, lock.postId(), clock.instant(), userId, null);
    }

    // ---------- 신고 ----------

    @Transactional
    public void report(long userId, CommunityRequests.ReportInput input) {
        if (input == null) throw new ApiException(400, "신고 내용을 보내 주세요.");
        var type = input.targetType();
        if (!"POST".equals(type) && !"COMMENT".equals(type)) throw new ApiException(400, "targetType 은 POST 또는 COMMENT 예요.");
        var reason = input.reason();
        if (reason == null || !REASONS.contains(reason)) throw new ApiException(400, "신고 사유를 골라 주세요.");
        var detail = input.detail() == null ? "" : input.detail().strip();
        if (detail.length() > 200 || CONTROL.matcher(detail).find()) throw new ApiException(400, "자세한 내용은 200자 이내로 입력해 주세요.");
        if (reason.equals("OTHER") && detail.isEmpty()) throw new ApiException(400, "기타 사유는 자세한 내용을 적어 주세요.");
        long targetId = id(input.targetId(), type.equals("POST") ? "글" : "댓글");
        // 스냅샷은 실제 대상에서 복사 (클라이언트 값을 믿지 않음)
        var target = repository.reportTarget(type, targetId).orElseThrow(() -> notFound(type.equals("POST") ? "글" : "댓글"));
        if (target.authorId() == userId) throw new ApiException(400, "내가 쓴 글이나 댓글은 신고할 수 없어요.");
        try {
            repository.insertReport(userId, type, targetId, reason, detail.isEmpty() ? null : detail,
                cut(target.authorNickname(), 12), cut(target.text(), 200));
        } catch (DuplicateKeyException duplicate) {
            throw new ApiException(409, "이미 신고한 내용이에요.");
        }
    }

    // ---------- 관리자 (/api/admin/**, role = ADMIN 만) ----------

    static final int ADMIN_PAGE_SIZE = 50;
    private static final Set<String> RESOLUTIONS = Set.of("HIDDEN", "DISMISSED");

    /** 관리자 게시글 관리: 보이는 글 전체 (댓글 · 첨부 · 홈 꿀팁 여부 포함), 50개씩 */
    public PostResponse.Page adminPosts(long adminId, String category, String q, int page) {
        var filter = filter(category, q, page);
        var rows = repository.adminPosts(adminId, filter.category(), filter.keyword(), ADMIN_PAGE_SIZE + 1, page * ADMIN_PAGE_SIZE);
        var shown = rows.stream().limit(ADMIN_PAGE_SIZE).toList();
        // 댓글 · 첨부는 이 쪽의 글 전부를 한 번씩만 읽어요
        var ids = shown.stream().map(CommunityRepository.PostRow::id).toList();
        var comments = repository.comments(adminId, ids);
        var attachments = repository.attachments(ids);
        var items = shown.stream()
            .map(p -> post(p, adminId, comments.getOrDefault(p.id(), List.of()), attachments.getOrDefault(p.id(), List.of()))).toList();
        return new PostResponse.Page(items, rows.size() > ADMIN_PAGE_SIZE);
    }

    /** 관리자 글 삭제: 작성자와 상관없이 DELETED, 이 글과 댓글에 들어온 접수 중 신고는 '삭제함'(HIDDEN) */
    @Transactional
    public void adminDeletePost(long adminId, String postId, String reason) {
        long id = id(postId, "글");
        var why = deleteReason(reason);
        repository.lockVisiblePostOwner(id).orElseThrow(() -> notFound("글"));
        var target = repository.reportTarget("POST", id).orElseThrow(() -> notFound("글"));
        var now = clock.instant();
        repository.deletePost(id, now, adminId, why);
        notifications.send(target.authorId(), adminId, NotificationService.SYSTEM, "운영 정책에 따라 내 글이 삭제됐어요",
            withReason("「" + NotificationService.preview(target.text(), 40) + "」", why), null, null);
        repository.resolveReports("POST", id, "HIDDEN", adminId, now);
        repository.resolveCommentReportsOfPost(id, "HIDDEN", adminId, now);
    }

    @Transactional
    public void adminDeleteComment(long adminId, String commentId, String reason) {
        long id = id(commentId, "댓글");
        var why = deleteReason(reason);
        var lock = repository.lockVisibleComment(id).orElseThrow(() -> notFound("댓글"));
        var target = repository.reportTarget("COMMENT", id).orElseThrow(() -> notFound("댓글"));
        var now = clock.instant();
        repository.deleteComment(id, lock.postId(), now, adminId, why);
        notifications.send(lock.ownerId(), adminId, NotificationService.SYSTEM, "운영 정책에 따라 내 댓글이 삭제됐어요",
            withReason("「" + NotificationService.preview(target.text(), 40) + "」", why), "community", lock.postId());
        repository.resolveReports("COMMENT", id, "HIDDEN", adminId, now);
    }

    /** 운영자 댓글 (커뮤니티에 "운영자" 표시). 관리자는 동네가 없어도 돼요 */
    @Transactional
    public PostResponse.Comment adminComment(long adminId, String postId, CommunityRequests.CommentInput input) {
        long id = id(postId, "글");
        var body = validComment(input);
        long owner = repository.lockVisiblePostOwner(id).orElseThrow(() -> notFound("글"));
        var reply = replyTo(id, input);
        long commentId = repository.insertComment(id, adminId, body, reply.parentId());
        var saved = repository.visibleComment(adminId, commentId).orElseThrow();
        notifyComment(id, owner, reply, saved);
        return comment(saved, adminId);
    }

    /** 홈 "자취 꿀팁"에 보이기 · 빼기 */
    @Transactional
    public void adminHomeTip(String postId, boolean on) {
        long id = id(postId, "글");
        repository.lockVisiblePostOwner(id).orElseThrow(() -> notFound("글"));
        repository.setHomeTip(id, on);
    }

    /** 관리자 신고 관리: 신고 한 건씩 (화면에서 대상별로 묶어요). status 가 없으면 전부 */
    public List<Map<String, Object>> adminReports(String status) {
        var filter = status == null || status.isBlank() ? null : status;
        if (filter != null && !Set.of("RECEIVED", "HIDDEN", "DISMISSED").contains(filter)) throw new ApiException(400, "status 는 RECEIVED, HIDDEN, DISMISSED 중 하나예요.");
        return repository.adminReports(filter).stream().map(r -> {
            var result = new LinkedHashMap<String, Object>();
            result.put("id", Long.toString(r.id()));
            result.put("targetType", r.targetType());
            result.put("targetId", Long.toString(r.targetId()));
            result.put("postId", r.postId() == null ? null : Long.toString(r.postId()));
            var target = new LinkedHashMap<String, Object>();
            target.put(r.targetType().equals("POST") ? "title" : "text", r.targetText() == null ? "" : r.targetText());
            target.put("author", r.targetAuthor() == null ? "" : r.targetAuthor());
            target.put("deleted", r.gone());
            target.put("deleteReason", r.deleteReason());
            result.put("target", target);
            result.put("reason", r.reason());
            result.put("detail", r.detail() == null ? "" : r.detail());
            result.put("reporter", Map.of("id", Long.toString(r.reporterId()), "nickname", r.reporterNickname()));
            result.put("status", r.status());
            result.put("createdAt", r.createdAt().toString());
            return (Map<String, Object>) result;
        }).toList();
    }

    /** 대상 하나에 들어온 접수 중 신고를 한꺼번에: HIDDEN 이면 대상도 숨김, DISMISSED 는 문제없음 */
    @Transactional
    public void adminResolve(long adminId, String targetType, String targetId, String status) {
        if (!"POST".equals(targetType) && !"COMMENT".equals(targetType)) throw new ApiException(400, "targetType 은 POST 또는 COMMENT 예요.");
        resolve(adminId, new CommunityRepository.TargetRef(targetType, id(targetId, "신고 대상")), status);
    }

    /** 신고 한 건 처리 = 그 대상의 신고 전부 처리 */
    @Transactional
    public void adminResolveReport(long adminId, String reportId, String status) {
        resolve(adminId, repository.reportTargetOf(id(reportId, "신고")).orElseThrow(() -> notFound("신고")), status);
    }

    private void resolve(long adminId, CommunityRepository.TargetRef target, String status) {
        if (status == null || !RESOLUTIONS.contains(status)) throw new ApiException(400, "status 는 HIDDEN 또는 DISMISSED 예요.");
        if (status.equals("HIDDEN")) {
            // 아직 보이는 대상이면 쓴 사람에게 알리고 숨김
            repository.reportTarget(target.type(), target.id()).ifPresent(t -> notifications.send(t.authorId(), adminId, NotificationService.SYSTEM,
                "신고가 확인돼 내 " + (target.type().equals("POST") ? "글이" : "댓글이") + " 숨겨졌어요",
                "「" + NotificationService.preview(t.text(), 40) + "」", null, null));
            repository.hideTarget(target.type(), target.id(), adminId, "신고 처리로 숨김");
        }
        repository.resolveReports(target.type(), target.id(), status, adminId, clock.instant());
    }

    // ---------- 검사 ----------

    /** 글쓰기 · 댓글 · 공감: 동네가 있고, 인증한 지 30일 안이어야 해요 */
    private long requireRegion(long userId) {
        var status = regionVerify.status(userId);
        if (status.regionId() == null) throw new ApiException(403, "먼저 우리 동네를 설정해 주세요.", "REGION_REQUIRED");
        if (status.verifiedAt() == null) {
            throw new ApiException(403, "동네 인증을 해 주세요. 인증은 30일 동안 유지돼요.", "REGION_VERIFY_REQUIRED");
        }
        return status.regionId();
    }

    /** 목록 거르기: 주제(없으면 전부) · 검색어(앞뒤 공백 뺌, 40자) */
    private record Filter(String category, String keyword) {}

    private static CommunityRepository.PostSort postSort(String requested, String keyword) {
        if (requested == null) return keyword == null ? CommunityRepository.PostSort.LATEST : CommunityRepository.PostSort.RELEVANCE;
        return switch (requested) {
            case "latest" -> CommunityRepository.PostSort.LATEST;
            case "views" -> CommunityRepository.PostSort.VIEWS;
            case "popular" -> CommunityRepository.PostSort.POPULAR;
            case "relevance" -> CommunityRepository.PostSort.RELEVANCE;
            default -> throw new ApiException(400, "sort 는 latest, views, popular, relevance 중 하나예요.");
        };
    }

    private static Filter filter(String category, String q, int page) {
        var kind = category == null || category.isBlank() ? null : category;
        if (kind != null && !CATEGORIES.contains(kind)) throw new ApiException(400, "category 는 FREE, TIP, QUESTION, TOWN 중 하나예요.");
        var keyword = q == null || q.isBlank() ? null : q.trim();
        if (keyword != null && keyword.length() > KEYWORD_MAX) throw new ApiException(400, "검색어는 40자 이내로 입력해 주세요.");
        if (page < 0 || page > 10_000) throw new ApiException(400, "page 를 확인해 주세요.");
        return new Filter(kind, keyword);
    }

    private static void requireOwner(long ownerId, long userId, String what) {
        if (ownerId != userId) throw new ApiException(403, "내가 쓴 " + what + "만 고치거나 지울 수 있어요.");
    }

    private record PostValues(String category, String title, String body) {}

    private static PostValues validPost(CommunityRequests.PostInput input) {
        if (input == null) throw new ApiException(400, "글 내용을 보내 주세요.");
        if (input.category() == null || !CATEGORIES.contains(input.category())) throw new ApiException(400, "글 주제를 골라 주세요.");
        var title = input.title() == null ? "" : input.title().strip();
        if (title.isEmpty() || title.length() > TITLE_MAX || title.contains("\n") || CONTROL.matcher(title).find()) {
            throw new ApiException(400, "제목은 " + TITLE_MAX + "자 이내 한 줄로 입력해 주세요.");
        }
        var body = input.body() == null ? "" : input.body().strip();
        if (body.isEmpty() || body.length() > BODY_MAX || CONTROL.matcher(body).find()) {
            throw new ApiException(400, "내용은 " + BODY_MAX + "자 이내로 입력해 주세요.");
        }
        return new PostValues(input.category(), title, body);
    }

    /** 운영자 삭제 사유: 없으면 null, 있으면 200자 이내 */
    private static String deleteReason(String reason) {
        if (reason == null || reason.isBlank()) return null;
        var why = reason.strip();
        if (why.length() > 200 || CONTROL.matcher(why).find()) throw new ApiException(400, "삭제 사유는 200자 이내로 입력해 주세요.");
        return why;
    }

    /** 답글이면 붙일 부모 댓글 번호와 답글을 받은 댓글의 작성자 (새 댓글이면 둘 다 null) */
    private record ReplyTo(Long parentId, Long repliedAuthorId) {}

    private static final ReplyTo NEW_COMMENT = new ReplyTo(null, null);

    /** 같은 글의 보이는 댓글이어야 하고, 답글에 단 답글은 그 묶음의 맨 위 댓글로 (한 단계만) */
    private ReplyTo replyTo(long postId, CommunityRequests.CommentInput input) {
        if (input == null || input.parentId() == null || input.parentId().isBlank()) return NEW_COMMENT;
        long parentId = id(input.parentId(), "답글을 달 댓글");
        var target = repository.replyTarget(parentId).orElseThrow(() -> notFound("답글을 달 댓글"));
        if (target.postId() != postId) throw new ApiException(400, "같은 글의 댓글에만 답글을 달 수 있어요.");
        return new ReplyTo(target.parentId() == null ? parentId : target.parentId(), target.authorId());
    }

    /** 댓글 알림: 답글이면 답글을 받은 댓글 작성자에게, 그리고 글쓴이에게 (같은 사람이면 답글 알림 하나만, 내가 쓴 건 안 알림) */
    private void notifyComment(long postId, long postOwner, ReplyTo reply, CommunityRepository.CommentRow c) {
        var text = (c.staff() ? "운영자" : c.nickname()) + ": " + NotificationService.preview(c.body(), 40);
        if (reply.repliedAuthorId() != null) {
            notifications.send(reply.repliedAuthorId(), c.userId(), NotificationService.COMMUNITY, "내 댓글에 답글이 달렸어요", text, "community", postId);
            if (reply.repliedAuthorId() == postOwner) return;
        }
        notifications.send(postOwner, c.userId(), NotificationService.COMMUNITY,
            c.staff() ? "운영자가 내 글에 댓글을 남겼어요" : "내 글에 댓글이 달렸어요", text, "community", postId);
    }

    private static String withReason(String text, String reason) {
        return reason == null ? text : text + " · 사유: " + reason;
    }

    private static String validComment(CommunityRequests.CommentInput input) {
        var body = input == null || input.body() == null ? "" : input.body().strip();
        if (body.isEmpty() || body.length() > COMMENT_MAX || CONTROL.matcher(body).find()) {
            throw new ApiException(400, "댓글은 " + COMMENT_MAX + "자 이내로 입력해 주세요.");
        }
        return body;
    }

    /** 첨부: 최대 5개 · 합계 2MB · 사진 · 내가 올린 파일 · 다른 글이나 프로필 사진에 쓰이지 않은 파일 */
    private List<Long> validAttachments(long userId, List<String> raw, Long postId) {
        if (raw == null || raw.isEmpty()) return List.of();
        if (raw.size() > ATTACHMENT_MAX) throw new ApiException(400, "첨부 파일은 최대 " + ATTACHMENT_MAX + "개까지 올릴 수 있어요.");
        var ids = new LinkedHashSet<Long>();
        for (var value : raw) ids.add(id(value, "첨부 파일"));
        if (ids.size() != raw.size()) throw new ApiException(400, "같은 파일을 두 번 붙일 수 없어요.");
        var found = repository.files(new ArrayList<>(ids));
        long total = 0;
        for (long fileId : ids) {
            var file = found.stream().filter(f -> f.id() == fileId).findFirst()
                .filter(f -> f.userId() == userId && !f.deleted())
                .orElseThrow(() -> new ApiException(400, "내가 올린 파일만 붙일 수 있어요."));
            if (file.type() == null || !file.type().startsWith("image/")) throw new ApiException(400, "사진만 붙일 수 있어요.");
            total += file.size();
        }
        if (repository.filesInUse(List.copyOf(ids), postId)) throw new ApiException(400, "다른 곳에 쓰인 파일은 붙일 수 없어요. 다시 올려 주세요.");
        if (total > ATTACHMENT_BYTES_MAX) throw new ApiException(400, "첨부 파일은 합계 2MB 이하여야 해요.");
        return List.copyOf(ids);
    }

    private static long id(String value, String what) {
        if (value == null || !ID.matcher(value).matches()) throw notFound(what);
        return Long.parseLong(value);
    }

    private static ApiException notFound(String what) {
        return new ApiException(404, what + "을(를) 찾을 수 없어요.");
    }

    private static String cut(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max);
    }

    // ---------- 응답 모양 (frontend/API.md 7장) ----------

    private static PostResponse postSummary(CommunityRepository.PostRow row, long viewerId) {
        return post(row, viewerId, null, null);
    }

    private static PostResponse post(CommunityRepository.PostRow row, long viewerId,
        List<CommunityRepository.CommentRow> comments, List<CommunityRepository.AttachmentRow> attachments) {
        var region = new PostResponse.Region(Long.toString(row.regionId()), row.regionName());
        var author = new PostResponse.Author(Long.toString(row.userId()), row.nickname());
        String createdAt = row.createdAt().toString();
        String updatedAt = row.updatedAt() == null ? createdAt : row.updatedAt().toString();
        var attachmentResponses = attachments == null ? null : attachments.stream()
            .map(a -> new PostResponse.Attachment(Long.toString(a.fileId()), a.name(), a.type(), a.size(), a.url())).toList();
        var commentResponses = comments == null ? null : comments.stream().map(c -> comment(c, viewerId)).toList();
        return new PostResponse(Long.toString(row.id()), region, row.category(), row.title(), row.body(), author,
            row.userId() == viewerId, createdAt, updatedAt, row.likes(), row.liked(), row.reported(), row.comments(),
            row.views(), row.homeTip(), attachmentResponses, commentResponses);
    }

    private static PostResponse.Comment comment(CommunityRepository.CommentRow row, long viewerId) {
        var author = new PostResponse.Author(Long.toString(row.userId()), row.nickname());
        String parentId = row.parentId() == null ? null : Long.toString(row.parentId());
        return new PostResponse.Comment(Long.toString(row.id()), author, row.body(), row.userId() == viewerId,
            row.reported(), row.staff(), parentId, row.createdAt().toString());
    }
}
