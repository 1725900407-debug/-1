#!/bin/bash
cd -- "$(dirname -- "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then
  python3 start.py
elif command -v python >/dev/null 2>&1; then
  python start.py
else
  echo "没有找到 Python。请先安装 Python 3.9 或更新版本。"
  exit 1
fi
launcher_status=$?
if [ "$launcher_status" -ne 0 ]; then
  read -r -p "启动尚未完成。请查看上方提示，按回车关闭窗口。"
fi
exit "$launcher_status"
