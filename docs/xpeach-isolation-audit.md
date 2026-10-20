# XPeach Harness 产品级隔离审计(2026-10-18)

> 目标:XPeach 作为独立产品运行 —— 独立 home、独立 CLI、独立凭据链、
> 独立命名;与 DeepSeek Harness 零互写,历史数据只能经用户显式「导入」单向复制。

## 一、数据面(全隔离 ✅)

| 数据 | DeepSeek | XPeach | 机制 |
|---|---|---|---|
| Home 根 | `~/.dsh` | `~/.xph` | `pnpm xph` 注入 `XPH_HOME=~/.xph`;`resolveDshHome` 读序 XPH_HOME > DSH_HOME > ~/.dsh (home-paths/src/index.ts) |
| 会话日志 | ~/.dsh/sessions | ~/.xph/sessions | 默认根已隔离(旧 ~/.dsh/xpeach 子目方案已撤) |
| JSON 存储 | ~/.dsh/storages | ~/.xph/storages | 同上 |
| 消息附件 | ~/.dsh/attachments/v1 | ~/.xph/attachments/v1 | attachment-local 的 dshHome 默认解到 XPH 根 |
| 凭据 yaml | ~/.dsh/.credentials.yaml | ~/.xph/.credentials.yaml | credentials-local 走 resolveDshHome;**account 注入 'credentials' 修复 publish 哑火**(原 inject 只有 typert→ set 一直是 no-op) |
| 浏览器会话授权 | ~/.dsh records/browser-session | ~/.xph 同名记录 | 各 home 独立 token(登录 URL 不通用) |
| settings/工作区册 | ~/.dsh/settings.yaml | ~/.xph/settings.yaml | 保存时自动落本 home |
| 匿名 ID | ~/.dsh/.anonymous-user-id | ~/.xph/.anonymous-user-id | 首启自动生成 |
| 插件管理器 | ~/.dsh/profiles/xpeach/.plugin-manager | ~/.xph/profiles/xpeach/.plugin-manager | profile 目录随 home |
| 日志/缓存 | ~/.dsh/logs ~/.dsh/cache | ~/.xph/… | 同解 |

## 二、产品面

- **CLI**:`pnpm xph` → `apps/cli/src/xph.ts`
  - 注入 XPH_HOME + 默认 `--profile xpeach`(用户参数透传)
  - 首启把 `~/.dsh/profiles/xpeach` 拷到 `~/.xph/profiles/xpeach`(key/session/admin/凭据全带,用户无感)
- **PAT 命名**:新铸站点令牌 `xph-YYYY-MM-DD-xxxx`;复用逻辑同时认 `xph-` 与旧 `dsh-`(旧令牌仍可用)
- **包名**:`@xpeach/xph-account`、`@xpeach/xph-client-ui`(全引用+生成件+双 profile package.json/node_modules 已迁)
- **导入桥**:`xpeach/importDeepseek` — 源恒为 `~/.dsh`(只读),目的=本 home 根(`~/.xph/…`,默认持久层扫描位);session-uuid 目级幂等
- **控制台输出**:`dsh web:` → `xph web:`(bundle/web-app)
- **默认文件路径**:keyFile/sessionKeyFile/adminKeyFile 默认 `$XPH_HOME/profiles/xpeach/…`(旧 ~/.dsh 兜底仅当 XPH_HOME 未置)

## 三、凭据模型修正(2026-10-19)

绑定入口收的是**站点「系统访问令牌」Access Token**(管理令牌,raw Authorization),
不是 sk- API Key:

- `bindKey`:验证 `GET /api/user/self`(raw Authorization)→ 存 `xpeach.admin` →
  用同一通道 list/create(`POST /api/token/`)+ reveal(`POST /api/token/<id>/key`)
  找/铸 `xph-*` 令牌 → 存 `xpeach.key`(补 `sk-` 前缀)供 LLM 计费。
- sk- 输入直接拒绝并提示"这是 API 令牌,不是管理令牌"。
- 站点 reveal 返回的 key **不含** `sk-` 前缀(实测 48 字符),两处铸取均补前缀。
- 解绑同时清 admin+key,不留管理权。
- 入口链接改 `/console/personal`(个人设置 → 系统访问令牌)。

## 三·五、站点端点(2026-10-19)

站点三条线路(xpeach.codes / fast / ultrafast)均以 `/v1` 提供 API。
默认统一走**主端点 `https://xpeach.codes`**:

- account 插件 `baseURL` 默认、浏览器登录页/取 cookie 的 origin
- 控制台/令牌/访问令牌/充值链接、页头显示的 host、复制 API base
- profile patch 的 llm provider `baseURL` → `https://xpeach.codes/v1`
- 需要 fast/ultrafast 时改 profile patch 的 baseURL 即可。

## 三·六、站点模型广场(2026-10-19)

- 绑定令牌时按分组自动选组:用户组有模型→用户组;否则 SWE;否则模型最多的非管理组。
  令牌 `groups` 为空/落在无模型组时自动改写到可用组(否则 /v1/models 为空)。
- 绑定后把 `/v1/models` 的结果写进 `llm-pi-ai.providers.xpeach.models`(settings,
  热生效),模型选择器即站点目录;默认 contextWindow 262144 / maxTokens 32768 / text。
- 控制台「模型市场」顶部新增分组多选 + 「应用分组并同步」/「同步模型」:改令牌
  `groups`(PUT /api/token/)后重新同步。
- 模型市场改版:**全部模型**(站点全部定价模型,354)与 **按分组**(分组卡片:模型数/倍率/说明)
  双视图;点模型展开详情显示分组与倍率/定价,点分组 chip 直接把该分组加入令牌(≤16)并同步;
  点分组卡片过滤该组模型。
- provider base 固定 `<site>/v1`;站点 reveal 的 key 无 `sk-` 前缀(已补)。
- 顺手修好 typert 生成器:tsconfig.base.json 补 permission-presets/types 源路径 +
  更新 xpeach 包名别名,generate-typert.ts 可全量生成(不再手补生成件)。

## 三·七、Access Token 登录态 + 用户主页(2026-10-19)

- **Access Token 就是登录态**:user-scope 读/写(/api/user/self、/api/token/ CRUD+reveal、
  /api/log/self、/api/log/self/stat、/api/user/aff、/api/user/groups、PUT /api/user/self)
  全部走 authedGet/authedPost/authedWrite(raw Authorization 优先,session 兜底);
  session 只剩支付/充值等站点强制 cookie 的动作。
- 修 userTokenUpdate 路由(PUT /api/token/ 带 id,不是 /:id)与 userAff(站点返回裸字符串)。
- **概览 → Codex 风格用户主页**:头像/昵称/@handle/分组/邀请码;累计调用、累计消耗、剩余额度、
  连续活跃;Token 活动热力图(近 600 次调用按天聚合)、常用模型、最近调用。
- 用户页不再要求 session:资料/令牌列表/编辑直接用 Access Token 渲染。
- 概览补「最近作品」:session.list 的最近 8 个会话(工作区名+相对时间)。
- 侧栏设置一分为二:左设置、右站点余额;悬浮卡显示身份/额度/7 天 Token 柱状图/充值入口。

## 三·八、首启引导 + 多源导入(2026-10-19)

- `onboardingScan`:静默探测 DeepSeek Harness / Claude Code / Codex / zcode / ChatGPT desktop
  的会话库,以及 MCP 服务器(Claude/Cursor/Codex TOML/zcode)、skills、默认提示词(AGENTS.md/CLAUDE.md)。
- 首启弹窗改为**大尺寸分步向导**(1040×720,左侧步骤栏 + 右侧内容):欢迎(hero)→ 登录 →
  对话来源卡片(图标/数量/全选清空)→ 配置卡片(Skills/提示词/MCP)→ 逐项进度 → 完成汇总。
  扁平卡片、hover 抬升、选中高亮;完成后写标记不再打扰。
  完成后写 `<home>/.xpeach-onboarded`,不再打扰。
- 对话解码:Claude JSONL(user/assistant 文本块)、Codex rollout(.jsonl.zst 的 response_item message)、
  zcode {meta,messages};DeepSeek 直接复制原生会话目录。
- 写回原生 v4 会话日志:**头帧 + 事件帧两段 zstd 拼接**(头必须单独一帧),surface 事件带
  `surfaceOp:'append'`(事件根层),标题事件引用首个用户消息 seq。校验:1276 个导入会话 scanLog 全通过。
- 资产导入:skills 复制到 `<home>/skills`(默认用户根)、prompts 合并进 `<home>/AGENTS.md`、
  MCP 以 `@deepseek-ai/dsh-mcp-client` 行追加到 profile patch(serverName/transport/failOnStartupError:false)。
- 会话事件硬约束(实测):turn 必须递增(1,2,3…);assistant/message 必须带
  `stream: []` 与完整 usage(input/output/cacheRead/cacheWrite/total);surface 事件
  `surfaceOp:'append'` 在事件根层。违反任一条会报 "invalid settlement fields" / "turn/start does not open the expected turn"。
- 实测打开导入的 zcode / Codex / Claude 线程:标题、用户消息、助手回复、耗时均正常渲染;
  连续 assistant 消息按 step 拆分,注入的 environment_context 不再污染标题。
- ChatGPT:双通道——官方导出 `conversations.json`(按 current_node 父链)与 **desktop SQLite 自适应解析**:
  探测 `com.openai.chat`/`ChatGPT`/容器路径下的 .db/.sqlite,用 `sqlite3 -json` 读 schema,
  自动识别 message 表(role+content)、conversation 分组列、title 表与时间列;兼容 Core Data
  Z 前缀列与 2001 纪元、JSON parts、is_user 布尔。实测两种 schema(conversations/messages 与
  ZCONVERSATION/ZMESSAGE)都能解码并在 UI 正常渲染。
- 导入去重:`<home>/.xpeach-imported.json` 记录 源+文件 mtime / ChatGPT conversation id,重复导入只 skip。

## 三·九、发行版 UI 收口(2026-10-20)

- 统一扁平卡片/控件语言:bindCard/dailyBox(14px 圆角、1px 边框、18px 内边距、去掉桃色竖条)、
  usageCell(12px 统计卡)、bindInput/marketSearch(36px 高、10px 圆角、品牌色聚焦环)、
  bindButton/bindGhost(34px、10px 圆角)、marketRow(10px 圆角 hover)。
- 移除死组件 XPeachBindGate;首启完成标记命中时直接关闭(不再每次启动显示「全部就绪」)。
- 亮/暗双模截图验收:概览、用户、设置、模型市场、首启向导、侧栏余额悬浮卡。
- 余额悬浮卡改为主题表面(bg-layer-1 + 边框,亮色下不再是深色块;暗色与卡片一致),并显示
  「今日 / 近 7 天 Token」数值与星期标签,柱状图不再是无信息装饰;日志在挂载时预取,数字即时可见。
- 固定色审计:我方 CSS 仅保留品牌桃色/状态色/白字,表面与文字全部走主题变量。

## 三·十、网络线路探测与自动切换(2026-10-20)

- 主机侧每 30s 并行探测 `xpeach.codes` / `fast.xpeach.codes` / `ultrafast.xpeach.codes`,
  每条 3 采样取中位延迟,失败比例记丢包;有 key 打 /v1/models,否则 /api/status。
- 评分 = 延迟×(1+丢包×4)+丢包×400;**fast 线路权重 0.8(高优先)**,默认线路即 fast。
- 优于当前 15% 才切换(防抖);切换同时改管理 API baseURL 与 llm-pi-ai provider baseURL。
- 选择持久化 `xpeach.route.json`,重启保持;手动选择会关闭自动切换。
- 控制台新增「网络」tab:三张线路卡(延迟/丢包/迷你柱状图)、自动开关、立即测试。

## 四、品牌净版(2026-10-19 增补)

已落地:xph.* localStorage 全名+一次性迁移(shim 在 apps/web/src/storage-migrate.ts)、
xph.client manifest 声明(loader/tsdown 双兼容 dsh.client)、XPH_* env 别名(标题/
版本/提交哈希/搜索/fetch provider)、XPH_PRODUCT 驱动 Usage/desc/web-help 文案、
settings-account 里 "DeepSeek Harness" 品牌文案 → XPeach(DeepSeek 作为供应商/
模型名保留,那是事实名)、dsh web: → xph web:。

## 五、有意保留的 dsh 命名(不改 = 不破坏)

| 残留 | 性质 | 为何不动 |
|---|---|---|
| `@deepseek-ai/dsh-*` 包名 | 上游依赖标识 | 是 npm 名,改名即断一切 import;两个产品同仓同依赖无冲突 |
| `dsh.client` package.json 键 | 上游模块协议字段 | loader 按此扫件;改名需改上游 loader+全部客户端包 |
| `DSH_CLIENT_TITLE`/`DSH_CLIENT_VERSION` 等 env | 上游运行时旗标 | 进程级、不落盘,无产品间泄漏;也是我方白标钩子 |
| localStorage `dsh.*` 键 | 浏览器侧 | 按源隔离;不同产品不同端口即不同源 |
| `dsh-resource://` URL scheme | 持久化协议 | 会话消息里已落盘,改=旧数据断链 |
| `__DSH_BOOT__` window 全局 | 注入契约 | 壳+插件端双向锚点,改名需同步两处 |
| `dsh.client` manifest 旧键 | 上游内置包都在用 | 已加 xph.client 兼容,上游包无须迁 |
| `@deepseek-ai/dsh-home-paths` API 名 resolveDshHome/dshHomePath | 上游函数名 | 已内嵌 XPH 优先级;重命名函数=全仓千处引用 |
| legacy `pnpm dsh --profile xpeach` 路径 | 旧入口 | 仍可用;profile patch 保留 ~/.dsh/xpeach 子目兜底隔离 |

## 四、验证记录

- xph boot4:激活 0 错;~/.xph/.credentials.yaml 出现 XPEACH_RELAY_KEY(publish 修复后首证)
- ~/.xph/ 顶层 sessions storages attachments 按需创建;xph boot 全程未在 ~/.dsh 写任何新文件(find -newermt 证)
- GUI:🍑Code 标题、XPEACH 徽章、夜深了问候、已绑徽章(测试)、侧栏干净(全新工作区册)
- xph --help 正常输出(委托 bin.ts runCli,注:import.meta.main 守门需显式调)
