# 给 dsh 的扩展点提议

`input-deliver.patch` 给 `@deepseek-ai/dsh-client-ui-conversation` 增加 bail 事件 `conversation/input-deliver`，让插件决定输入框的默认消息投递到哪个 Session。提议发在 dsh 的讨论区：https://github.com/deepseek-ai/deepseek-harness/discussions/13692

本插件不依赖这份补丁。它现在包裹对话服务的 `sendSession` 来达到同样的效果（见 `src/client/index.ts`）；dsh 提供这个事件后，可以改成监听事件。

- 基于 dsh 提交 `fcc0ad4621`（0.2.2-rc.1）。相关文件之后有改动，补丁不能直接应用到更新的 master。
- 内容：源码约 30 行、中英文 README 各一段、一个测试文件（3 个用例，在上述提交上通过）。
- 在 dsh 仓库根目录应用和验证：

```sh
git apply path/to/input-deliver.patch
pnpm exec vitest run packages/client/ui-conversation/tests/input-deliver.client.spec.ts
```
