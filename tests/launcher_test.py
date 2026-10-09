"""Only Python is needed: validate a clean package, occupied port, and secret isolation."""
import importlib.util
from pathlib import Path
import json
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import start as launcher


class LauncherTests(unittest.TestCase):
    def test_python_only_clean_directory_with_chinese_and_spaces(self):
        with tempfile.TemporaryDirectory(prefix="聊天练习 空格-") as directory:
            target = Path(directory)
            for name in ("start.py", "python_server.py"):
                shutil.copy2(ROOT / name, target / name)
            shutil.copytree(ROOT / "portable", target / "portable")
            result = subprocess.run([sys.executable, str(target / "start.py"), "--check", "--no-browser"], capture_output=True, text=True, timeout=15)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertIn("检查通过", result.stdout)
            self.assertFalse((target / "node_modules").exists())
            self.assertFalse((target / ".runtime").exists())

    def test_occupied_port_falls_back(self):
        with socket.socket() as blocker:
            blocker.bind(("127.0.0.1", 0))
            port = blocker.getsockname()[1]
            server = launcher.start_server(port)
            try:
                self.assertNotEqual(server.server_address[1], port)
            finally:
                server.server_close()

    def test_only_webpage_and_status_are_exposed(self):
        server = launcher.start_server(3200)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        local = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        base = "http://127.0.0.1:" + str(server.server_address[1])
        try:
            launcher.functional_check(server.server_address[1])
            for path in ("/.env", "/python_server.py", "/portable/contracts.json", "/../.env"):
                with self.assertRaises(urllib.error.HTTPError) as error:
                    local.open(base + path)
                self.assertEqual(error.exception.code, 404)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
