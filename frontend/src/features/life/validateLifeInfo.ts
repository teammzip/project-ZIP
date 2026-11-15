type LifeInfoDraft = {
  homeAddress: string
  rentDay: string
  rent: string
  deposit: string
  mgmtFee: string
  moveIn: string
  contractEnd: string
  contractFee: string
}

/** 저장 작업을 시작하기 전에 현재 계약 유형에서 사용하는 입력만 검증한다. */
export function validateLifeInfo(form: LifeInfoDraft, monthly: boolean, mgmtIncluded: boolean, showHomeAddress: boolean) {
  const amount = (value: string, label: string, max: number) => {
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > max) {
      throw new Error(`${label}을 0~${max.toLocaleString('ko-KR')}원 사이의 정수로 입력해 주세요.`)
    }
  }
  if (showHomeAddress && form.homeAddress.trim().length > 200) throw new Error('내 집 주소는 200자 이내로 입력해 주세요.')
  for (const [value, label] of [[form.moveIn, '입주월'], [form.contractEnd, '계약 종료월']]) {
    if (value && !/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw new Error(`${label}을 올바른 연월로 입력해 주세요.`)
  }
  if (form.moveIn && form.contractEnd && form.contractEnd < form.moveIn) throw new Error('계약 종료월은 입주월보다 빠를 수 없어요.')
  if (monthly) {
    amount(form.deposit, '보증금', 9999990000)
    amount(form.rent, '월세', 99990000)
    if (!/^\d+$/.test(form.rentDay) || Number(form.rentDay) < 1 || Number(form.rentDay) > 31) throw new Error('월세 납부일은 1~31 사이의 정수로 입력해 주세요.')
  } else {
    amount(form.contractFee, '전세 계약금', 9999990000)
  }
  if (!monthly || !mgmtIncluded) amount(form.mgmtFee, '관리비', 9990000)
  return { moveIn: form.moveIn, contractEnd: form.contractEnd }
}
