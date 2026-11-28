package com.zip.backend.memo;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface MemoFolderRepository extends JpaRepository<MemoFolder, Long> {
    List<MemoFolder> findByUserIdOrderByIdAsc(long userId);
    boolean existsByIdAndUserId(long id, long userId);

    @Modifying
    @Query("update MemoFolder f set f.name = :name where f.id = :id and f.userId = :userId")
    int rename(@Param("userId") long userId, @Param("id") long id, @Param("name") String name);

    @Modifying
    @Query("delete from MemoFolder f where f.id = :id and f.userId = :userId")
    int deleteOwned(@Param("userId") long userId, @Param("id") long id);
}
