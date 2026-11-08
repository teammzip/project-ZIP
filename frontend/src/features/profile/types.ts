/** 프로필 꾸미기. 우선순위: 올린 사진(avatarImg) → 고른 캐릭터(avatarEmoji) → 이름 첫 글자.
 * 실제 API 모드에서는 user_profiles · uploaded_files 조회 응답을 표시한다. */
export type ProfileLook = {
  /** 편집 중인 JPEG data URL 또는 서버가 반환한 사진 URL */
  avatarImg: string
  avatarEmoji: string
  /** 캐릭터·첫 글자 뒤 배경 색. '' 이면 기본 파란 그라데이션 */
  avatarColor: string
  /** 한 줄 소개 */
  bio: string
}
