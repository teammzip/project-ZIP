# 고정 지출 월별 조회 구현·검증 (2026-11-17)

## 구현한 동작

- 실제 API 모드의 고정 지출 화면에서 원하는 과거 월 또는 현재 월을 선택한다. 미래 월은 선택/조회하지 못한다.
- 현재 월은 지역 시간대의 1일 00:00부터 서버 조회 시각까지, 과거 월은 해당 지역의 월 전체를 청구 기간으로 표시한다.
- 미납·예정 금액도 포함한다. 실제 월별 기록이 없으면 현재 활성 항목의 기본 금액을 예정액(snapshot=false)으로 표시한다.
- 과거 월은 저장된 기록만 표시한다. 현재 금액으로 과거 월 기록을 임의 생성하지 않는다.
- 조회만으로 청구·납부 데이터를 생성하지 않는다. 납부 상태는 조회 시점 기준이며, 과거 월의 연체분을 나중에 납부했다면 그 납부 상태도 보인다.
- 현재 월을 보고 있었다면 매월 1일 최종 선택된 시간대의 00시에 새달을 조회한다. 과거 월을 직접 선택했다면 그대로 유지하고 '이번 달' 버튼으로 자동 추적에 돌아온다.
- 분 경계에 월/지역 시간대 변경을 확인하고, 절전·다른 탭에서 돌아올 때 즉시 다시 계산한다. 현재 월 데이터는 1분 간격 및 새로고침으로 갱신한다.
- 목록과 합계는 공과금·통신·구독·별도 관리비 기준이다. 월세·대출 이자는 이번 고정 지출 월별 조회의 합계에 포함하지 않는다.

## 현재 위치와 시간대

시간대 우선순위는 ① 프로젝트 등록 주소 → ② 실제 현재 위치(GPS) → ③ 기기 설정이다.

1. 실제 모드에서는 기존 GET /api/me/settings로 DB의 내 집 주소를 먼저 확인한다. 집 주소가 비어 있으면 본인 설문 주소, 가입 주소 순으로 등록 주소를 찾는다. 다른 회원의 주소·좌표는 사용하지 않는다.
2. 등록 주소의 시간대를 확인하면 GPS를 요청하지 않는다. 국내 주소는 Asia/Seoul로 처리하고 상세주소를 외부 서비스에 보내지 않는다. 해외 주소는 본인 주소에 연결된 좌표를 우선 사용하고, 없으면 Nominatim으로 주소를 확인한다. 좌표 시간대는 Open-Meteo timezone=auto 응답으로 확인한다.
3. 주소가 없거나 확인에 실패하면 브라우저 위치 권한으로 실제 좌표를 요청한다. 저장된 과거 동네 인증 좌표를 현재 위치로 대신하지 않는다.
4. GPS 권한 거부·시간 초과·시간대 조회 실패 시 기기 시간대를 사용한다. 기기 시간대도 확인할 수 없으면 UTC를 사용한다.
5. 시간대 결정 중에는 월별 조회를 기다린다. 주소·계정 변경으로 이전 요청이 중단되면 오래된 결과를 적용하지 않는다. 화면에 등록 주소/현재 위치/기기 설정 중 선택된 기준을 표시한다.

해외 주소 확인에는 주소가 Nominatim에, 좌표 시간대 확인에는 좌표가 Open-Meteo에 전송된다. 성공 결과는 현재 탭 메모리에 최대 100개·24시간 캐시하며 별도 localStorage에는 보관하지 않는다.
외부 서비스 실패는 다음 우선순위로 이어지고 GPS 권한 거부 때문에 월별 조회 전체가 막히지는 않는다.
현재 시각 자체는 서버 Clock을 사용하며 서버가 선택된 시간대로 기간을 계산한다. 일광절약시간(DST)도 처리한다.

공식 참고: [Open-Meteo 시간대](https://open-meteo.com/en/docs), [Nominatim 주소 검색](https://nominatim.org/release-docs/latest/api/Search/).

| 같은 서버 순간 | 최종 시간대가 서울 | 최종 시간대가 뉴욕 |
| --- | --- | --- |
| 2026-04-30 15:00 UTC | 2026-05-01 00:00 → 5월 | 2026-04-30 11:00 → 4월 |
| 2026-05-01 04:00 UTC | 2026-05-01 13:00 → 5월 | 2026-05-01 00:00 → 5월 |

예: 등록 주소가 서울이면 현재 GPS/기기가 뉴욕이어도 서울 시간대가 우선이다. 서울 시간 5월 1일 00시에 5월로 바뀌고 조회 시점까지의 정보와 미납·예정을 표시한다.
현재 시간까지의 기준은 화면에 표시된 '조회 시각'이며 실시간 스트리밍은 아니다.

## API

GET /api/bills/monthly?month=2026-05&timeZone=Asia%2FSeoul

응답 예 (서버 현재 시각이 2026-05-01 10:30 서울인 경우):

```json
{
  "month": "2026-05",
  "currentMonth": "2026-05",
  "timeZone": "Asia/Seoul",
  "periodFrom": "2026-05-01T00:00+09:00",
  "periodThrough": "2026-05-01T10:30+09:00",
  "queriedAt": "2026-05-01T10:30+09:00",
  "items": [
    {
      "id": "42", "name": "전기", "tag": "공과금", "month": "2026-05",
      "amount": 40000, "defaultAmount": 40000, "paid": false, "paidAt": null,
      "active": true, "snapshot": false
    }
  ]
}
```

잘못된 연월·시간대·해당 지역의 미래 월은 400, 미로그인은 401이다.
기존 GET /api/bills의 응답과 정책은 유지한다. 기존 등록·납부 API의 현재 월 기준은 아직 한국 시간이며, 다음 쓰기 기능 연결 시 지역 시간대 정책을 함께 맞춰야 한다.

## 1. 테스트

```powershell
Push-Location frontend
node --test tests/*.test.mjs
npm run build
npm run lint
Pop-Location
Push-Location backend
.\gradlew.bat test --tests com.zip.backend.BillMonthlyTests --tests com.zip.backend.BillIntegrationTests
Pop-Location
```

검증: 프론트 전체 90개 통과. 빌드·린트 통과. 백엔드 월별 조회 16개 통과 결과는 이번 시간대 우선순위 변경 전과 동일한 서버 코드의 결과다.
4월→5월·12월→1월, 지역 시간대 차이, DST, 분 경계 타이머, 절전 복귀, 과거 선택 유지,
미래 월 차단, 미납·예정 합계, 조회 오류/빈 목록, 회원별 조회를 검사했다.
실제 기기 날짜를 과거로 바꾸면 JWT 인증에 영향을 주므로 월 전환은 자동 테스트의 고정 시계로 검증한다.

## 2. DB

스키마 변경이나 새 마이그레이션은 없다. 기존 bill_items·bill_payments를 읽는다.
실제 MySQL에서 임시 검증 회원/항목을 트랜잭션으로 만들어 지역별 월 조회와 4월 30,000원/5월 예정 40,000원,
조회 후 납부 행 개수 불변을 확인했다. 검증용 데이터는 모두 롤백했다.
우선순위 변경 후에는 기존 settings 조회 서비스가 DB의 등록 집 주소를 복원하는 것도 실제 MySQL에서 함께 확인했다. 테이블 변경은 없다.

화면에서 조회하는 실제 회원으로 다음을 비교한다:

```sql
SELECT DATABASE();
SET @monthly_user_id = NULL; -- 검증 회원 ID로 변경
SET @monthly_period = '2026-11'; -- 화면 선택 월
SELECT b.id,b.name,b.tag,b.default_amount,b.is_active,b.created_at,
       p.period_ym,p.amount,p.paid_at
FROM bill_items b
LEFT JOIN bill_payments p ON p.bill_item_id=b.id AND p.period_ym=@monthly_period
WHERE b.user_id=@monthly_user_id ORDER BY b.id;
SELECT COUNT(*) FROM bill_payments p
JOIN bill_items b ON b.id=p.bill_item_id
WHERE b.user_id=@monthly_user_id;
```

현재 월의 활성 항목에 p가 없으면 예정액으로 볼 수 있다. 과거 월은 p가 있는 항목만 표시한다.
조회 전후 bill_payments 행 개수가 같아야 한다. 다른 회원의 데이터는 조회되지 않아야 한다.

## 3. 프론트 직접 확인

백엔드를 재시작하고 frontend에서 npm run dev. 실제 모드 VITE_USE_MOCK=false로 로그인한다.
http://127.0.0.1:3000/my/budget/expense 에서 확인:

1. 기본 선택이 등록 주소의 현재 월인지, 화면 기준이 등록 주소인지 확인.
2. 과거 월 선택 → 해당 월 기록만 표시, 다시 이번 달 → 미납·예정 포함.
3. Network의 /api/me/settings에 DB의 등록 주소, /api/bills/monthly에 선택 month와 최종 timeZone이 전달되는지 확인.
4. 현재 월 청구 기간 끝과 조회 시각이 서버 응답과 같은지 확인.
5. 새로고침 → 조회 시각 갱신, 과거 금액 불변 확인.
6. 서버 연결 실패 → 오류·다시 조회 표시, 다른 월 기록이 선택 월로 표시되지 않는지 확인.
7. 등록 주소가 서울인 계정에서 브라우저 기기 시간대를 뉴욕으로 바꿔도 등록 주소·Asia/Seoul이 유지되는지 확인.
   주소 없는 검증 계정은 GPS 허용 시 현재 위치, 거부 시 기기 설정으로 표시되는지 확인한다. 자동 테스트에서도 이 경로를 검증한다.
8. 월 경계의 정확한 동작은 위 자동 테스트로 확인. 실제 1일에는 현재 월 추적 중 새달로 전환되는지 확인.

이번 단계는 서버 월별 조회 화면이다. 등록·수정·해지·납부 변경 버튼은 다음 단계에서 서버에 연결한다.
데모 모드는 기존 로컬 화면을 유지한다. 실제 제공자 로그인/브라우저 수동 검증은 자동 테스트와 별도로 진행한다.

## 변경 파일

- backend/.../bills/BillController.java, BillService.java: 지역별 월별 조회 API.
- backend/.../BillMonthlyTests.java: 월 경계·범위·데이터 격리 DB 테스트.
- frontend/src/features/life/billsApi.ts: 서버 응답 타입과 조회 요청.
- monthlyPeriod.ts, useLocalMonth.ts: 선택된 시간대·월 경계·복귀 처리.
- billingTimeZone.ts, billingTimeZoneApi.ts, useBillingTimeZone.ts: 등록 주소 → 실제 위치 → 기기 우선순위와 DB 주소 복원.
- components/MonthlyFixedExpense.tsx: 월 선택·기간·목록·합계·오류.
- components/FixedExpense.tsx: 실제 API 모드의 조회 화면 연결.

## 4. Git 공유 (현재 브랜치 유지)

```powershell
git status --short
git diff --check
git add backend/src/main/java/com/zip/backend/bills/BillController.java backend/src/main/java/com/zip/backend/bills/BillService.java backend/src/test/java/com/zip/backend/BillMonthlyTests.java frontend/src/features/life/billsApi.ts frontend/src/features/life/monthlyPeriod.ts frontend/src/features/life/useLocalMonth.ts frontend/src/features/life/components/MonthlyFixedExpense.tsx frontend/src/features/life/components/FixedExpense.tsx frontend/src/features/life/components/life.module.css frontend/tests/monthly-period.test.mjs frontend/tests/monthly-bills-view.test.mjs frontend/tests/housing-contract.test.mjs MONTHLY_BILLS_VERIFICATION.md frontend/API.md backend/README.md
git add frontend/src/features/life/billingTimeZone.ts frontend/src/features/life/billingTimeZoneApi.ts frontend/src/features/life/useBillingTimeZone.ts frontend/tests/billing-timezone.test.mjs
git diff --cached
git commit -m "feat: 지역 시간대 기반 고정 지출 월별 조회"
git push origin backend
```

기존 미추적 FIXED_EXPENSE_IMPLEMENTATION_GUIDE.md는 위 커밋 목록에 포함하지 않았다. 필요 시 별도 확인 후 추가한다.

