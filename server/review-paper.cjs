'use strict';

// 回顾卷独立于比赛前后测，便于单独维护题型、用时和评分规则。
const single = '一、单项选择题';
const multiple = '二、多项选择题';
const boolean = '三、判断题';
const fill = '四、填空题';
const application = '五、应用题';
const choices = texts => texts.map((text, i) => ({ value: 'ABCD'[i], text }));

const paper = {
  kind: 'R',
  version: 'r1',
  title: '前五章回顾性测试',
  durationMinutes: 60,
  totalScore: 100,
  questions: [
    {
      id: 'R01', type: 'single', section: single, lesson: 0, topic: '相同数量消去', points: 3,
      text: '文具店同种商品单价固定，没有折扣。2块橡皮和3支铅笔共18元，2块同样的橡皮和5支同样的铅笔共26元。每支铅笔多少元？',
      options: choices(['2元', '4元', '6元', '8元']), answer: 'B',
      explain: '两张订单都有2块橡皮，橡皮的总价相同。第二张多了5－3＝2支铅笔，多付26－18＝8元，因此每支铅笔8÷2＝4元。8元是2支铅笔的总价，不能直接当作单价。'
    },
    {
      id: 'R02', type: 'single', section: single, lesson: 1, topic: '等量关系整体倍乘', points: 3,
      text: '同样的红积木和蓝积木，单个重量各自固定。1个红积木和2个蓝积木共重16克。把这一整组取3份，即3个红积木和6个蓝积木，共重多少克？',
      options: choices(['19克', '32克', '96克', '48克']), answer: 'D',
      explain: '3个红积木和6个蓝积木恰好是3组“1红＋2蓝”。每组16克，3组就是16×3＝48克。商品数量与总重量必须一起扩大3倍。'
    },
    {
      id: 'R03', type: 'single', section: single, lesson: 2, topic: '周期中的位置', points: 3,
      text: '图案从第1个开始，按“星星、月亮、云朵、太阳”的顺序不断重复排列。第19个图案是什么？',
      options: choices(['云朵', '月亮', '太阳', '星星']), answer: 'A',
      explain: '一个完整周期有4个图案。19＝4×4＋3，先排完4组，还要数下一组的第3个，所以是云朵。'
    },
    {
      id: 'R04', type: 'single', section: single, lesson: 3, topic: '因数与整除', points: 3,
      text: '下面哪个数不是30的正因数？',
      options: choices(['3', '5', '6', '8']), answer: 'D',
      explain: '30÷3＝10，30÷5＝6，30÷6＝5，都能整除。30÷8＝3余6，有剩余，所以8不是30的因数。'
    },
    {
      id: 'R05', type: 'single', section: single, lesson: 3, topic: '质数的意义', points: 3,
      text: '质数大于1，且只有1和它本身两个正因数。下面哪个数是质数？',
      options: choices(['27', '29', '33', '35']), answer: 'B',
      explain: '27＝3×9，33＝3×11，35＝5×7，这三个数都有其他因数。29不能被2、3、4、5整除，继续找因数对也不会出现新的因数，因此正因数只有1和29，是质数。'
    },
    {
      id: 'R06', type: 'single', section: single, lesson: 4, topic: '最大公因数', points: 3,
      text: '20和30的最大公因数是多少？',
      options: choices(['2', '5', '10', '20']), answer: 'C',
      explain: '20的因数有1、2、4、5、10、20；30的因数有1、2、3、5、6、10、15、30。共同的因数是1、2、5、10，其中最大的是10。'
    },
    {
      id: 'R07', type: 'multiple', section: multiple, lesson: 1, topic: '整体倍乘不能漏项', points: 4,
      text: '2个大零件和3个小零件共重24克，每类零件的单个重量固定。只把这整组按相同倍数扩大，下面哪些记录是正确的？请选择所有正确选项。',
      options: choices(['4个大零件和6个小零件共重48克', '4个大零件和3个小零件共重48克', '6个大零件和9个小零件共重72克', '2个大零件和6个小零件共重48克']), answer: ['A', 'C'],
      explain: '取2份时，大小零件的数量和总重量都乘2，得到4大＋6小＝48克，A正确。取3份时，三项都乘3，得到6大＋9小＝72克，C正确。B、D只扩大了部分零件数量，不能作为整组倍乘后的记录。'
    },
    {
      id: 'R08', type: 'multiple', section: multiple, lesson: 2, topic: '周期与整除边界', points: 4,
      text: '彩珠从第1颗起，按“红、蓝、蓝”的顺序不断重复。下面哪些说法正确？请选择所有正确选项。',
      options: choices(['第15颗是蓝色', '第16颗是红色', '第17颗是蓝色', '第18颗是红色']), answer: ['A', 'B', 'C'],
      explain: '每3颗是一组。15和18都能被3整除，落在一组的末位，都是蓝色，因此A正确、D错误。16＝3×5＋1，是红色，B正确；17＝3×5＋2，是蓝色，C正确。'
    },
    {
      id: 'R09', type: 'multiple', section: multiple, lesson: 3, topic: '寻找因数', points: 4,
      text: '把36枚相同的徽章平均装进袋子，每袋装的枚数是正整数，全部装完且没有剩余。下面哪些每袋枚数可行？请选择所有正确选项。',
      options: choices(['4枚', '5枚', '6枚', '9枚']), answer: ['A', 'C', 'D'],
      explain: '36÷4＝9袋，36÷6＝6袋，36÷9＝4袋，都没有剩余。36÷5＝7袋余1枚，所以5枚一袋不行。可行的每袋枚数就是36的因数。'
    },
    {
      id: 'R10', type: 'multiple', section: multiple, lesson: 4, topic: '公倍数', points: 4,
      text: '下面哪些数既是4的倍数，又是10的倍数？请选择所有正确选项。',
      options: choices(['10', '20', '40', '50']), answer: ['B', 'C'],
      explain: '20÷4＝5，20÷10＝2；40÷4＝10，40÷10＝4，所以20和40都是公倍数。10和50虽然是10的倍数，却不能被4整除。'
    },
    {
      id: 'R11', type: 'boolean', section: boolean, lesson: 0, topic: '消去成立的条件', points: 2,
      text: '同种文具单价固定。两张订单买了相同数量的同种笔，两张订单的总价相减时，可以消去这些笔的总价。', answer: '对',
      explain: '同种笔的单价相同，数量也相同，因此这部分总价相同。比较两张订单的差时，可以同时扣掉相同部分。'
    },
    {
      id: 'R12', type: 'boolean', section: boolean, lesson: 0, topic: '辨认相同的部分', points: 2,
      text: '同种商品单价固定。甲买3本本子和2支笔，乙买2本同样的本子和2支同样的笔。两张订单总价相减后，本子的总价会全部消去。', answer: '错',
      explain: '两张订单中笔的数量相同，可以消去笔的总价。本子分别有3本、2本，相减后还剩1本本子的总价，不能把本子全部消去。'
    },
    {
      id: 'R13', type: 'boolean', section: boolean, lesson: 2, topic: '余数为零的位置', points: 2,
      text: '图形从第1个起按“圆形、三角形、正方形”循环排列，第12个图形是圆形。', answer: '错',
      explain: '每组3个，12÷3＝4，恰好排满4组。第12个是第4组的末位，即正方形。整除时应取周期的最后一位。'
    },
    {
      id: 'R14', type: 'boolean', section: boolean, lesson: 2, topic: '循环操作的次数', points: 2,
      text: '一个数从7开始，依次执行“加3、减1”，两步不断重复。每次加法或减法算1次操作，初始的7不算操作。执行4次操作后的结果是11。', answer: '对',
      explain: '按次写出：第1次7＋3＝10，第2次10－1＝9，第3次9＋3＝12，第4次12－1＝11。也可看成2组操作，每组净增加2，7＋2×2＝11。'
    },
    {
      id: 'R15', type: 'boolean', section: boolean, lesson: 3, topic: '数1的特殊性', points: 2,
      text: '1既不是质数，也不是合数。', answer: '对',
      explain: '1只有一个正因数，就是1。质数恰有两个正因数，合数有两个以上正因数，因此1不属于这两类。'
    },
    {
      id: 'R16', type: 'boolean', section: boolean, lesson: 4, topic: '公倍数不一定最小', points: 2,
      text: '8×12＝96，所以8和12的最小公倍数一定是96。', answer: '错',
      explain: '96是8和12的一个公倍数，但不一定最小。8的正倍数有8、16、24……；12的正倍数有12、24……。首次共同出现的正数是24，所以最小公倍数是24。'
    },
    {
      id: 'R17', type: 'fill', section: fill, lesson: 0, topic: '消去后求单价', points: 4, unit: '元',
      text: '美术商店同种商品单价固定，没有折扣。2本速写本和1盒彩笔共21元，2本同样的速写本和3盒同样的彩笔共39元。每盒彩笔多少元？', answer: '9',
      explain: '速写本的数量相同。多出的3－1＝2盒彩笔对应39－21＝18元，因此每盒彩笔18÷2＝9元。代回可得每本速写本6元，两张订单都符合。'
    },
    {
      id: 'R18', type: 'fill', section: fill, lesson: 1, topic: '合并后整体求值', points: 4, unit: '元',
      text: '同样的果汁和牛奶每盒价格各自固定，没有折扣。3盒果汁和2盒牛奶共41元，2盒果汁和3盒牛奶共39元。2盒果汁和2盒牛奶一共多少元？', answer: '32',
      explain: '两组相加得到5盒果汁＋5盒牛奶＝80元，可以平均分成5套“1盒果汁＋1盒牛奶”。每套80÷5＝16元，所求是2套，共16×2＝32元，不必先分别求单价。'
    },
    {
      id: 'R19', type: 'fill', section: fill, lesson: 2, topic: '周期计数', points: 4, unit: '盏',
      text: '一排灯从第1盏开始，按“亮、亮、暗”的顺序不断重复排列。前14盏灯中，一共有多少盏亮灯？', answer: '10',
      explain: '每3盏一组，每组有2盏亮灯。14＝3×4＋2，4组有4×2＝8盏亮灯，剩下的2盏正好都是亮灯，共8＋2＝10盏。'
    },
    {
      id: 'R20', type: 'fill', section: fill, lesson: 2, topic: '整组操作加剩余操作', points: 4,
      text: '一个数从9开始，依次执行“加4、减2”，两步不断重复。一次加法或一次减法都算1次操作，初始的9不算操作。连续执行9次操作后的结果是多少？', answer: '21',
      explain: '每2次操作净增加4－2＝2。9次包含4组完整操作和1次剩余操作，先得到9＋4×2＝17，再执行下一组的第1步“加4”，得到21。按时间线检查：13、11、15、13、17、15、19、17、21。'
    },
    {
      id: 'R21', type: 'fill', section: fill, lesson: 3, topic: '按因数对计数', points: 4, unit: '个',
      text: '28有多少个不同的正因数？请按因数对寻找后填写个数。', answer: '6',
      explain: '依次找到1×28、2×14、4×7。不同正因数是1、2、4、7、14、28，共6个。成对寻找后要确认没有遗漏或重复。'
    },
    {
      id: 'R22', type: 'fill', section: fill, lesson: 3, topic: '分解质因数', points: 4,
      text: '把30分解成质因数：30＝2×3×（　）。括号中应填哪个质数？', answer: '5',
      explain: '先算2×3＝6，30÷6＝5。2、3、5都是质数，而且2×3×5＝30，因此填5。'
    },
    {
      id: 'R23', type: 'application', section: application, lesson: 0, topic: '同量消去与代回求值', points: 10,
      text: '科技节餐饮摊的同种食品单价固定，没有折扣。2杯果汁和3个三明治共33元；2杯同样的果汁和5个同样的三明治共47元。请根据这两次购物记录回答下面两问。',
      parts: [{ text: '每个三明治多少元？', points: 5, unit: '元', answer: '7' }, { text: '买3杯果汁和2个三明治，一共多少元？', points: 5, unit: '元', answer: '32' }],
      answer: ['7', '32'],
      explain: '第1问：两张订单都有2杯果汁，相减后，多出的2个三明治对应47－33＝14元，每个14÷2＝7元。第2问：先代回第一张订单，2杯果汁共33－3×7＝12元，每杯6元。3杯果汁和2个三明治共3×6＋2×7＝32元。检查：2×6＋5×7＝47，符合第二张订单。'
    },
    {
      id: 'R24', type: 'application', section: application, lesson: 1, topic: '整体求值后求单个', points: 10,
      text: '机器人社团称量零件。同款大齿轮的单个重量固定，同款小齿轮的单个重量也固定。2个大齿轮和1个小齿轮共重19克；1个同样的大齿轮和2个同样的小齿轮共重17克。请回答下面两问。',
      parts: [{ text: '1个大齿轮和1个小齿轮合起来共重多少克？', points: 5, unit: '克', answer: '12' }, { text: '1个大齿轮重多少克？', points: 5, unit: '克', answer: '7' }],
      answer: ['12', '7'],
      explain: '第1问：两次称量合起来，3个大齿轮＋3个小齿轮共重19＋17＝36克。可分成3套“1大＋1小”，每套36÷3＝12克。第2问：第一组“2大＋1小”去掉一套“1大＋1小”，还剩1大，所以大齿轮19－12＝7克。小齿轮12－7＝5克；检查2×7＋5＝19，7＋2×5＝17。'
    },
    {
      id: 'R25', type: 'application', section: application, lesson: 4, topic: '共同分组与再次同步', points: 10,
      text: '科技节需要完成两项准备工作。① 有24枚红徽章、36枚蓝徽章，要全部装成尽可能多份相同的礼袋：每袋红徽章的枚数相同，每袋蓝徽章的枚数也相同，两种徽章都不能剩余。② 两台展示机器人分别每隔6分钟和8分钟启动一次，现在它们同时启动。请分别回答下面两问。',
      parts: [{ text: '徽章最多可以装成多少份相同的礼袋？', points: 5, unit: '份', answer: '12' }, { text: '从现在开始，至少再过多少分钟，两台机器人会再次同时启动？', points: 5, unit: '分钟', answer: '24' }],
      answer: ['12', '24'],
      explain: '第1问：袋数必须同时整除24和36，找共同因数。共同因数是1、2、3、4、6、12，最多12份，每份2枚红徽章、3枚蓝徽章。第2问：再次同时启动的时间必须同时是6和8的正倍数。6的倍数有6、12、18、24……；8的倍数有8、16、24……，最早再次重合是24分钟。共同分组找公因数，再次同步找公倍数。'
    }
  ]
};

function normalized(value) {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).normalize('NFKC').trim() : '';
}

function numberEquals(actual, expected) {
  const value = normalized(actual);
  // 仅接受完整的数值，避免 parseFloat 将“7abc”错误判为 7。
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)
    && Number.isFinite(Number(value)) && Number(value) === Number(expected);
}

function gradeReview(answers) {
  const supplied = Array.isArray(answers) ? answers : [];
  const itemScores = paper.questions.map((q, i) => {
    const value = normalized(supplied[i]);
    if (q.type === 'multiple') {
      const letters = value.toUpperCase().replace(/[\s,、]+/g, '');
      if (!/^[A-D]+$/.test(letters)) return 0;
      const selected = [...new Set(letters)];
      if (selected.some(letter => !q.answer.includes(letter))) return 0;
      return selected.length === q.answer.length ? q.points : 2;
    }
    if (q.type === 'application') {
      let parts;
      try { parts = JSON.parse(value); } catch { return 0; }
      if (!Array.isArray(parts) || parts.length !== q.parts.length) return 0;
      return q.parts.reduce((score, part, j) => score + (numberEquals(parts[j], part.answer) ? part.points : 0), 0);
    }
    if (q.type === 'fill') return numberEquals(value, q.answer) ? q.points : 0;
    const candidate = q.type === 'single' ? value.toUpperCase() : value;
    return candidate === q.answer ? q.points : 0;
  });
  return {
    score: itemScores.reduce((sum, points) => sum + points, 0),
    correct: itemScores.map((points, i) => points === paper.questions[i].points),
    itemScores
  };
}

// 使用白名单字段产生学生题面，后续新增评分字段也不会被意外下发。
function publicQuestions() {
  return paper.questions.map(q => {
    const result = {};
    for (const key of ['id', 'type', 'section', 'lesson', 'topic', 'text', 'points', 'unit']) {
      if (q[key] !== undefined) result[key] = q[key];
    }
    if (q.options) result.options = q.options.map(option => ({ value: option.value, text: option.text }));
    if (q.parts) result.parts = q.parts.map(part => ({ text: part.text, points: part.points, ...(part.unit ? { unit: part.unit } : {}) }));
    return result;
  });
}

module.exports = { paper, gradeReview, publicQuestions };
