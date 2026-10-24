/** 프로필 꾸미기. 우선순위: 올린 사진(avatarImg) → 고른 캐릭터(avatarEmoji) → 이름 첫 글자.
 * 닉네임은 로그인 정보(auth)에 있음. 서버가 생기면 users 의 bio · 프로필 사진 파일로 옮김 (frontend/API.md) */
export type ProfileLook = {
  /** 정사각형으로 잘라 240px 로 줄인 사진 (data URL) */
  avatarImg: string
  avatarEmoji: string
  /** 캐릭터·첫 글자 뒤 배경 색. '' 이면 기본 파란 그라데이션 */
  avatarColor: string
  /** 한 줄 소개 */
  bio: string
}
