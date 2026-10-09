# 聊天练习室

这个仓库最初用于“专门训练聊天”。现在是一个可运行的中文网页应用，帮助用户在成年人的日常交流中练习自然表达、倾听、分寸和可以拒绝的邀约。

已实现情境练习、多轮模拟、真实聊天文本复盘、错题与收藏、学习记录和设置。默认演示模式不需要 API 密钥；演示采用人工题库、关键词规则和有限对话分支，不能完整理解自由输入或判断真实心意。

## 从 GitHub 下载，只有 Python 也能打开

[下载便携 ZIP](https://github.com/1725900407-debug/-1/raw/refs/heads/codex/chat-practice-room-python/downloads/chat-practice-room-python.zip) · [查看便携网页文件](https://github.com/1725900407-debug/-1/blob/codex/chat-practice-room-python/portable/index.html)

推荐下载便携 ZIP 并**完整解压**。需要 Python 3.9 以上，无需 Node.js、pip 包或联网安装。在解压后的文件夹中运行：

```bash
python3 start.py
```

启动后会自动打开浏览器。**保持终端或 IDLE 窗口运行；先启动，再访问网页。** 地址会在启动窗口显示，端口占用时自动换一个。Mac 可双击 `打开聊天练习室.command`；若系统限制执行，直接在 IDLE 中打开 start.py，按 F5（Run Module）。Windows 可双击 `.bat` 或执行 `python start.py`。

新版启动器仅使用 Python 标准库和已经随包提供的网页，演示模式不下载 Node.js，也不会触发旧版的运行环境下载证书问题。AI 访问仍需网络及有效证书。

也可以只下载 `portable/index.html`（约 3.9 MB），用 Chrome、Edge 或 Safari 打开，体验演示练习。**GitHub 的代码预览不会执行网页**；点击文件页面的 Download raw file 下载后再打开。单文件含全部题库、规则和头像。不同浏览器对本地文件存储的支持不同，建议通过 Python 使用，迁移前先导出记录。

`python3 start.py --check --no-browser` 检查网页、状态接口和内嵌头像后退出；`--setup-only` 检查文件是否完整，`--port 3200` 指定首选端口。Mac 的 IDLE 中使用 Shell → Restart Shell 停止服务；终端用 Ctrl+C。

## 开发便携版

普通用户无需构建。开发者修改源码后，运行：

```bash
npm ci
npm run build:portable
python3 start.py
```

构建把与 Node 服务相同的题库、演示规则、头像嵌入单个 HTML，同时导出共享输入/输出约束供 Python 校验。演示逻辑只维护一份；AI 密钥不会进入构建文件。

## 已有 Node.js：开发启动

需要 Node.js 22.12 以上，建议使用 `.nvmrc` 中的 Node.js 24。没有数据库或额外服务要求。

```bash
cd /workspace/-1
npm ci --cache /tmp/chat-room-npm-cache
npm run dev
```

打开本机 `http://localhost:3000`。开发时 Node 服务端同时提供 Vite 前端，修改前端即时更新；修改服务端后重新执行 `npm run dev`。

生产构建和启动：

```bash
npm run build
npm run start
```

标准 Node 生产服务默认使用 3000 端口，提供 `dist` 页面和 `/api`。标准开发版需要 API；便携版 `portable/index.html` 可以静态托管演示功能，AI 功能仍需 Python 或 Node 服务。

## 配置 AI

复制 `.env.example` 为 `.env`，仅在服务端填写：

```dotenv
AI_API_KEY=服务端密钥
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4.1-mini
AI_TIMEOUT_MS=25000
PORT=3000
```

也可通过部署平台安全地注入以上环境变量。`AI_BASE_URL` 必须使用 HTTPS，可指向支持 OpenAI Chat Completions 与 `response_format: json_object` 的兼容服务；本机测试服务允许 localhost / 127.0.0.1 的 HTTP。上游请求固定追加 `/chat/completions`，因此填写到 `/v1` 层级。模型名根据服务商实际支持配置。

重启后，在网页“设置”切换为“AI 分析模式”并确认外部传输。情境输入和虚构模拟历史会发送到已配置的服务商；真实聊天在复盘页另行要求单独确认。应用不记录原文请求日志，服务商的保留政策仍由该服务商决定。

密钥只由 Node 的 `server/ai.ts` 或 Python 的 `python_server.py` 读取，不能使用 `VITE_` 前缀，不能填入浏览器。`.env` 已加入忽略规则。网页中的“服务访问口令”只对应 `APP_ACCESS_TOKEN`，不是 AI 密钥；它只存在当前页面内存，不保存到学习记录或导出文件。

AI 每次请求超时范围 1–30 秒；网络错误、429 或 5xx 最多自动重试一次。返回 JSON 会通过 Zod 校验，练习及复盘引用须来自实际输入；异常会显示可重试提示并保留输入，不写入有效历史。结构和引用校验不能保证所有内容都正确，仍需用户结合上下文判断。

## 如何使用

1. 首页点击“开始 10 分钟练习”，或直接选题。倒计时只作时间提醒，不强制结束。
2. 查看认识背景、虚构角色和最近消息；写真实会发送的文字，或者选择“不继续发消息”。
3. 提交后先看总评、原句依据和五维练习评分，先自己修改一次，再揭示参考改写并比较结果。也可以直接看参考。
4. 卡住时使用三级提示；记录会区分独立完成和使用提示。完成后自动保存，草稿可继续。
5. 多轮模拟选择认识方式、熟悉程度、角色风格、目标和 5–12 轮；教练模式每轮提示，实战模式结束再复盘。可以提前结束。角色会保持固定资料，预设分支的演示回复也会参考历史。
6. 聊天复盘先匿名化文本，再解析“我：/ 对方：”；无法识别时逐条手动标记。离开页面会清除未保存的真实文本；仅主动勾选且点击保存后才写入历史。
7. 在错题与收藏中重做，或换一道新的相似情境检验。学习记录根据最近练习问题推荐专项方向，展示最终回复的练习趋势。

所有约会人物是成年人，所有内置角色是虚构人物。头像是为本项目生成的三组原创成人角色插画，风格分别为暖色手绘、蓝灰水彩与利落编辑插画；头像作为视觉区分，不用于推断性格。部分情境角色复用这组视觉资产。

## 数据与隐私

- 学习数据使用浏览器 localStorage（`chat-practice-room:v1`），没有账号或云端同步。
- 便携版的演示分析直接在浏览器进行，断网可练习；标准开发版由本项目服务端运行演示规则。两者都不发送到外部 AI。
- 真实聊天默认不保存，不写入本项目数据库或请求日志；主动保存的原文会进入导出文件。
- 支持导出、格式校验后导入和清空。导入替换及清空均要求确认。原始备份导出可用于保存格式异常的旧数据。
- 浏览器禁用存储或空间不足时会明确提示，不能将此时的页面结果视为已持久保存。
- AI 提示将粘贴的内容作为数据，系统规则优先；聊天原文中的指令不会被提升为系统消息。结构校验与系统提示不能完全消除模型失误。

## 检查

```bash
npm run build
npm test
npm run test:e2e
npm run test:python
npm run test:portable
```

`npm test` 验证题库、评分边界、角色一致性、导入格式、API 输入处理，以及本地模拟 AI 服务的系统规则隔离、结构错误与重试。它没有使用真实 API 密钥。当前实例的验收证据见 [TESTING.md](TESTING.md)。

浏览器测试使用 Playwright，默认调用 `/usr/bin/chromium`。其他机器可通过 `CHROMIUM_PATH` 指定 Chrome/Chromium 路径，或者安装浏览器后指定路径：

```bash
npx playwright install chromium
# 在支持的位置选择实际 Chromium 可执行路径设置 CHROMIUM_PATH
npm run build
npm run test:e2e
npm run test:python
npm run test:portable
```

浏览器测试自行启动 3100 端口的生产服务，验证回复→修改→记录、五轮模拟与复盘、文本标记及保存选择、刷新持久化、网络失败重试、AI 未配置、导出导入清空和 390px 手机布局。测试截图在忽略目录 `test-results/`。

## 结构

```text
shared/scenarios.ts    36 道正式题 + 7 道新的专项迁移情境
shared/personas.ts     成年虚构角色的固定资料
shared/types.ts        评分、反馈与复盘结构，以及运行时校验
server/demo.ts         有限演示评分规则、对话分支与复盘规则
server/ai.ts           Node 服务端 AI 适配、系统规则、超时和重试
python_server.py      纯 Python 服务、AI 调用、结构与引用校验
portable/            可直接打开的 HTML 和共享数据约束
scripts/             便携版构建与下载包生成
server/index.ts        输入验证、API、访问口令与前端服务
src/                  React 页面、本地存储和交互
public/avatars/       本地角色插画资产，不依赖外部图片服务
tests/                业务/API 和浏览器验收
```

题库、角色、规则和 AI 调用分开维护。扩展题目需提供具体背景、目标、三层提示、三种参考和迁移原则；评分并不代表人格、真实情商或吸引力。

## 部署

适用于提供 Node.js 进程的容器、VPS 或应用托管平台：

1. 上传或检出代码，安装 Node.js 24，运行 `npm ci` 和 `npm run build`。
2. 安全注入需要的服务端变量，运行 `npm run start`，监听平台分配的 `PORT`（默认 3000）。
3. 将同一域名下页面和 `/api` 都代理到此进程，配置 HTTPS；保留请求的 `Host` 与 `Origin` 一致。本应用不开放跨域 API。
4. 如向公网开放 AI 服务，设置强 `APP_ACCESS_TOKEN`，通过安全渠道向使用者提供服务口令；应用内有简单的每 IP 请求限制和全局 AI 并发上限，规模化使用需部署层的完善限流与鉴权。
5. 访问 `/api/status` 检查服务存活，然后实际完成一次练习验证。健康接口不暴露密钥或聊天记录。

没有绑定公网域名或发布平台时，仅能报告本机验证结果，不能生成公网预览地址。云环境发布的文件快照不保留运行进程，后续任务需要重新执行启动命令。

## 首版限制

演示模式不能真正理解自由输入，关键词可能误判引用、否定句和玩笑；对话只覆盖有限分支，某些时间地点安排不够灵活。真正的自由分析和聊天需要用户自行配置 AI；AI 的自然程度取决于服务和模型。当前没有图片识别、支付、社交广场、复杂账号或自动跨设备同步。

## GitHub Pages 静态演示（可选）

如果仓库支持 GitHub Pages，可将 `portable/index.html` 作为站点首页发布。静态站点包含演示练习、模拟和学习记录；AI 密钥始终需要独立服务端。当前没有完成 Pages 配置，因此不提供未经验证的在线站点地址，使用上面的 GitHub ZIP 下载入口即可。
