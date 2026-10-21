# 参与贡献

[English](CONTRIBUTING.md) | 中文

感谢你对 XPeach Harness 的关注。

本仓库是 [🍑Code](https://xpeach.codes) 中转站的客户端。它构建在「一切皆插件」的内核之上，
所以大部分改动应该落在一个包里，而不是铺满整个代码树。

## 开始之前

- 读 [`docs/architecture.zh.md`](docs/architecture.zh.md) 了解包结构。
- 读 [`AGENTS.md`](AGENTS.md) 了解本仓库的约定，包括预发布 API 与会话数据的规则。
- 提 PR 之前先跑通 `pnpm run build` 和相关测试。

## 你可以怎么帮

- **报一个 bug。** 在 [GitHub Issues](https://github.com/yellowpeachxgp/xpeach-harness/issues)
  里附上应用版本、平台，以及你能做到的最小复现。
- **要一个模型或线路。** 分组和模型由站点提供，不由本客户端决定。告诉我们你的令牌调不到什么，
  我们会去查中转站那一侧。
- **改进客户端。** 界面插槽、工具、模型适配都是独立插件包，针对其中一个提一个聚焦的 PR 最容易审。

## 提交 PR

- 一个 PR 只做一件事，并说明用户能感知到的变化。
- 跟随周围的代码风格；CI 会做强制的格式化与类型检查。
- 为你改动的行为补测试或更新测试。快照与 fixture 跟随产品，用测试文件里写明的命令刷新。

## 许可

提交贡献即表示你同意以 [MIT 许可证](LICENSE) 授权你的贡献。
