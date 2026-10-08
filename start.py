#!/usr/bin/env python3
"""用 Python 标准库准备私有 Node.js，并启动聊天练习室，无需全局安装。"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import shutil
import signal
import socket
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.error
import urllib.request
import webbrowser
import zipfile

ROOT = Path(__file__).resolve().parent
RUNTIME = ROOT / ".runtime"
VERSION = "v24.21.0"
# 来自 nodejs.org/dist/v24.21.0/SHASUMS256.txt，通过官方 HTTPS 获取后固定。
CHECKSUMS = {
    "darwin-arm64.tar.gz": "bed7eea5325e1108f32ce5228ddd6a5f0f08a499ee42aa7442aea583702f6057",
    "darwin-x64.tar.gz": "1462cb3b3046b815cf8ea436d3da450ec1a9f11dac7e5a46b0ada5305d7e8097",
    "linux-arm64.tar.gz": "724282c3b43aec998aa9527380465b45d229e021b58035f5f4f63095eabfe5d5",
    "linux-x64.tar.gz": "6e1db87ef58b8819e5d5402eff1536491b18edd8eb7bee5ef7897876e88dc5ff",
    "win-arm64.zip": "8779b1bde1d39f8d420e3b57aa657b39891af434d3de44a919044cec06785921",
    "win-x64.zip": "158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541",
}
LOCAL_HTTP = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def say(text):
    print(text, flush=True)


def platform_target(system=None, machine=None):
    system = system or platform.system()
    machine = (machine or platform.machine()).lower()
    os_name = {"Darwin": "darwin", "Windows": "win", "Linux": "linux"}.get(system)
    arch = {"arm64": "arm64", "aarch64": "arm64", "amd64": "x64", "x86_64": "x64"}.get(machine)
    if not os_name or not arch:
        raise RuntimeError("暂不支持此系统自动下载。可自行安装 Node.js 24，再运行本启动器。")
    suffix = ".zip" if os_name == "win" else ".tar.gz"
    return f"{os_name}-{arch}{suffix}"


def digest(path):
    value = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def official_download(filename, expected, destination):
    if destination.is_file() and digest(destination) == expected:
        return
    url = f"https://nodejs.org/dist/{VERSION}/{filename}"
    say("首次启动：从 Node.js 官网下载运行环境，请稍等…")
    temporary = destination.with_suffix(destination.suffix + ".part")
    try:
        with urllib.request.urlopen(url, timeout=45) as response, temporary.open("wb") as file:
            total = 0
            report = 0
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                file.write(chunk)
                total += len(chunk)
                if total - report >= 10 * 1024 * 1024:
                    say(f"已下载 {total // (1024 * 1024)} MB…")
                    report = total
        if digest(temporary) != expected:
            raise RuntimeError("运行环境下载校验失败，未使用此文件。请检查网络后重新运行。")
        temporary.replace(destination)
    finally:
        temporary.unlink(missing_ok=True)


def within(parent, target):
    return target.resolve().is_relative_to(parent.resolve())


def unpack(archive, destination):
    """只解压已经过固定 SHA256 校验的官方文件，并检查归档路径。"""
    if archive.suffix == ".zip":
        with zipfile.ZipFile(archive) as source:
            for member in source.infolist():
                if not within(destination, destination / member.filename):
                    raise RuntimeError("压缩包包含越界路径，已停止。")
            source.extractall(destination)
    else:
        with tarfile.open(archive, "r:gz") as source:
            for member in source.getmembers():
                target = destination / member.name
                if not within(destination, target) or member.isdev():
                    raise RuntimeError("压缩包包含不支持的路径或文件，已停止。")
                if member.issym() or member.islnk():
                    link = (target.parent if member.issym() else destination) / member.linkname
                    if not within(destination, link):
                        raise RuntimeError("压缩包包含越界链接，已停止。")
            if hasattr(tarfile, "data_filter"):
                source.extractall(destination, filter="data")
            else:
                source.extractall(destination)


def valid_node(node):
    try:
        result = subprocess.run([str(node), "--version"], capture_output=True, text=True, timeout=15, check=True)
        parts = tuple(int(n) for n in result.stdout.strip().lstrip("v").split(".")[:3])
        return parts >= (22, 12, 0)
    except (OSError, subprocess.SubprocessError, ValueError):
        return False


def get_node(force_bundled=False):
    if not force_bundled:
        existing = shutil.which("node")
        if existing and valid_node(existing):
            node = Path(existing).resolve()
            npm_command = shutil.which("npm")
            candidates = [node.parent / "node_modules/npm/bin/npm-cli.js", node.parent.parent / "lib/node_modules/npm/bin/npm-cli.js"]
            if npm_command:
                resolved = Path(npm_command).resolve()
                if resolved.suffix == ".js":
                    candidates.insert(0, resolved)
            for npm in candidates:
                if npm.is_file():
                    say("已找到可用的 Node.js，直接使用。")
                    return node, npm
    target = platform_target()
    filename = f"node-{VERSION}-{target}"
    folder_name = filename.removesuffix(".tar.gz").removesuffix(".zip")
    folder = RUNTIME / folder_name
    windows = target.startswith("win-")
    node = folder / ("node.exe" if windows else "bin/node")
    npm = folder / ("node_modules/npm/bin/npm-cli.js" if windows else "lib/node_modules/npm/bin/npm-cli.js")
    if not (node.is_file() and npm.is_file()):
        archive = RUNTIME / filename
        official_download(filename, CHECKSUMS[target], archive)
        say("校验通过，正在准备项目内的运行环境…")
        with tempfile.TemporaryDirectory(prefix="extract-", dir=RUNTIME) as temp:
            unpack(archive, Path(temp))
            extracted = Path(temp) / folder_name
            if folder.exists():
                raise RuntimeError("本地运行环境目录不完整，请删除项目 .runtime 目录后重试。")
            extracted.rename(folder)
    if not valid_node(node):
        raise RuntimeError("下载的运行环境无法在本机运行。请确认系统版本支持 Node.js 24。")
    return node, npm


def stamp_matches(file, value):
    try:
        return file.read_text(encoding="utf-8").strip() == value
    except FileNotFoundError:
        return False


def prepare(node, npm):
    environment = os.environ.copy()
    environment["PATH"] = str(node.parent) + os.pathsep + environment.get("PATH", "")
    environment["npm_config_cache"] = str(RUNTIME / "npm-cache")
    environment["npm_config_update_notifier"] = "false"
    # 不通过 shell 拼接路径，支持中文路径、空格和 Windows。
    def run(*arguments):
        subprocess.run([str(node), str(npm), *arguments], cwd=ROOT, env=environment, check=True)

    lock_hash = digest(ROOT / "package-lock.json")
    dependency_stamp = RUNTIME / "dependencies.sha256"
    if not stamp_matches(dependency_stamp, lock_hash) or not (ROOT / "node_modules/tsx/dist/loader.mjs").is_file():
        say("正在安装网页依赖（首次需要联网，之后会复用）…")
        run("ci", "--include=dev", "--no-audit", "--no-fund")
        dependency_stamp.write_text(lock_hash, encoding="utf-8")
    source_hash = hashlib.sha256(lock_hash.encode())
    files = [ROOT / "index.html", ROOT / "vite.config.ts", ROOT / "tsconfig.json"]
    files += sorted((ROOT / "src").rglob("*")) + sorted((ROOT / "shared").rglob("*")) + sorted((ROOT / "public").rglob("*"))
    for file in files:
        if file.is_file():
            source_hash.update(str(file.relative_to(ROOT)).encode())
            source_hash.update(file.read_bytes())
    build_hash = source_hash.hexdigest()
    build_stamp = RUNTIME / "build.sha256"
    if not stamp_matches(build_stamp, build_hash) or not (ROOT / "dist/index.html").is_file():
        say("正在准备网页界面…")
        run("run", "build")
        build_stamp.write_text(build_hash, encoding="utf-8")
    return environment


def app_status(port):
    try:
        with LOCAL_HTTP.open(f"http://127.0.0.1:{port}/api/status", timeout=1) as response:
            status = json.load(response)
        return status if status.get("app") == "chat-practice-room" else None
    except (OSError, ValueError):
        return None


def available_port(preferred):
    for port in range(preferred, min(preferred + 11, 65536)):
        with socket.socket() as connection:
            try:
                connection.bind(("127.0.0.1", port))
                return port
            except OSError:
                pass
    raise RuntimeError("附近端口均被占用。请关闭之前的启动窗口，或加 --port 3200 再运行。")


def functional_check(port):
    body = json.dumps({"mode": "demo", "scenarioId": "01", "answer": "你好，我是刚才桌游的阿川。", "silence": False}).encode()
    request = urllib.request.Request(f"http://127.0.0.1:{port}/api/practice", data=body, headers={"Content-Type": "application/json"})
    with LOCAL_HTTP.open(request, timeout=15) as response:
        feedback = json.load(response)
    if len(feedback.get("data", {}).get("scores", [])) != 5:
        raise RuntimeError("网页启动了，但练习接口检查未通过。请保留终端错误信息。")


def main():
    parser = argparse.ArgumentParser(description="自动准备运行环境并打开聊天练习室")
    parser.add_argument("--no-browser", action="store_true", help="不自动打开浏览器")
    parser.add_argument("--bundled-node", action="store_true", help="使用项目内的官方运行环境")
    parser.add_argument("--setup-only", action="store_true", help="仅安装和构建")
    parser.add_argument("--check", action="store_true", help="启动并检查练习接口，通过后退出")
    parser.add_argument("--port", type=int, default=3000, help="优先使用的端口，默认 3000")
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535:
        raise RuntimeError("端口请使用 1024–65535 之间的数字。")
    if not (ROOT / "package-lock.json").is_file():
        raise RuntimeError("请先完整解压项目，再运行 start.py；不要只下载这一个文件。")
    if not args.setup_only and app_status(args.port):
        url = f"http://localhost:{args.port}"
        say("聊天练习室已经在这台电脑运行：" + url)
        if args.check:
            functional_check(args.port)
        elif not args.no_browser:
            webbrowser.open(url)
        return
    RUNTIME.mkdir(exist_ok=True)
    node, npm = get_node(args.bundled_node)
    environment = prepare(node, npm)
    if args.setup_only:
        say("准备完成。下次直接运行 python3 start.py 即可打开。")
        return
    port = available_port(args.port)
    if port != args.port:
        say(f"端口 {args.port} 已被其他程序占用，改用 {port}。浏览器记录按地址分别保存。")
    environment.update({"NODE_ENV": "production", "PORT": str(port), "HOST": "127.0.0.1"})
    child = subprocess.Popen([str(node), "--import", "tsx", "server/index.ts"], cwd=ROOT, env=environment, start_new_session=os.name != "nt")
    try:
        for _ in range(120):
            if child.poll() is not None:
                raise RuntimeError("网页服务启动失败，请查看上方错误。")
            if app_status(port):
                break
            time.sleep(0.25)
        else:
            raise RuntimeError("等待服务启动超时，请查看上方错误。")
        functional_check(port)
        if args.check:
            say("检查通过：网页服务与完整练习反馈均可用。")
            return
        url = f"http://localhost:{port}"
        say("\n已经启动！浏览器打开后，点“开始 10 分钟练习”。")
        say("本机地址：" + url)
        say("请保持这个终端窗口运行；按 Ctrl+C 可以停止。")
        if not args.no_browser and not webbrowser.open(url):
            say("没有检测到默认浏览器，请把上面的本机地址复制到浏览器。")
        child.wait()
    finally:
        if child.poll() is None:
            if os.name == "nt":
                child.terminate()
            else:
                os.killpg(child.pid, signal.SIGTERM)
            try:
                child.wait(timeout=8)
            except subprocess.TimeoutExpired:
                if os.name == "nt":
                    child.kill()
                else:
                    os.killpg(child.pid, signal.SIGKILL)
                child.wait()


if __name__ == "__main__":
    if sys.version_info < (3, 9):
        sys.exit("请使用 Python 3.9 或更新版本运行 start.py。")
    try:
        main()
    except KeyboardInterrupt:
        say("\n已停止。下次运行 start.py 可重新打开。")
    except urllib.error.URLError as error:
        reason = str(error.reason)
        if "CERTIFICATE_VERIFY_FAILED" in reason:
            say("下载时证书验证失败。若用 python.org 的 Mac Python，请先运行 Python 安装目录中的 Install Certificates.command，再试一次。")
        else:
            say("下载失败，请确认网络可以访问 nodejs.org，然后重新运行。已校验的下载会复用。")
        sys.exit(1)
    except subprocess.CalledProcessError:
        say("准备没有完成，请查看上方错误。首次需要联网访问 registry.npmjs.org；修复后重新运行即可。")
        sys.exit(1)
    except (OSError, RuntimeError) as error:
        say("启动未完成：" + str(error))
        sys.exit(1)
