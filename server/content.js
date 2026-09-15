const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
// 仅执行项目自带题库，绝不执行用户上传内容。题库文件不在静态目录中。
const context = vm.createContext({});
for (const file of ['data.js', 'exam-legacy.js', 'exams.js', 'pretest-v3.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
}
const bank = JSON.parse(vm.runInContext('JSON.stringify({lessons:LESSONS,flow:FLOW,testFlow:TEST_FLOW,exams:{v1:{A:examQuestions("A","v1"),B:examQuestions("B","v1")},v2:EXAMS}})', context));
// 新开始的前测使用第三版，已存在的测评继续按其记录版本取题、评分。
bank.exams.v3 = { A: JSON.parse(vm.runInContext('JSON.stringify(PRETEST_V3)', context)) };
const currentExamVersions = { A: 'v3', B: 'v2' };
const teaching = require('./lesson-details');
const problems = require('./lesson-problems');
bank.lessons = bank.lessons.map((lesson, i) => ({ ...lesson, steps: teaching.details[i].steps, detail: { ...teaching.details[i], ...problems[i] } }));
// 保留旧题文本供历史作答查看。修订仅替换教学内容，前后测题库独立维护。
const legacyPractice = bank.lessons.map(l => l.practice);
const revisedLessons = require('./curriculum-revision.json');
if (revisedLessons.length !== bank.lessons.length) throw new Error('课程修订数量不完整');
bank.lessons = require('./practice-alignment').alignPractice(structuredClone(revisedLessons));
bank.flow = teaching.flow;
bank.testFlow = teaching.testFlow;
function normal(v) { let t = String(v ?? '').normalize('NFKC').trim().replace(/\s/g, '').replace(/：/g, ':'); return t.endsWith('色') ? t.slice(0,-1) : t; }
function correct(a, b) {
  a = normal(a); b = normal(b); if (!a) return false;
  if (/^\d{1,2}:\d{2}$/.test(a) && /^\d{1,2}:\d{2}$/.test(b)) return a.split(':').map(Number).join(':') === b.split(':').map(Number).join(':');
  const numeric = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;
  return numeric.test(a) && numeric.test(b) ? Number(a) === Number(b) : a === b;
}
function grade(kind, version, answers) {
  const results = bank.exams[version][kind].map((q, i) => correct(answers[i], q.answer));
  return { correct: results, score: results.filter(Boolean).length * 6 };
}
function publicQuestion(q) { const { answer, explain, ...safe } = q; return safe; }
// 视频末尾题的教师解法只随教师接口返回，不能放进公共媒体清单。
const videoGuides = require('./video-guides.json');
function lessons(teacher) { return bank.lessons.map((l,i) => ({ ...l, variantPractice:require('./variant-practice').variants(l,i,teacher), ...(teacher&&videoGuides[i]?{videoGuide:videoGuides[i]}:{}), practice: l.practice.map(q => teacher ? q : publicQuestion(q)) })); }
module.exports = { bank, correct, grade, publicQuestion, lessons, legacyPractice, currentExamVersions };
