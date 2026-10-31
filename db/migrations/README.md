# 2026-10-31 변경 적용

대상은 기존 schema.sql의 35개 테이블 설계입니다. 새 DB는 ../schema.sql만 실행합니다. 수정된 React 코드나 브라우저 localStorage를 이 SQL이 가져오지는 않습니다.

1. 기존 DB를 백업하고 애플리케이션의 쓰기를 중단합니다.
2. MySQL 8.0.16 이상인지, 기존 테이블·컬럼이 35개 표 버전인지 확인합니다. 이미 일부 변경을 적용했다면 파일을 그대로 재실행하지 않습니다.
3. 프로젝트 루트에서 다음 명령을 한 번 실행합니다.

```powershell
mysql -u root -p --default-character-set=utf8mb4 --execute="source db/migrations/20261031_current_project.sql"
```

4. todos_legacy_20261031의 행 수와 이전된 events를 비교합니다. 이전 ID는 적용 직전 events의 최대 ID + 원본 todos.id입니다. 생성 날짜를 일정 날짜로 사용하며 기존 일정·완료 시각을 덮어쓰지 않습니다. 보관 표는 자동 삭제하지 않습니다.
5. 기존 수입은 월급·이자·연금·임대 수입·기타 고정 수입을 FIXED, 나머지를 OTHER로 분류했습니다. 실제 기록을 표본 확인하세요.
6. 기존 고정 지출은 공과금 태그로 유지합니다. 개인 설정의 JSON과 프로필은 기존 값이 없으므로 NULL/기본값을 API에서 처리합니다.
7. 기존 제재의 재가입 차단 해시는 서버의 HMAC 키로 별도 채워야 합니다. 해당 작업 전 회원 삭제를 허용하지 않습니다.
8. 새 기능 API의 소유권 검사·정지 해제·카테고리 삭제 시 항목 이동 등을 구현한 뒤 서비스를 재개합니다.

MySQL DDL은 암묵 커밋됩니다. 중간 실패 시 백업과 실제 스키마를 확인하고 실패 지점부터 복구해야 합니다. 이 파일은 재실행용·자동 롤백용이 아닙니다. 이전 할 일 ID를 참조하는 외부 시스템이 있다면 위 ID 변환을 함께 적용해야 합니다.

# 2026-11-01 기념일 칸 추가

`20261101_event_anniversary.sql`은 `events`에 `is_anniv` · `is_yearly`를 추가합니다. 20261031 마이그레이션을 적용한 DB에서 백업 후 한 번만 실행합니다. 새 DB는 ../schema.sql에 이미 포함되어 있어 실행하지 않습니다.

```powershell
mysql -u root -p --default-character-set=utf8mb4 --execute="source db/migrations/20261101_event_anniversary.sql"
```
