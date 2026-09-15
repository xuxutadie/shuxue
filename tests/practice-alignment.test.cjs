const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { bank, lessons } = require('../server/content');
const revised = require('../server/curriculum-revision.json');

function ui() {
  const context = vm.createContext({
    esc: value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])),
    LESSONS: lessons(true), lessonId: 0, document: { addEventListener() {} }
  });
  for (const file of ['views.js', 'lesson-lab.js', 'course-videos.js']) vm.runInContext(fs.readFileSync('public/' + file, 'utf8'), context);
  return { context, run: code => vm.runInContext(code, context) };
}

test('36道独立题原文、答案及版本完全保留，40道旧测评不改', () => {
  assert.deepEqual(bank.lessons.map(l => l.practice), revised.map(l => l.practice));
  const context = vm.createContext({});
  for (const file of ['data.js', 'exam-legacy.js', 'exams.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), context);
  assert.deepEqual(bank.exams.v2, JSON.parse(vm.runInContext('JSON.stringify(EXAMS)', context)));
});

test('视频采用的字幕、脚本与关键例题对应，识别第一课和第七课旧内容偏差', () => {
  const { run } = ui();
  const metas = JSON.parse(run('JSON.stringify(COURSE_VIDEOS)'));
  assert.equal(metas.length, 12);
  for (const meta of metas) {
    const subtitles = fs.readFileSync('public' + meta.captions, 'utf8');
    assert.ok(subtitles.startsWith('WEBVTT'));
    if (meta.lessonId) {
      const script = JSON.parse(fs.readFileSync(`videos/course-series/lesson-${String(meta.lessonId + 1).padStart(2, '0')}/script.json`, 'utf8'));
      assert.ok(script.some(scene => scene.data?.stem), `第${meta.lessonId + 1}课缺完整脚本题干`);
    }
  }
  const firstCaptions = fs.readFileSync('public' + metas[0].captions, 'utf8');
  assert.match(firstCaptions, /三个水瓶和二十个茶杯/);
  assert.match(firstCaptions, /三块橡皮，五支铅笔/);
  const [bottle, eraser] = bank.lessons[0].detail.mother.cards;
  assert.match(bottle.text, /3个水瓶和20个茶杯.*134元.*3个水瓶和16个茶杯.*118元/);
  assert.match(eraser.text, /3块橡皮和5支铅笔.*10.6元.*4块橡皮和4支铅笔.*12元/);
  assert.doesNotMatch(JSON.stringify(bank.lessons[0].steps), /本子|13元|17元/);
  const seventh = fs.readFileSync('public' + metas[6].captions, 'utf8');
  assert.match(seventh, /镜面左边两格/);
  assert.match(seventh, /靠前的一列高三块/);
  assert.match(bank.lessons[6].detail.mother.cards[1].text, /左侧2格/);
  assert.match(bank.lessons[6].detail.mother.cards[2].text, /前摞高3层，后摞高2层/);
});

test('第一课数值用独立方程核验，第3课循环操作与第11课具体纠错题可解', () => {
  // 分别枚举价格到角，验证新增订单只有唯一一组正单价。
  const prices = (a,b,total,c,d,other) => {
    const found=[];
    for(let x=1;x<300;x++)for(let y=1;y<300;y++)if(a*x+b*y===Math.round(total*10)&&c*x+d*y===Math.round(other*10))found.push([x/10,y/10]);
    return found;
  };
  assert.deepEqual(prices(3,20,134,3,16,118), [[18,4]]);
  assert.deepEqual(prices(3,5,10.6,4,4,12), [[2.2,.8]]);
  assert.deepEqual(prices(3,20,134,3,14,110), [[18,4]]);
  assert.deepEqual(prices(3,7,12.2,4,4,12), [[2.2,.8]]);
  let result=10;for(let i=0;i<7;i++)result+=i%2?-1:4;
  assert.equal(result,23);
  assert.equal(bank.lessons[2].detail.mother.cards[1].answer,'23。');
  const correction=bank.lessons[10].detail.variants;
  assert.equal(['红','黄','蓝','绿'][(40-1)%4],'绿');
  assert.equal((15*4+25)/5,17);
  assert.match(correction[0].answer,/第40面绿色，第41面红色/);
  assert.equal(correction[1].answer,'17。');
  assert.doesNotMatch(JSON.stringify(correction), /请老师从本次后测中选|以个人错题/);
});

test('12课每张题卡都完整且一题一解析，变式红字为题干精确片段', () => {
  const { run }=ui();
  for(let i=0;i<12;i++) {
    const d=bank.lessons[i].detail, mothers=d.mother.cards, variants=d.variants.flatMap(v=>v.cards||[v]);
    for(const q of [...mothers,...variants])assert.ok(q.title&&q.text&&q.answer&&q.explain);
    const html=run(`motherProblem(LESSONS[${i}])+variantsView(LESSONS[${i}])`);
    assert.equal((html.match(/class="practice-card /g)||[]).length,mothers.length+variants.length);
    assert.equal((html.match(/<summary>尝试后展开本题答案与步骤<\/summary>/g)||[]).length,mothers.length+variants.length);
    assert.doesNotMatch(html, /<details[^>]+\sopen|undefined|NaN/);
    for(const q of variants){
      assert.ok(q.changed.length);
      for(const part of q.changed){assert.ok(q.text.includes(part));assert.ok(html.includes(`<mark class="changed-condition">${part}</mark>`));}
    }
  }
  assert.equal(bank.lessons[11].detail.variants.flatMap(v=>v.cards||[v]).length,4);
});

test('红字安全转义完整题干，支持重复片段与重叠片段', () => {
  const { context, run }=ui();
  context.stem='<img src=x onerror=alert(1)> 12元与12元';
  context.parts=['<img src=x onerror=alert(1)>','12元','2元'];
  const html=run('changedStem(stem,parts)');
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.equal((html.match(/<mark /g)||[]).length,3);
  assert.equal(run("changedStem('完整题干',[])"),'完整题干');
});

test('第一课默认SVG订单与视频一致，配套计算随参数同步且单价默认折叠', () => {
  const { run }=ui();
  const shop=run('labModel("shop",{pen:4},3)');
  assert.match(shop.svg,/134元/);assert.match(shop.svg,/118元/);
  assert.match(shop.formula,/20－16/);assert.equal(shop.answer,'16');
  const pairs=run('labModel("pairs",{pencil:8},3)');
  assert.match(pairs.svg,/10.6元/);assert.match(pairs.svg,/4块橡皮＋4支铅笔＝12元/);
  assert.equal(pairs.answer,'2.2');
  assert.equal(run('labModel("pairs",{pencil:12},3).answer'),'1.8');
});
