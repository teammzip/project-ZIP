package com.zip.backend.calendar;

import com.fasterxml.jackson.annotation.JsonInclude;

public record CalendarEventResponse(
    String id,
    String date,
    String time,
    String title,
    @JsonInclude(JsonInclude.Include.ALWAYS) String category,
    boolean done,
    String source,
    boolean anniv,
    boolean yearly
) {}
