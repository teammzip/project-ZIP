package com.zip.backend.memo;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "memo_folders")
public class MemoFolder {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private long userId;

    @Column(nullable = false, length = 40)
    private String name;

    protected MemoFolder() {}

    MemoFolder(long userId, String name) {
        this.userId = userId;
        this.name = name;
    }

    long id() { return id; }
    String name() { return name; }
}
