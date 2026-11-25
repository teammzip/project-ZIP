package com.zip.backend.community;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

public record PostResponse(
    String id,
    Region region,
    String category,
    String title,
    String body,
    Author author,
    boolean mine,
    String createdAt,
    String updatedAt,
    int likes,
    boolean liked,
    boolean reported,
    int commentCount,
    long views,
    boolean homeTip,
    @JsonInclude(JsonInclude.Include.NON_NULL) List<Attachment> attachments,
    @JsonInclude(JsonInclude.Include.NON_NULL) List<Comment> comments
) {
    public record Page(List<PostResponse> items, boolean hasNext,
        @JsonInclude(JsonInclude.Include.NON_NULL) String suggestedQuery) {
        public Page(List<PostResponse> items, boolean hasNext) { this(items, hasNext, null); }
    }

    public record Region(String id, String name) {}

    public record Author(String id, String nickname) {}

    public record Attachment(String id, String name, String type, long size, String url) {}

    public record Comment(String id, Author author, String body, boolean mine, boolean reported, boolean staff,
        @JsonInclude(JsonInclude.Include.ALWAYS) String parentId, String createdAt) {}
}
