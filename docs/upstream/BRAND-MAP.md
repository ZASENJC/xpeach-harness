# 品牌映射表（Brand Map）

本表是**改名的唯一事实来源**。`pnpm run brand:map` 依据它批量改名，
`pnpm run brand:check` 依据它反向检查漏网。

## 命名空间

| 旧（上游） | 新（XPeach） | 说明 |
|---|---|---|
| `@deepseek-ai/dsh-*` | `@xpeach/xph-*` | 全部工作区包 |
| `@deepseek-ai/cordis-plugin-*` | `@xpeach/xph-cordis-plugin-*` | 插件内核扩展 |
| `@deepseek-ai/schemastery` | `@xpeach/xph-schemastery` | 配置 schema |
| `@deepseek-ai/cosmokit` | `@xpeach/xph-cosmokit` | 工具集 |

> 注意：`vendor/` 下的第三方包（cosmokit、cordis）只在其 `name` 字段改，
> 源码内的 API 名称不变——它们是被引用的库，改名只在包标识层面。

## 可执行入口

| 旧 | 新 |
|---|---|
| `dsh` | `xph` |
| `dsh-desktop-host` | `xph-desktop-host` |
| `DeepSeek Harness`（应用名） | `XPeach Harness` |

## 运行时标识

| 旧 | 新 | 说明 |
|---|---|---|
| `DSH_HOME` | `XPH_HOME` | 数据根（已迁移，保留 `DSH_HOME` 兜底读取） |
| `~/.dsh` | `~/.xph` | 默认数据目录 |
| `DSH_CLIENT_*` | `XPH_CLIENT_*` | 客户端构建注入（保留旧名读取） |
| `dsh-app://` | `xph-app://` | 自定义协议 |
| `com.deepseek.harness` | `codes.xpeach.harness` | Bundle ID |
| `dsh-YYYY-MM-DD-xxxx`（PAT） | `xph-YYYY-MM-DD-xxxx` | 站点令牌前缀 |

> **兼容读取保留**：运行时仍接受旧的 `DSH_*` 环境变量与旧 PAT 前缀，
> 让已有安装能平滑升级。新写入一律用 `XPH_*`。

## 文档与链接

| 旧 | 新 |
|---|---|
| `deepseek-harness.github.io` | `xpeach.codes` |
| `github.com/deepseek-ai/deepseek-harness` | `github.com/yellowpeachxgp/xpeach-harness` |
| `discord.gg/4MrtZUhpxg` | （无对应，删掉） |

## 不改的东西

以下保留原样，因为它们是被调用的**外部协议/库的真实名称**，改了会断：

- npm 依赖里的第三方包名（`react`、`typescript`、`@aws-sdk/*` 等）
- `vendor/` 内第三方包的**源码 API**（如 `cordis` 的 `Context`）
- 模型 ID（`deepseek-v4-flash` 等）——那是站点的真实模型名
- `~/.dsh` 的**只读导入源**——那是用户旧数据的位置
