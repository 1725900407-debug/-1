"""Make the user download from checked-in, prebuilt files; no runtime downloads."""
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1]
files = ["start.py", "python_server.py", "打开聊天练习室.command", "打开聊天练习室.bat", ".env.example", "README.md", "portable/index.html", "portable/contracts.json", "portable/README.md"]
output = root / "downloads/chat-practice-room-python.zip"
output.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for filename in files:
        archive.write(root / filename, "聊天练习室/" + filename)
print(f"下载包已生成：{output.relative_to(root)} ({output.stat().st_size / 1048576:.2f} MB)")
