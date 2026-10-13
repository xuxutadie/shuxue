const { test } = require('node:test');
const assert = require('node:assert/strict');
const { paper, gradeReview, publicQuestions } = require('../server/review-paper.cjs');

function factors(n) {
  return Array.from({ length: n }, (_, i) => i + 1).filter(i => n % i === 0);
}
function leastCommon(a, b) {
  for (let n = 1; n <= a * b; n++) if (n % a === 0 && n % b === 0) return n;
}
function solve(first, second) {
  const matches = [];
  for (let x = 1; x <= 50; x++) for (let y = 1; y <= 50; y++) {
    if (first[0] * x + first[1] * y === first[2] && second[0] * x + second[1] * y === second[2]) matches.push([x, y]);
  }
  assert.equal(matches.length, 1, '两组条件应有唯一的正整数单价或重量');
  return matches[0];
}
function letterFor(index, matches) {
  const options = paper.questions[index].options;
  const chosen = options.filter((option, i) => matches(option.text, i)).map(option => option.value);
  assert.equal(chosen.length, 1, `${paper.questions[index].id} 单选题必须有且仅有一个正确选项`);
  return chosen[0];
}

// 用独立的枚举与时间线生成答案，再与题库答案比对；不直接复制题库答案做满分测试。
function independentlySolved() {
  const q1 = solve([2, 3, 18], [2, 5, 26]);
  const q17 = solve([2, 1, 21], [2, 3, 39]);
  const q18 = solve([3, 2, 41], [2, 3, 39]);
  const q23 = solve([2, 3, 33], [2, 5, 47]);
  const q24 = solve([2, 1, 19], [1, 2, 17]);
  const result = [
    letterFor(0, text => Number.parseInt(text) === q1[1]),
    letterFor(1, text => Number.parseInt(text) === 16 * 3),
    letterFor(2, text => text === ['星星', '月亮', '云朵', '太阳'][(19 - 1) % 4]),
    letterFor(3, text => 30 % Number(text) !== 0),
    letterFor(4, text => factors(Number(text)).length === 2),
    letterFor(5, text => Number(text) === Math.max(...factors(20).filter(n => 30 % n === 0))),
    paper.questions[6].options.filter(option => {
      const [big, small, weight] = option.text.match(/\d+/g).map(Number);
      return big / 2 === small / 3 && small / 3 === weight / 24;
    }).map(option => option.value),
    paper.questions[7].options.filter(option => {
      const n = Number(option.text.match(/\d+/)[0]);
      return option.text.includes(['红', '蓝', '蓝'][(n - 1) % 3]);
    }).map(option => option.value),
    paper.questions[8].options.filter(option => 36 % Number.parseInt(option.text) === 0).map(option => option.value),
    paper.questions[9].options.filter(option => Number(option.text) % 4 === 0 && Number(option.text) % 10 === 0).map(option => option.value),
    2 * 5 - 2 * 5 === 0 ? '对' : '错',
    3 * 5 - 2 * 5 === 0 ? '对' : '错',
    ['圆形', '三角形', '正方形'][(12 - 1) % 3] === '圆形' ? '对' : '错',
    Array.from({ length: 4 }, (_, i) => i % 2 === 0 ? 3 : -1).reduce((n, delta) => n + delta, 7) === 11 ? '对' : '错',
    factors(1).length !== 2 && factors(1).length <= 2 ? '对' : '错',
    leastCommon(8, 12) === 96 ? '对' : '错',
    String(q17[1]),
    String(2 * q18[0] + 2 * q18[1]),
    String(Array.from({ length: 14 }, (_, i) => ['亮', '亮', '暗'][i % 3]).filter(state => state === '亮').length),
    String(Array.from({ length: 9 }, (_, i) => i % 2 === 0 ? 4 : -2).reduce((n, delta) => n + delta, 9)),
    String(factors(28).length),
    String(30 / (2 * 3)),
    [String(q23[1]), String(3 * q23[0] + 2 * q23[1])],
    [String(q24[0] + q24[1]), String(q24[0])],
    [String(Math.max(...factors(24).filter(n => 36 % n === 0))), String(leastCommon(6, 8))]
  ];
  return result;
}
function submitAnswers(key = independentlySolved()) {
  return key.map((answer, i) => paper.questions[i].type === 'application'
    ? JSON.stringify(answer) : Array.isArray(answer) ? answer.join('') : answer);
}
function onlyAnswer(index, value) {
  const answers = Array(25).fill('');
  answers[index] = value;
  return gradeReview(answers);
}

test('回顾卷固定25题、100分、60分钟，五章分值均衡且题型完整', () => {
  assert.equal(paper.kind, 'R');
  assert.equal(paper.version, 'r1');
  assert.equal(paper.durationMinutes, 60);
  assert.equal(paper.totalScore, 100);
  assert.equal(paper.questions.length, 25);
  assert.equal(paper.questions.reduce((n, q) => n + q.points, 0), 100);
  const counts = {}, points = Array(5).fill(0);
  for (const [i, q] of paper.questions.entries()) {
    assert.equal(q.id, `R${String(i + 1).padStart(2, '0')}`);
    assert.ok(q.text.length > 10 && q.explain.length > 10 && q.topic && q.section);
    counts[q.type] = (counts[q.type] || 0) + 1;
    points[q.lesson] += q.points;
    if (q.options) assert.equal(new Set(q.options.map(o => o.text)).size, q.options.length);
    if (q.type === 'application') {
      assert.equal(q.parts.length, 2);
      assert.equal(q.parts.reduce((n, p) => n + p.points, 0), q.points);
      assert.ok(q.parts.every(p => p.points === 5 && p.text));
      assert.deepEqual(q.answer, q.parts.map(p => p.answer));
    }
  }
  assert.deepEqual(counts, { single: 6, multiple: 4, boolean: 6, fill: 6, application: 3 });
  assert.deepEqual(points, [21, 21, 19, 20, 19]);
});

test('独立算术枚举核验所有答案，单选唯一、多选有正确和错误项', () => {
  const key = independentlySolved();
  assert.deepEqual(paper.questions.map(q => q.answer), key);
  for (const q of paper.questions.filter(q => q.type === 'multiple')) {
    assert.ok(q.answer.length >= 2 && q.answer.length < q.options.length);
  }
  const result = gradeReview(submitAnswers(key));
  assert.equal(result.score, 100);
  assert.deepEqual(result.itemScores, paper.questions.map(q => q.points));
  assert.deepEqual(result.correct, Array(25).fill(true));
});

test('多选全对4分，漏选且无错选2分，错选或空白0分，顺序不影响', () => {
  for (const value of ['AC', 'CA', 'a c', 'Ａ，Ｃ']) {
    const result = onlyAnswer(6, value);
    assert.equal(result.score, 4);
    assert.equal(result.correct[6], true);
  }
  for (const value of ['A', 'C']) {
    const result = onlyAnswer(6, value);
    assert.equal(result.score, 2);
    assert.equal(result.correct[6], false);
  }
  for (const value of ['', 'B', 'ABC', 'ACD', 'ABCD', 'AC答案', 'E', '0']) {
    assert.equal(onlyAnswer(6, value).score, 0);
  }
  assert.equal(onlyAnswer(7, 'AB').score, 2, '三项正确答案漏选一项仍只得2分');
});

test('应用题按两个小问分别给5分，部分正确不标记为整题正确', () => {
  const both = onlyAnswer(22, '["7","32"]');
  assert.equal(both.score, 10);
  assert.equal(both.correct[22], true);
  for (const value of ['["7",""]', '["0","32"]', '["7","12"]']) {
    const partial = onlyAnswer(22, value);
    assert.equal(partial.score, 5);
    assert.equal(partial.itemScores[22], 5);
    assert.equal(partial.correct[22], false);
  }
  for (const value of ['', '7,32', 'null', '{}', '["7"]', '["7","32","9"]', '[true,false]']) {
    assert.equal(onlyAnswer(22, value).score, 0);
  }
});

test('数值答案接受全角与小数等价，拒绝夹杂文字及无穷大', () => {
  for (const value of ['9', '９', '９．００', '09.000', ' +9.0 ']) assert.equal(onlyAnswer(16, value).score, 4);
  assert.equal(onlyAnswer(22, '["７．０","３２．００"]').score, 10);
  for (const value of ['9元', '9abc', '9+0', 'NaN', 'Infinity', '', '0x9']) assert.equal(onlyAnswer(16, value).score, 0);
  assert.equal(onlyAnswer(0, 'ｂ').score, 3);
  assert.equal(onlyAnswer(10, ' 对 ').score, 2);
  assert.equal(onlyAnswer(10, 'true').score, 0);
});

test('学生公开题面只含白名单字段，应用小问不泄漏答案且返回值独立', () => {
  const questions = publicQuestions();
  const inspect = value => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      assert.ok(!/answer|explain|correct|solution|expected/i.test(key), `公开题面不得包含 ${key}`);
      inspect(child);
    }
  };
  assert.equal(questions.length, 25);
  inspect(questions);
  assert.deepEqual(questions[22].parts[0], { text: '每个三明治多少元？', points: 5, unit: '元' });
  questions[0].options[0].text = '修改副本';
  questions[22].parts[0].text = '修改副本';
  assert.notEqual(paper.questions[0].options[0].text, '修改副本');
  assert.notEqual(paper.questions[22].parts[0].text, '修改副本');
});

test('空白和无效提交按0分处理，每题得分不超过上限', () => {
  for (const answers of [undefined, null, {}, [], Array(25).fill('')]) {
    const result = gradeReview(answers);
    assert.equal(result.score, 0);
    assert.deepEqual(result.correct, Array(25).fill(false));
    assert.equal(result.itemScores.length, 25);
  }
  for (let i = 0; i < 25; i++) {
    const result = onlyAnswer(i, submitAnswers()[i]);
    assert.equal(result.score, paper.questions[i].points);
    assert.equal(result.correct.filter(Boolean).length, 1);
  }
});
