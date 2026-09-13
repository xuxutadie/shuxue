// 在现有学生 JSON 档案中保留旧题，不修改数据库结构，也不把旧成绩套到新题。
const { bank, legacyPractice } = require('./content');
function separatePracticeVersions(data) {
  const practice = { ...(data.practice || {}) };
  const practiceHistory = [...(data.practiceHistory || [])];
  for (const [key, record] of Object.entries(practice)) {
    const [lesson, index] = key.split('-').map(Number);
    const current = bank.lessons[lesson]?.practice[index];
    if (!current || (record.version || 'v1') === (current.version || 'v1')) continue;
    const previousQuestion = record.question || legacyPractice[lesson]?.[index];
    practiceHistory.push({ key, ...record, version: record.version || 'v1', question: previousQuestion ? { text: previousQuestion.text, topic: previousQuestion.topic, svg: previousQuestion.svg || '' } : { text: '旧版练习题' } });
    delete practice[key];
  }
  return { practice, practiceHistory };
}
module.exports = { separatePracticeVersions };
