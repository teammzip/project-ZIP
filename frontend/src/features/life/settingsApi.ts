import { apiClient } from '@/lib/apiClient'

/* 생활 설정 서버 저장 (GET · PUT /api/me/settings).
 * 서버 알림(월세 알림 · 공지 팝업 · 알림 목록)은 DB 의 noti_on 을 보므로, "알림 받기"를 바꾸면 서버에도 저장해야
 * 다른 기기와 서버 알림이 같은 설정을 써요. 내 집 정보 응답의 settings.notiOn 으로 앱을 열 때 복원해요. */

type ServerSettings = { rent: number; rentDay: number; moveIn: string; contractEnd: string; notiOn: boolean }

/**
 * 알림 받기만 바꿔 저장. PUT 은 월세 · 납부일 · 입주월 · 계약 종료월도 필수라서, 화면에 있던 값 대신
 * 방금 받은 서버 값을 그대로 다시 보내요 (내 집 정보에서 바꾼 최신 값을 덮어쓰지 않게).
 * 동네 · 주소 칸은 보내지 않아서 서버가 기존 동네 · 인증 위치를 그대로 둬요. 저장된 notiOn 을 돌려줘요.
 */
export async function saveNotiOn(on: boolean): Promise<boolean> {
  const { data } = await apiClient.get<ServerSettings>('/me/settings')
  const { data: saved } = await apiClient.put<ServerSettings>('/me/settings', {
    rent: data.rent, rentDay: data.rentDay, moveIn: data.moveIn, contractEnd: data.contractEnd, notiOn: on,
  })
  return saved.notiOn
}
