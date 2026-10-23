/* 첨부 파일 규칙과 읽기 (백엔드 담당 시안과 같은 기준: 최대 5개, 합계 2MB) */
import type { Attachment } from './types'

export const MAX_ATTACHMENTS = 5
export const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024

/** 붙일 수 없으면 이유를, 괜찮으면 null */
export function checkAttachments(current: Attachment[], adding: File[]) {
  if (current.length + adding.length > MAX_ATTACHMENTS) return `첨부 파일은 최대 ${MAX_ATTACHMENTS}개까지 올릴 수 있어요.`
  const total = current.reduce((t, f) => t + f.size, 0) + adding.reduce((t, f) => t + f.size, 0)
  if (total > MAX_ATTACHMENT_BYTES) return '첨부 파일은 합계 2MB 이하여야 해요.'
  return null
}

/** 파일 → data URL (브라우저에 저장하려고) */
export const readAttachments = (files: File[]) =>
  Promise.all(
    files.map(
      (file) =>
        new Promise<Attachment>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve({ name: file.name, type: file.type, size: file.size, data: String(reader.result) })
          reader.onerror = () => reject(new Error(`파일을 읽지 못했어요: ${file.name}`))
          reader.readAsDataURL(file)
        }),
    ),
  )

export const STORAGE_FULL = '저장 공간이 부족해 저장하지 못했어요. 첨부 파일 크기를 줄이거나 예전 글을 정리해 주세요.'
