import { useProfile } from '@/app/useProfile'
import { AiAssistant } from '@/features/ai'

/* 사진: 사진을 찍거나 골라서 분리배출·요리·곰팡이 등을 물어봄 (사진이 없으면 사진 고르기부터) */
export function PhotoPage() {
  const { name, region } = useProfile()
  return <AiAssistant name={name} region={region} photoFirst />
}
