import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const exports = {}
const source = readFileSync(new URL('../src/features/ai/topics.ts', import.meta.url), 'utf8')
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports, require: () => ({}) })

const { chatMessageText, getTopicSuggestion, topicById, usesAiReply } = exports
const ctx = { region: '성수동', name: '세입자', hasPhoto: false }

test('선택 주제와 별개로 입력한 키워드만 메시지에 사용한다', () => {
  const topic = topicById('landlord')
  const text = chatMessageText(topic, '  보일러 고장  ')
  assert.equal(text, '보일러 고장')
  assert.match(topic.reply(text, ctx), /보일러 고장/)
})

test('빈 키워드는 보내지 않고 쉼표로 입력한 재료와 조건은 그대로 보낸다', () => {
  assert.equal(chatMessageText(topicById('trash'), '   '), '')
  assert.equal(chatMessageText(topicById('cook'), '두부, 달걀, 15분'), '두부, 달걀, 15분')
})

test('지출 요약은 주제명으로 요청하고 자유 질문은 입력을 그대로 사용한다', () => {
  assert.equal(chatMessageText(topicById('summary'), ''), '수입·지출 요약')
  assert.equal(chatMessageText(null, '  전기요금이 궁금해요  '), '전기요금이 궁금해요')
})

test('관련성이 낮은 주제 대신 원래 키워드를 담은 추천 주제를 반환한다', () => {
  const result = getTopicSuggestion(topicById('cook'), '치킨 뼈')
  assert.match(result.text, /냉장고 요리.*잘 맞지 않아요/)
  assert.match(result.text, /분리배출/)
  assert.equal(result.suggestion.topicId, 'trash')
  assert.equal(result.suggestion.keyword, '치킨 뼈')
  assert.equal(getTopicSuggestion(topicById('trash'), '이번 달 지출 요약').suggestion.topicId, 'summary')
})

test('현재 주제, 자유 질문, 판단이 모호한 입력에 주제 변경을 권하지 않는다', () => {
  assert.equal(getTopicSuggestion(topicById('cook'), '두부, 달걀, 15분'), null)
  assert.equal(getTopicSuggestion(topicById('qna'), '보일러 고장'), null)
  assert.equal(getTopicSuggestion(topicById('bill'), '곰팡이 때문에 집주인에게 보낼 문자'), null)
  assert.equal(getTopicSuggestion(topicById('cook'), '냄비'), null)
})

test('사용 방법은 메시지 입력이 없고 추천 답변에서 기능 선택을 안내한다', () => {
  const topic = topicById('guide')
  assert.equal(topic.input, undefined)
  assert.equal(chatMessageText(topic, '일정'), '')
  assert.equal(usesAiReply(topic), false)
  const result = getTopicSuggestion(topicById('cook'), '일정은 어디서 등록해요')
  assert.equal(result.suggestion.topicId, topic.id)
  assert.match(result.text, /‘사용 방법’ 칩을 눌러 찾는 기능을 선택/)
})
