"""核对最终网站媒体、资源版本和成片；浏览器实际交互另记实测结果。"""
import hashlib
import json
import urllib.request
from pathlib import Path

project = Path(__file__).resolve().parent.parent
series = project / 'videos/course-series'
catalog = json.loads((series / 'publication.json').read_text(encoding='utf8'))
assert len(catalog) == 12, '课程视频数量不完整'
rows = []

def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

for item in catalog:
    number = item['lessonId'] + 1
    folder = project / 'videos/lesson-01-pairs' if number == 1 else series / f'lesson-{number:02}'
    movie = folder / ('第一课-消去问题-多巴胺配套版.mp4' if number == 1 else 'lesson.mp4')
    target = project / 'public' / item['src'].lstrip('/')
    assert digest(movie) == digest(target), f'第{number}课发布文件不一致'
    timing = json.loads((folder / 'timing.json').read_text(encoding='utf8'))
    assert abs(timing['duration'] - item['duration']) < .002
    report = json.loads((folder / 'video-verification.json').read_text(encoding='utf8'))
    assert report['decode'] == '通过'
    if number > 1:
        sources = [folder / 'index.html', folder / 'voice-meta.json', *sorted((folder / 'compositions').glob('*.html'))]
        assert report['hash'] == hashlib.sha256(b''.join(p.read_bytes() for p in sources)).hexdigest()
    else:
        assert movie.stat().st_size == 18490378, '首课已确认成片发生变化'
    for field, mime in [('src', 'video/mp4'), ('captions', 'text/vtt'), ('poster', 'image/jpeg')]:
        headers = {'Range': 'bytes=0-1023'} if field == 'src' else {}
        request = urllib.request.Request('http://127.0.0.1:8766' + item[field], headers=headers)
        with urllib.request.urlopen(request, timeout=20) as response:
            assert response.status == (206 if field == 'src' else 200)
            assert mime in response.headers['Content-Type']
            if field == 'src':
                assert len(response.read()) == 1024
            elif field == 'captions':
                assert response.read(6) == b'WEBVTT'
    assert (project / 'public' / item['captions'].lstrip('/')).read_bytes() == (folder / 'captions.vtt').read_bytes()
    rows.append({'lesson': number, 'seconds': item['duration'], 'bytes': target.stat().st_size, 'sha256': digest(target), 'src': item['src']})

math_report = json.loads((series / 'revision-verification.json').read_text(encoding='utf8'))
tests_log = (series / 'revision-tests.log').read_text(encoding='utf-8-sig')
assert '# pass 26' in tests_log and '# fail 0' in tests_log, '最终回归检查尚未通过'
result = {
    'videos': 12, 'revisedVideos': math_report['revisedVideos'],
    'totalSeconds': round(sum(v['seconds'] for v in rows), 3),
    'site': 'http://127.0.0.1:8766/',
    'tests': {'passed': 26, 'failed': 0},
    'sourceChecks': math_report['passed'], 'newPractice': 33,
    'media': '12条成片与发布文件一致，HTTP分段读取、字幕和封面均通过',
    'scope': '本机网站；浏览器交互结果记录在revision-browser-verification.json',
    'lessons': rows
}
(series / 'delivery-verification.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf8')
print(json.dumps({k: v for k, v in result.items() if k != 'lessons'}, ensure_ascii=False))
