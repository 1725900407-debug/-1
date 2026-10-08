"""Python 启动器的跨平台选择、下载校验和解压边界测试。"""
import importlib.util
import io
from pathlib import Path
import socket
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("launcher", Path(__file__).resolve().parents[1] / "start.py")
launcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(launcher)


class LauncherTests(unittest.TestCase):
    def test_mac_intel_apple_and_windows_architecture(self):
        self.assertEqual(launcher.platform_target("Darwin", "arm64"), "darwin-arm64.tar.gz")
        self.assertEqual(launcher.platform_target("Darwin", "x86_64"), "darwin-x64.tar.gz")
        self.assertEqual(launcher.platform_target("Windows", "AMD64"), "win-x64.zip")
        self.assertEqual(launcher.platform_target("Linux", "aarch64"), "linux-arm64.tar.gz")
        with self.assertRaises(RuntimeError):
            launcher.platform_target("UnknownOS", "x86")

    def test_bad_checksum_is_never_used(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "node.tar.gz"
            with patch.object(launcher.urllib.request, "urlopen", return_value=io.BytesIO(b"bad download")):
                with self.assertRaisesRegex(RuntimeError, "校验失败"):
                    launcher.official_download("node.tar.gz", "0" * 64, target)
            self.assertFalse(target.exists())
            self.assertFalse(target.with_suffix(".gz.part").exists())

    def test_archive_cannot_escape_destination(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            archive = base / "archive.tar.gz"
            with tarfile.open(archive, "w:gz") as target:
                member = tarfile.TarInfo("../outside.txt")
                member.size = 4
                target.addfile(member, io.BytesIO(b"test"))
            destination = base / "unpacked"
            destination.mkdir()
            with self.assertRaisesRegex(RuntimeError, "已停止"):
                launcher.unpack(archive, destination)
            self.assertFalse((base / "outside.txt").exists())

    def test_occupied_port_falls_back(self):
        with socket.socket() as server:
            server.bind(("127.0.0.1", 0))
            port = server.getsockname()[1]
            self.assertNotEqual(launcher.available_port(port), port)


if __name__ == "__main__":
    unittest.main()
