/** 사진 가운데를 정사각형으로 잘라 size px 로 줄인 JPEG data URL (브라우저 저장 공간을 아끼려고) */
export function resizeToSquare(file: File, size = 240): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const side = Math.min(img.width, img.height)
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = size
      canvas.getContext('2d')?.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('사진을 열 수 없어요. 다른 사진을 골라 주세요.'))
    }
    img.src = url
  })
}
