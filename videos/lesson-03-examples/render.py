"""复用现有渲染器，只导出这次修改的第二例题。"""
import importlib.util
from pathlib import Path
root=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('course_renderer',root.parent/'course-series/render-all.py')
renderer=importlib.util.module_from_spec(spec)
spec.loader.exec_module(renderer)
renderer.render(root)
