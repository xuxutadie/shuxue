const VERSION = 'v1';

// 第二课课前回顾只复习第一课的方法。标准答案仅由服务端校验，学生接口不会返回。
const questions = [
  {
    level: '基础计算',
    kind: 'number',
    question: '同样的盒彩笔和尺子单价不变。3盒彩笔和2把尺子共28元，3盒彩笔和5把尺子共40元。每把尺子多少元？',
    answer: '4',
    hint: '先比较两次购买中，哪一种物品数量完全相同。',
    explain: '两组都含3盒彩笔，相减后得到3把尺子共12元，所以每把尺子4元。'
  },
  {
    level: '判断说明',
    kind: 'reason',
    question: '2个文具盒和3支钢笔共31元，4个文具盒和5支钢笔共57元。小明将两组条件对应相减，写成“2个文具盒和2支钢笔共26元”。他的这一步正确吗？请说明理由。',
    answer: 'yes',
    hint: '检查物品数量和总价是不是都按同样的顺序相减。',
    explain: '这一步正确。两组条件对应相减后，物品数量与总价同时相减，整体关系仍然成立；但仅凭这一条关系还不能分别求出两种单价。'
  },
  {
    level: '整体探究',
    kind: 'number',
    question: '3张成人票和2张儿童票共110元，2张成人票和3张儿童票共90元。不分别求两种票的单价，1张成人票和1张儿童票共多少元？',
    answer: '40',
    hint: '观察两组条件相加后，成人票和儿童票的数量有什么共同特点。',
    explain: '两组条件相加得到5张成人票和5张儿童票共200元，也就是5组“1张成人票和1张儿童票”共200元，所以每组40元。'
  }
];

function normalizeNumber(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s/g, '')
    .replace(/[元克张把盒支本个]$/u, '');
}

function matches(index, answer) {
  const question = questions[index];
  if (!question) return false;
  if (question.kind === 'reason') return String(answer).trim().toLowerCase() === question.answer;
  const submitted = normalizeNumber(answer);
  return submitted !== '' && Number.isFinite(Number(submitted)) && Number(submitted) === Number(question.answer);
}

function lessonWarmup(teacher = false) {
  return {
    version: VERSION,
    questions: questions.map(question => {
      if (teacher) return { ...question };
      const { answer, explain, ...safe } = question;
      return safe;
    })
  };
}

module.exports = { VERSION, questions, matches, lessonWarmup };
