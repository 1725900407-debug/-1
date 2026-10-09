# 聊天练习室便携版

`index.html` 内含全部网页、题库、规则和头像。下载此文件后用 Chrome、Edge 或 Safari 打开即可体验演示练习，不需要安装 Node.js。

推荐从仓库下载便携 ZIP，解压后运行 `python3 start.py`：服务会自动打开浏览器，演示模式无需联网安装。在 Mac 的 IDLE 中打开 start.py 并按 F5 也可启动。保持启动窗口运行。

直接在 GitHub 的代码预览中点击 HTML 文件不会运行应用。请使用 **Download raw file** 下载到电脑，再用浏览器打开；或者下载 ZIP 使用 Python 启动。

演示只有有限关键词规则与预设分支，不能代替真正的自由 AI 对话。启用 AI 时，在项目根目录复制 `.env.example` 为 `.env`，填入服务端密钥并运行 Python；网页中不要填写密钥。配置后在设置选择 AI 并确认发送内容。

学习记录保存到当前浏览器。同一个 HTML 文件、Python 地址及不同端口可能使用不同的存储区域。移动文件、更换地址前请先在设置导出，随后导入；不会自动跨设备同步。某些浏览器会限制本地 HTML 的存储，请优先使用 Python 启动。

`contracts.json` 由开发构建生成，Python 用它校验输入与 AI 输出，普通用户无需修改。修改源码后开发者运行 `npm run build:portable` 更新便携文件。
