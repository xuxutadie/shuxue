"""独立复算新练习，并核对递进、答案隔离、原试卷与成片时间边界。"""
import json,math,re,hashlib
from pathlib import Path
root=Path(__file__).resolve().parent.parent
lessons=json.loads((root/'server/curriculum-revision.json').read_text(encoding='utf8'))
checks=[]
def check(name,value):
    if not value: raise AssertionError(name)
    checks.append(name)
def factors(n):return [x for x in range(1,n+1) if n%x==0]

def prime_factor_count(n):
    count=0
    for divisor in range(2,n+1):
        while n%divisor==0:
            count+=1
            n//=divisor
    return count
def count_cycle(n,pattern,target):return sum(pattern[i%len(pattern)]==target for i in range(n))
def operations(start,n):
    for i in range(n):start += [5,-2,1][i%3]
    return start
def solve(a,b,c,d,e,f):
    det=a*e-b*d
    return ((c*e-b*f)/det,(a*f-c*d)/det)
a,b=solve(3,2,43,2,3,42)
c,d=solve(4,3,40,3,4,37)
expected={
 2:[4*a+b,(34+36)/5*3,5*c+2*d],
 3:['红',count_cycle(58,['红','蓝','蓝','绿'],'蓝'),operations(12,11)],
 4:[len(factors(45)),len(factors(64)),next(v for v in factors(60) if 6<=v<=16 and prime_factor_count(v)==3)],
 5:[math.gcd(28,42),96//math.lcm(8,12),max(v for v in factors(math.gcd(36,60)) if 5<v<15)],
 6:[10*8-4*3,(14*9-106)/4,8*5/2],
 7:[(5+6/2)*4**2,((4-1)*2)*2,max(4-2,3)],
 8:[55*8/(95-55),4+3+(40*6-(70-40)*4+40*3)/(70-40),75*(3+(45*4-(75-45)*3+45*2)/(75-45))],
 9:[(6*12-((6*12-9*6)/(12-6))*12)/(15-(6*12-9*6)/(12-6)),42/7+3,25+(3-2)*8],
 10:[sum(a+b+c==11 for a in range(2,6) for b in range(2,6) for c in range(2,6)),16*4-11-17-19,(20*5-28)/4],
 11:['红',(6*14-24)/5,180-(80-50)*2+50],
 12:[math.gcd(40,56),count_cycle(67,['圆','星','星','方','三角'],'星'),3*(3*5-2)-4]
}
for n,answers in expected.items():
    for j,answer in enumerate(answers):
        q=lessons[n-1]['practice'][j]
        check(f'第{n}课第{j+1}题独立验算',str(answer)==q['answer'] if isinstance(answer,str) else float(q['answer'])==answer)
        check(f'第{n}课第{j+1}题独立题干与解析',len(q['text'])>=30 and bool(q['explain']))
        check(f'第{n}课第{j+1}题版本隔离',q['version']=='2026-09-r2')
check('镜像与空间均有独立题',{'镜像距离','空间观察'}.issubset({q['topic'] for q in lessons[6]['practice']}))
check('第二课母题不重复第一课变式',all(v['text']!=lessons[1]['detail']['mother']['text'] for v in lessons[0]['detail']['variants']))
check('复盘课有个人诊断入口','个人复盘' in lessons[10]['detail']['variants'][1]['title'])
check('第一课练习保持原样',lessons[0]['practice']==json.loads((root/'backups/curriculum-20260912/effective-lessons.json').read_text(encoding='utf8'))[0]['practice'])

# 新视频的关键算式，用不同的计算路线复核。
check('第二课两边调整',solve(2,3,31,3,2,34)==(8,5))
check('第二课整体变式',sum(solve(2,3,37,3,2,38))*4==60)
check('第二课末题',sum(v*k for v,k in zip(solve(3,2,36,2,3,34),(5,4)))==64)
check('第四课中间因数与筛选',len(factors(36))==9 and [v for v in factors(48) if 5<=v<=13]==[6,8,12])
check('第五课同步计数',[v for v in range(1,73) if v%6==v%8==0]==[24,48,72])
check('第五课受限分组',[v for v in factors(math.gcd(24,36)) if v>=5]==[6,12])
check('第六课补形分割与逆向',8*6-2*3==8*3+6*3==42 and (12*8-81)/3==5)
check('第八课分段追及',4+2+(300-30*4+60*2)/30==16 and 90*14==60*21==1260)
check('第八课独立讲解',5+3+(300-30*5+50*3)/30==18 and 80*15==50*24==1200)
check('第九课倒求速度',30/6+2==7 and 7*6==30+2*6)
check('第十课总量与移多补少',(2+3+4+7)/4==4 and (5*14-18)/4==13)
check('第十一课纠错示范',(15*4+20)/5==16)
check('第十二课方法与嵌套',math.gcd(24,32)==8 and (26-1)%3==1 and 11*4-30==14 and 2*(2*2+3)+4==18)

for n in range(2,13):
    folder=root/f'videos/course-series/lesson-{n:02}'
    timing=json.loads((folder/'timing.json').read_text(encoding='utf8'))
    check(f'第{n}课末尾是完整独立题',timing['scenes'][-1]['kind']=='challenge' and len(timing['scenes'][-1]['data']['stem'])>50 and not timing['scenes'][-1]['notes'])
    text=''.join(a['text'] for s in timing['scenes'] for a in s['lines'])
    check(f'第{n}课没有提供试卷或依据旁白',not re.search(r'你提供|您提供|依据|参考试卷|比赛试卷',text))
    previous=0
    for caption in timing['captions']:
        check(f'第{n}课字幕边界{caption["start"]}',caption['start']>=previous-.003 and caption['end']>caption['start'] and caption['end']<=timing['duration'])
        previous=caption['end']
    for s in json.loads((folder/'motion-map.json').read_text(encoding='utf8')):
        html=(folder/'compositions'/f'{s["scene"]}.html').read_text(encoding='utf8')
        for e in s['events']:
            target=s['scene']+'-'+e['subject'].split()[0]
            check(f'第{n}课动画目标{target}',f'id="{target}"' in html)
    # 静态题干不能和本课课后题完全相同；近似结构另由教学审查区分。
    stems=[s['data']['stem'] for s in timing['scenes'] if 'stem' in s['data']]
    for q in lessons[n-1]['practice']:check(f'第{n}课示范与独立题分开',q['text'] not in stems)
report={'passed':len(checks),'newPractice':33,'revisedVideos':[2,4,5,6,8,9,10,11,12],'scope':'数学、字幕边界、动画目标与题目角色；成片解码与浏览器另行验证'}
(root/'videos/course-series/revision-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(report,ensure_ascii=False))
