#!/usr/bin/env python3
"""纯 Python 启动器：演示模式无需安装、下载或联网，支持终端和 IDLE。"""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import threading
import sys
import urllib.request
import webbrowser

ROOT = Path(__file__).resolve().parent


def say(text):
    print(text, flush=True)


def start_server(preferred):
    from python_server import ChatServer
    for port in range(preferred, min(preferred + 11, 65536)):
        try:
            return ChatServer(("127.0.0.1", port))
        except OSError as error:
            if error.errno not in (48, 98, 10048):
                raise
    raise RuntimeError("附近端口均被占用。可加 --port 3200 再运行。")


def functional_check(port):
    local = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with local.open(f"http://127.0.0.1:{port}/api/status", timeout=5) as response:
        status = json.load(response)
    with local.open(f"http://127.0.0.1:{port}/", timeout=5) as response:
        page = response.read()
    if status.get("app") != "chat-practice-room" or not status.get("localDemo") or b'<div id="root"></div>' not in page or b'data:image/png;base64,' not in page:
        raise RuntimeError("网页或头像未正确准备，请重新下载完整项目。")


def main():
    from python_server import load_environment
    load_environment()
    parser = argparse.ArgumentParser(description="仅用 Python 打开聊天练习室，无需 Node.js、pip 或联网安装")
    parser.add_argument("--no-browser", action="store_true", help="不自动打开浏览器")
    parser.add_argument("--check", action="store_true", help="检查网页与状态接口后退出")
    parser.add_argument("--setup-only", action="store_true", help="检查便携文件是否完整，无需安装")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "3000")), help="首选本机端口，默认 3000")
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535:
        raise RuntimeError("端口请使用 1024–65535 之间的数字。")
    if not all((ROOT / file).is_file() for file in ("portable/index.html", "portable/contracts.json")):
        raise RuntimeError("请从 GitHub 下载并完整解压项目，再运行 start.py；不要只下载启动文件。")
    if args.setup_only:
        say("便携文件完整，无需下载运行环境。运行 python3 start.py 即可打开。")
        return
    server = start_server(args.port)
    port = server.server_address[1]
    if port != args.port:
        say(f"端口 {args.port} 已被占用，使用 {port}。浏览器记录按地址分别保存，可用导出、导入迁移。")
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        functional_check(port)
        if args.check:
            say("检查通过：纯 Python 服务、便携网页与内嵌头像均可读取。")
            return
        url = f"http://127.0.0.1:{port}"
        say("\n聊天练习室已启动，无需下载 Node.js 或安装 pip 包。")
        say("本机地址：" + url)
        say("请保持此窗口打开；终端按 Ctrl+C，IDLE 可用 Shell → Restart Shell 停止。")
        if not args.no_browser and not webbrowser.open(url):
            say("请把上面的地址复制到浏览器。")
        while thread.is_alive():
            thread.join(timeout=0.5)
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


if __name__ == "__main__":
    if sys.version_info < (3, 9):
        sys.exit("请使用 Python 3.9 或更新版本。")
    try:
        main()
    except KeyboardInterrupt:
        say("\n已停止。下次运行 start.py 可重新打开。")
    except (OSError, RuntimeError, ValueError) as error:
        say("启动未完成：" + str(error))
        sys.exit(1)
