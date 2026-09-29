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
    .replace(/[元克张把盒支本个种枚颗]$/u, '');
}

// 按课程单独配置，不改第二课的题目版本和历史记录。
const sets = {
  1: { version: VERSION, title: '先唤醒第一课的方法', questions },
  4: { version: 'factors-v1', title: '先回顾：因数、质数与质因数分解', questions: [
    { level: '基础 · 成对找因数', kind: 'number',
      question: '手工课有28颗珠子，要平均装进若干袋，每袋颗数相同，并且全部装完、没有剩余。每袋可以装1颗，也可以装全部28颗。每袋的颗数一共有多少种不同的选择？只填种数。',
      answer: '6', hint: '从1开始找乘积为28的数对，每一对中的两个数都对应一种每袋颗数，注意不要重复。',
      explain: '把28配成1×28、2×14、4×7。3不能整除28；继续试到7×4时已重复。每袋可以装1、2、4、7、14、28颗，共6种。这些能把28整除的正整数就是28的因数。可追问：每袋装4颗时有几袋？为什么每袋装3颗不行？' },
    { level: '进阶 · 判断质数', kind: 'reason',
      question: '小雨说：“21是奇数，不能被2整除，所以21一定是质数。”这个判断正确吗？请说明理由，可以写出一个乘积为21的算式来支持你的判断。',
      answer: 'no', hint: '质数的条件是只有两个正因数。不能被2整除以后，还能不能被其他大于1的整数整除？',
      explain: '判断不正确。21＝3×7，除了1和21，还有3和7这两个因数，因此21是合数。奇数只表示不能被2整除，并不表示不能被其他数整除。可让学生对比7和21，再回忆1只有一个正因数，既不是质数也不是合数。理由由老师查看，系统仅校验判断选项。' },
    { level: '挑战 · 筛选与分解', kind: 'number',
      question: '老师有90枚徽章，准备平均装袋，全部装完且没有剩余。每袋至少装6枚、最多装18枚。每袋的枚数分解质因数后，恰好写成3个质数相乘，相同的质数要重复计数。每袋应该装多少枚？只填枚数。',
      answer: '18', hint: '先找出6到18之间能整除90的数，再把每个候选数一直拆到全部是质数，数一数相乘的质数有几个。',
      explain: '先找范围内90的因数：6、9、10、15、18。逐个拆解：6＝2×3，9＝3×3，10＝2×5，15＝3×5，18＝2×3×3。只有18恰好是3个质数相乘，所以每袋18枚。检查：90÷18＝5袋，没有剩余，18也符合数量范围。讲评时先让学生解释为何9中的两个3要分别计数，再说明为何不能停在18＝2×9。' }
  ] }
};
function forLesson(lesson) { return sets[lesson]; }

function matches(index, answer, lesson = 1) {
  const question = forLesson(lesson)?.questions[index];
  if (!question) return false;
  if (question.kind === 'reason') return String(answer).trim().toLowerCase() === question.answer;
  const submitted = normalizeNumber(answer);
  return submitted !== '' && Number.isFinite(Number(submitted)) && Number(submitted) === Number(question.answer);
}

function lessonWarmup(teacher = false, lesson = 1) {
  const set = forLesson(lesson);
  if (!set) return undefined;
  return {
    version: set.version,
    title: set.title,
    questions: set.questions.map(question => {
      if (teacher) return { ...question };
      const { answer, explain, ...safe } = question;
      return safe;
    })
  };
}

module.exports = { VERSION, questions, matches, lessonWarmup, forLesson };
