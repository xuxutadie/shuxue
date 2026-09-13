"""使用用户选定的 A 版女声重制旁白；复用已安装 edge-tts，不新增依赖。"""
import asyncio
import hashlib
import json
import subprocess
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent
VOICE = "zh-CN-XiaoxiaoNeural"
RATE = "-8%"
OUT = ROOT / "assets" / "voice-xiaoxiao"


def probe_duration(path):
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path)],
        check=True, capture_output=True, text=True, encoding="utf-8",
    )
    duration = float(json.loads(result.stdout)["format"]["duration"])
    if duration <= 0:
        raise ValueError(f"音频时长无效：{path.name}")
    return duration


async def main():
    scenes = json.loads((ROOT / "script.json").read_text(encoding="utf-8-sig"))
    OUT.mkdir(parents=True, exist_ok=True)
    semaphore = asyncio.Semaphore(3)

    async def make(scene, index, line):
        async with semaphore:
            base = OUT / f"{scene['id']}-{index:02}"
            audio = base.with_suffix(".mp3")
            metadata = base.with_suffix(".jsonl")
            receipt = base.with_suffix(".receipt.json")
            digest = hashlib.sha256((VOICE + RATE + line["text"]).encode()).hexdigest()
            cache_ok = audio.exists() and receipt.exists() and json.loads(receipt.read_text(encoding="utf-8"))["hash"] == digest
            if not cache_ok:
                # 限制并发并进行有限重试；只有全部成功才切换主时间轴元数据。
                for attempt in range(3):
                    try:
                        await edge_tts.Communicate(line["text"], VOICE, rate=RATE).save(str(audio), str(metadata))
                        break
                    except Exception:
                        if attempt == 2:
                            raise
                        await asyncio.sleep(2 * (attempt + 1))
            duration = await asyncio.to_thread(probe_duration, audio)
            receipt.write_text(json.dumps({"hash": digest, "voice": VOICE, "rate": RATE, "text": line["text"]}, ensure_ascii=False), encoding="utf-8")
            print(f"完成 {scene['id']}-{index:02}，{duration:.2f}秒", flush=True)
            return {"scene": scene["id"], "index": index, "file": audio.relative_to(ROOT).as_posix(), "duration": duration, "voice": VOICE, "rate": RATE}

    results = await asyncio.gather(*(make(scene, i, line) for scene in scenes for i, line in enumerate(scene["lines"])))
    (ROOT / "voice-meta.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"A版配音已完成：{len(results)}段。", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
