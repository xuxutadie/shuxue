"""统一验证入口：校验当前修订课程，避免旧题验算被误当成新版验证。"""
import runpy
from pathlib import Path

root = Path(__file__).resolve().parent
runpy.run_path(str(root.parent.parent / 'scripts' / 'verify-curriculum-revision.py'), run_name='__main__')
(root / 'source-verification.json').write_bytes((root / 'revision-verification.json').read_bytes())
