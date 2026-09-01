export const meta = {
  name: 'faq-loophunt-score',
  description: 'Score the assistant local answers to the 10 questions for 答非所问',
  phases: [{ title: 'Score', detail: 'one independent judge per question' }],
}

const SCORE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    on_topic: { type: 'boolean', description: 'true if the winner is a genuinely on-topic answer' },
    defect: {
      type: 'string',
      enum: ['correct', 'wrong_substance', 'soft', 'no_answer', 'ambiguous'],
      description: 'correct=on-topic; wrong_substance=right shape, wrong chemical/experiment; soft=related but not the specific thing asked; no_answer=does not answer; ambiguous=could go either way',
    },
    verdict_text: { type: 'string', description: 'one-to-two sentence reasoning' },
    suggested_fix: { type: 'string', description: 'the concrete data/code fix that would route this to the correct topic, or "accept" if already correct' },
  },
  required: ['on_topic', 'defect', 'verdict_text', 'suggested_fix'],
}

const JUDGE = `You are judging whether a chemistry teacher assistant answered a student question OFF-TOPIC (答非所问).

The assistant runs a strict keyword+entity FAQ matcher over ~3100 entries about the synthesis of K₃[Fe(C₂O₄)₃]·3H₂O (武汉大学讲义: 5.0g 莫尔盐, 微沸4分钟, 6% H₂O₂ 8mL 滴加, 0.5mol/L 草酸, 加乙醇析晶, ≤50℃ 烘干, 100℃ 失水, 230℃ 分解, 翠绿色晶体). The matcher returned the single "best" FAQ entry title as the answer.

For the (question, expected_topic, winner) below, judge the winner's title:
- on_topic=true only if the titled FAQ entry genuinely answers WHAT WAS ASKED (right substance, right aspect, right experiment).
- wrong_substance: the shape fits but it's the wrong chemical/experiment (e.g. answered 草酸 when asked about 过氧化氢 dose).
- soft: related to the experiment but does not answer the specific thing asked (e.g. answered "为何逐滴加入" when the query was about the 6% concentration).
- no_answer: the winner does not address the question at all.
- ambiguous: legitimate borderline.

Then give a concrete suggested_fix: the KEY to add to / trim from a specific FAQ entry so the matcher routes to the correct topic, or a code fix. If already correct, suggested_fix="accept".`

phase('Score')

const records = args.records // [{q, expected_topic, winner, top:[...]}]
const scored = await parallel(records.map((r, i) => () =>
  agent(
    `${JUDGE}\n\n#${i + 1}\nQuestion: ${r.q}\nExpected correct topic: ${r.expected_topic || 'N/A'}\nAssistant's answer (matched FAQ entry): "${r.winner}"\n\nTop-ranked candidates for context:\n${(r.top || []).map(t => `  [${t.score}] ${t.title}`).join('\n')}`,
    { label: `judge:${(r.q || '').slice(0, 14)}`, phase: 'Score', schema: SCORE_SCHEMA, effort: 'medium' }
  )
))

return { scored }
