# 커뮤니티·첨부파일 DB 검증

## 범위와 준비

posts, post_likes, comments, uploaded_files, post_attachments와 프로필 사진 연결을 검증합니다. users, regions는 자체 가상 행을 사용합니다. 신고·제재는 다음 단계입니다. 실제 파일 업로드/삭제·권한·파일 내용 검증은 포함하지 않습니다. storage_url의 urn:zip-test 값은 실제 다운로드 주소가 아닙니다.

앞선 테스트 정리 후 zip_test의 새 연결에서 시작합니다. 테스트 동안 COMMIT·DDL·다른 START TRANSACTION을 실행하지 않고 같은 연결을 유지합니다. 실제 데이터가 있는 서버에서는 실행하지 않습니다.

## 정상 테스트

09_community_positive.sql 전체 실행 후 G01~G13 모두 PASS가 예상됩니다. 마지막에 ROLLBACK합니다. 중간 오류가 나면 같은 연결에서 ROLLBACK하고 첫 오류를 확인합니다.

| ID | 검증 내용 |
|---|---|
| G01~G02 | 글·회원·동네 연결, 기본값, 내용 수정 |
| G03 | 좋아요·댓글·대댓글 연결 |
| G04~G05 | 좋아요/댓글 수 자동 갱신 없음, 수동 집계 갱신 |
| G06 | 댓글 내용 수정 |
| G07 | 파일 메타데이터와 첨부 순서·총 3,072바이트 |
| G08 | 논리 삭제 시 자식 유지, 조건 조회에서 제외 |
| G09 | 부모 댓글 실제 삭제 시 대댓글 CASCADE, 카운터는 자동 감소하지 않음 |
| G10 | 파일 행 삭제 시 첨부 연결 삭제·프로필 사진 SET NULL |
| G11 | 글 실제 삭제 시 댓글·좋아요·첨부 연결 삭제, 파일 행은 보존 |
| G12 | 작성자 삭제 시 글과 타인이 남긴 관련 댓글도 삭제, 타인 본인 글은 보존 |
| G13 | 최종 테스트 데이터 제거 |

G04와 G09의 PASS는 자동 카운터 갱신이 없음을 확인하는 결과입니다. 서비스가 좋아요/댓글 변경과 카운터 갱신을 함께 처리해야 합니다. G08의 논리 삭제도 DB가 조회를 자동 제한하는 것이 아니며 API 필터가 필요합니다. G10/G11은 DB 메타데이터 동작만 검증하고 저장소 실제 파일의 삭제 여부는 검증하지 않습니다.

## 오류 테스트

10_community_negative.sql은 전체 실행하지 않습니다.

1. H00 준비 블록을 USE부터 SAVEPOINT 뒤 SELECT까지 한 번 실행합니다. member_id, post_id, file_id, region_id가 숫자인지 확인합니다.
2. H01~H09 각 문장을 선택 실행하고 아래 번호·키 이름을 확인합니다.
3. 예상 밖 성공이면 FAIL을 기록하고 `ROLLBACK TO SAVEPOINT community_negative_fixture;`로 준비 상태를 복구합니다. 다른 오류는 미확인입니다.
4. H99를 실행하고 PASS인지 확인합니다. 연결을 잃으면 새 연결에서 준비부터 다시 실행합니다.

| ID | 예상 오류 | 키·컬럼 |
|---|---|---|
| H01 | 1062 | PRIMARY (post_likes) |
| H02 | 1062 | uk_post_attachments_file_id |
| H03 | 1062 | uk_post_attachments_post_sort |
| H04 | 1452 | fk_post_likes_post_id |
| H05 | 1452 | fk_post_attachments_file_id |
| H06 | 1452 | fk_comments_parent_id |
| H07 | 1451 | fk_posts_region_id |
| H08 | 1048 | storage_url cannot be null |
| H09 | 1452 | fk_comments_post_id |

## 결과와 후속 검증

```text
MySQL 버전:
G01~G13: 각 PASS / FAIL / 미실행
H01~H09: 각 오류 번호 + 키·컬럼
H99: PASS / FAIL
최초 예상 밖 오류:
```

격리 MySQL 9.6.0 실행 결과와 사용자 보고는 RESULTS.md 및 VALIDATION_20261107.json에 있습니다. 새 환경의 실행 결과는 별도로 확인합니다. 첨부 최대 5개·합계 2MB, 파일 소유자 일치·MIME/실제 내용 검증, 비공개 다운로드, 대댓글이 부모와 같은 글인지, 작성자/관리자 권한·제재·동시성은 DB 제약만으로 보장되지 않습니다. 해당 API 테스트가 필요합니다. 결과 확인 후 신고·제재·고객센터 테스트로 진행합니다.
