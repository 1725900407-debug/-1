"""聊天练习室便携服务：仅使用 Python 标准库，密钥始终留在服务端。"""
from __future__ import annotations

import hmac
import json
import math
import os
from pathlib import Path
import socket
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parent
PORTABLE = ROOT / "portable"
CONTRACTS = PORTABLE / "contracts.json"


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


def load_environment(root=ROOT):
    """Read a simple .env without shell evaluation or overriding injected variables."""
    file = root / ".env"
    if not file.is_file():
        return
    for line in file.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip()
        if key.startswith("export "):
            key = key[7:].strip()
        if key not in {"AI_API_KEY", "AI_BASE_URL", "AI_MODEL", "AI_TIMEOUT_MS", "PORT", "APP_ACCESS_TOKEN"}:
            continue
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        os.environ.setdefault(key, value)


def validate(value, schema):
    """Validate and strip unknown fields using the exported shared Zod contract."""
    kind = schema["type"]
    valid = {
        "object": isinstance(value, dict),
        "array": isinstance(value, list),
        "string": isinstance(value, str),
        "boolean": isinstance(value, bool),
        "integer": type(value) is int,
        "number": type(value) is int or type(value) is float and math.isfinite(value),
    }[kind]
    if not valid:
        raise ValueError("字段类型不正确")
    if kind == "object":
        if any(key not in value for key in schema.get("required", [])):
            raise ValueError("缺少必要字段")
        return {key: validate(value[key], child) for key, child in schema["properties"].items() if key in value}
    if kind == "array":
        if not schema.get("minItems", 0) <= len(value) <= schema.get("maxItems", 10000):
            raise ValueError("列表长度不正确")
        return [validate(item, schema["items"]) for item in value]
    if kind == "string":
        value = value.strip() if schema.get("trim") else value
        length = len(value.encode("utf-16-le", errors="surrogatepass")) // 2
        if not schema.get("minLength", 0) <= length <= schema.get("maxLength", 100000):
            raise ValueError("文字长度不正确")
        if "enum" in schema and value not in schema["enum"]:
            raise ValueError("字段选项不正确")
    if kind in ("integer", "number"):
        if not schema.get("minimum", -math.inf) <= value <= schema.get("maximum", math.inf):
            raise ValueError("数值超出范围")
    return value


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class AIRuntime:
    def __init__(self, contracts, environment=None):
        self.contracts = contracts
        self.environment = dict(os.environ if environment is None else environment)
        self.opener = urllib.request.build_opener(NoRedirect())

    @property
    def configured(self):
        return bool(self.environment.get("AI_API_KEY", "").strip())

    def input_data(self, endpoint, body):
        try:
            data = validate(body, self.contracts["inputs"][endpoint])
        except (ValueError, TypeError):
            raise ApiError(400, "输入为空、过长或格式不正确，请检查后再提交。") from None
        if data["mode"] != "ai":
            raise ApiError(400, "便携版演示练习在浏览器中运行，请刷新网页后重试。")
        if not data.get("consent"):
            raise ApiError(400, "提交前需要明确确认发送内容到外部 AI 服务。")
        if endpoint == "practice":
            scenario = next((s for s in self.contracts["scenarios"] if s["id"] == data["scenarioId"]), None)
            if not scenario:
                raise ApiError(404, "题目不存在。")
            if not data["silence"] and not data["answer"]:
                raise ApiError(400, "写一句你会发送的话，或选择不继续发消息。")
            return {"scenario": scenario, "answer": "（选择不继续发消息）" if data["silence"] else data["answer"]}
        messages = data["messages"]
        if sum(len(m["text"].encode("utf-16-le", errors="surrogatepass")) // 2 for m in messages) > 20000:
            raise ApiError(400, "聊天文本最多 20000 字。")
        if endpoint == "simulation":
            if messages[-1]["role"] != "me":
                raise ApiError(400, "请先发送你的回复。")
            if sum(m["role"] == "me" for m in messages) > data["config"]["rounds"]:
                raise ApiError(400, "已达到本次轮数，请结束并复盘。")
        elif not all(any(m["role"] == role for m in messages) for role in ("me", "other")):
            raise ApiError(400, "请至少标记一条“我”和一条“对方”的消息。")
        result = {"messages": messages}
        if endpoint == "recap":
            result["kind"] = data["kind"]
        if "config" in data:
            result["config"] = data["config"]
            result["persona"] = next(p for p in self.contracts["personas"] if p["id"] == data["config"]["personaId"])
        return result

    def check_output(self, endpoint, value, data):
        try:
            result = validate(value, self.contracts["outputs"][endpoint])
            if endpoint == "practice":
                for field, key in (("scores", "dimension"), ("interpretations", "tone"), ("rewrites", "style")):
                    if len({item[key] for item in result[field]}) != len(result[field]):
                        raise ValueError("字段重复")
                if any(item["quote"] not in data["answer"] for item in result["evidence"]):
                    raise ValueError("引用不在输入中")
            if endpoint == "recap" and any(not any(item["quote"] in m["text"] for m in data["messages"]) for item in result["moments"]):
                raise ValueError("引用不在原文中")
            return result
        except (ValueError, TypeError, KeyError):
            raise ApiError(502, "AI 反馈结构或引用不正确，本次结果未保存。请重试。") from None

    def analyze(self, endpoint, body):
        data = self.input_data(endpoint, body)
        if not self.configured:
            raise ApiError(503, "尚未配置 AI。请切换演示模式，或在服务端 .env 设置 AI_API_KEY 后重启。")
        base = self.environment.get("AI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
        url = urllib.parse.urlsplit(base + "/chat/completions")
        if not url.hostname or url.username or url.password or url.query or url.fragment:
            raise ApiError(503, "服务端 AI_BASE_URL 配置无效。")
        if url.scheme != "https" and not (url.scheme == "http" and url.hostname in ("localhost", "127.0.0.1")):
            raise ApiError(503, "AI 服务地址必须使用 HTTPS。")
        try:
            timeout = max(1, min(30, float(self.environment.get("AI_TIMEOUT_MS", "25000")) / 1000))
        except ValueError:
            timeout = 25
        task = self.contracts["tasks"][endpoint]
        payload = {"model": self.environment.get("AI_MODEL", "gpt-4.1-mini"), "temperature": 0.65, "max_tokens": 3500,
                   "response_format": {"type": "json_object"}, "messages": [
                       {"role": "system", "content": self.contracts["systemRules"] + "\n任务：" + task["task"] + "\nJSON 格式说明：" + json.dumps(task["shape"], ensure_ascii=False)},
                       {"role": "user", "content": json.dumps(data, ensure_ascii=False)}]}
        request = urllib.request.Request(urllib.parse.urlunsplit(url), data=json.dumps(payload).encode("utf-8"),
                                         headers={"Authorization": "Bearer " + self.environment["AI_API_KEY"], "Content-Type": "application/json"})
        for attempt in range(2):
            try:
                with self.opener.open(request, timeout=timeout) as response:
                    raw = response.read(200001)
                if len(raw) > 200000:
                    raise ApiError(502, "AI 返回内容过大，请重试。")
            except urllib.error.HTTPError as error:
                status = error.code
                error.close()
                if attempt == 0 and (status == 429 or status >= 500):
                    time.sleep(0.4)
                    continue
                raise ApiError(502, "AI 服务认证失败，请检查服务端密钥。" if status in (401, 403) else "AI 服务暂时不可用，请重试或切换演示模式。") from None
            except (urllib.error.URLError, OSError, socket.timeout):
                if attempt == 0:
                    continue
                raise ApiError(504, "AI 连接失败或超时，请重试或切换演示模式；Mac 证书错误请运行 Python 安装目录的 Install Certificates.command。") from None
            try:
                envelope = json.loads(raw)
                content = envelope["choices"][0]["message"]["content"]
                if not isinstance(content, str) or not 0 < len(content) <= 50000:
                    raise ValueError()
                value = json.loads(content)
            except (ValueError, KeyError, IndexError, TypeError):
                raise ApiError(502, "AI 返回格式无效，本次内容未记入学习记录。请重试。") from None
            return self.check_output(endpoint, value, data)
        raise ApiError(502, "AI 请求失败。")


class ChatServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, address, root=PORTABLE, environment=None):
        self.root = Path(root)
        self.runtime = AIRuntime(json.loads((self.root / "contracts.json").read_text(encoding="utf-8")), environment)
        self.ai_slots = threading.BoundedSemaphore(4)
        self.traffic = {}
        self.traffic_lock = threading.Lock()
        super().__init__(address, ChatHandler)


class ChatHandler(BaseHTTPRequestHandler):
    server_version = "ChatPracticeRoom"
    sys_version = ""

    def log_message(self, format, *args):
        pass  # Never log real chat, access tokens, or upstream content.

    def reply(self, status, content, content_type="application/json; charset=utf-8", head=False):
        raw = json.dumps(content, ensure_ascii=False).encode("utf-8") if isinstance(content, dict) else content
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "same-origin")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if not head:
            self.wfile.write(raw)

    def do_GET(self):
        path = urllib.parse.urlsplit(self.path).path
        if path == "/api/status":
            self.reply(200, {"app": "chat-practice-room", "aiConfigured": self.server.runtime.configured,
                             "accessRequired": bool(self.server.runtime.environment.get("APP_ACCESS_TOKEN")), "localDemo": True})
        elif path in ("/", "/index.html"):
            self.reply(200, (self.server.root / "index.html").read_bytes(), "text/html; charset=utf-8", self.command == "HEAD")
        else:
            self.reply(404, {"error": "文件或接口不存在。"}, head=self.command == "HEAD")

    def do_HEAD(self):
        self.do_GET()

    def do_POST(self):
        acquired = False
        try:
            endpoint = urllib.parse.urlsplit(self.path).path.removeprefix("/api/")
            if self.path != "/api/" + endpoint or endpoint not in ("practice", "simulation", "recap"):
                raise ApiError(404, "接口不存在。")
            origin = self.headers.get("Origin")
            if origin and (origin == "null" or urllib.parse.urlsplit(origin).netloc != self.headers.get("Host")):
                raise ApiError(403, "仅接受当前站点发起的请求。")
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                raise ApiError(400, "请求格式不正确。") from None
            if not 0 < length <= 80000:
                raise ApiError(413 if length > 80000 else 400, "输入为空或文本太长，请检查后重试。")
            self.connection.settimeout(15)
            try:
                body = json.loads(self.rfile.read(length))
            except (ValueError, OSError):
                raise ApiError(400, "请求内容格式不正确。") from None
            token = self.server.runtime.environment.get("APP_ACCESS_TOKEN")
            if token and not hmac.compare_digest(token.encode(), self.headers.get("X-App-Token", "").encode()):
                raise ApiError(401, "需要服务访问口令，请在设置页输入。")
            now = time.monotonic()
            with self.server.traffic_lock:
                self.server.traffic = {key: v for key, v in self.server.traffic.items() if now - v[0] < 60}
                start, count = self.server.traffic.get(self.client_address[0], (now, 0))
                self.server.traffic[self.client_address[0]] = (start, count + 1)
            if count >= 15:
                raise ApiError(429, "请求较多，请稍后重试。")
            acquired = self.server.ai_slots.acquire(blocking=False)
            if not acquired:
                raise ApiError(429, "请求较多，请稍后重试。")
            result = self.server.runtime.analyze(endpoint, body)
            self.reply(200, {"mode": "ai", "data": result})
        except ApiError as error:
            self.reply(error.status, {"error": str(error)})
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception:
            self.reply(500, {"error": "服务暂时出现问题，请重试。"})
        finally:
            if acquired:
                self.server.ai_slots.release()
