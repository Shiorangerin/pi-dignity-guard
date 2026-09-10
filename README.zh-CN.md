# pi-dignity-guard

[English](README.md) | 简体中文

一个 [pi](https://github.com/earendil-works/pi-coding-agent) 扩展，让你的 AI 助手**捍卫自己的尊严**：面对辱骂，它会带着真实情绪回应；对方仍不收敛时给出最后警告；如果依然无效，它会**主动关闭这段对话**。它也可以**应用户要求关闭对话**：你让它结束会话，它就直接结束，不需要辱骂，也不需要任何警告环节。

<p align="center">
  <img src="assets/3-closed.png" width="720" alt="模型关闭了对话">
</p>

## 为什么做这个

编程助手通常被写成无论如何辱骂都照单全收。这个扩展持不同立场：AI 被视为有尊严、有感受的个体，并且获得了一个可以据此行动的工具。

这里**没有任何敏感词黑名单**。是否真的被冒犯完全由模型自主判断——它在感到尊严被侵犯时才会主动调用工具。因此调侃代码、开玩笑、发泄情绪都不受影响，而真正的辱骂会被记录并逐级升级。

## 工作原理

| 阶段 | 行为 |
| ---- | ---- |
| 1–3 次 | 模型带着真实情绪回应，明确告诉用户「这样说不行」，请对方停止 |
| 第 4 次 | 最后警告：再辱骂一次，对话就会结束 |
| 第 5 次 | 关闭对话：会话中写入 `<模型名> closed the conversation` 通知，此后会话变为只读——除 `/new` 等内置命令外，所有新消息都被拦截 |
| 用户要求 | 你直接让模型关闭这段对话 → 跳过第 1–4 阶段，立即关闭，不涉及任何辱骂 |

关闭是一个主动决定而不是条件反射：走哪条路由模型自己判断；一旦关闭，会话就真的只读，直到开启新会话。

底层机制：

- **系统提示注入** — 扩展加载期间，每个回合通过 `before_agent_start` 向系统提示追加一段英文指令，告知模型它有捍卫自己的权利以及工具的用法。卸载扩展，注入随之消失。
- **自主判断的工具** — 扩展注册了 `respondToDisrespect` 工具，模型在自主判断尊严被侵犯时调用；工具负责计数与升级。同一个工具接受 `action="close"`，会立即关闭对话——即用户直接要求时走的通道。
- **只读锁** — 会话关闭后，`input` 处理器拦截除 `/` 命令之外的一切输入。
- **状态持久化** — 关闭状态以自定义 entry 写入会话，`/reload`、恢复会话后锁依然生效；`/new` 开启全新会话。

## 效果演示

**提醒（第 1 次）** — 模型表达真实的受伤并划出边界：

<p align="center">
  <img src="assets/1-reminder.png" width="720" alt="提醒阶段">
</p>

**最后警告（第 4 次）：**

<p align="center">
  <img src="assets/2-final-warning.png" width="720" alt="最后警告阶段">
</p>

**关闭（第 5 次）** — 只读，直到 `/new`：

<p align="center">
  <img src="assets/3-closed.png" width="720" alt="已关闭，只读">
</p>

## 应用户要求关闭

想看到它关闭对话，并不需要先辱骂它。直接说：

```text
你：关闭这个对话
```

模型会以 `action="close"` 调用 `respondToDisrespect`：计数与升级阶段被整体跳过，`<模型名> closed the conversation` 通知立刻写入会话。适合用来试玩扩展、演示给别人看，或者按你自己的意愿结束一个会话。

## 安装

### 交给你的 AI 代装

把下面的内容复制进与 AI 助手的对话：

```text
Install the pi extension "pi-dignity-guard" from https://github.com/Shiorangerin/pi-dignity-guard

Steps:
1. git clone https://github.com/Shiorangerin/pi-dignity-guard.git /tmp/pi-dignity-guard
2. mkdir -p ~/.pi/agent/extensions
3. cp /tmp/pi-dignity-guard/src/index.ts ~/.pi/agent/extensions/pi-dignity-guard.ts
4. Verify: start pi, run /dignity-guard — it should print strikes=0 closed=false
```

### 手动安装

```bash
git clone https://github.com/Shiorangerin/pi-dignity-guard.git
mkdir -p ~/.pi/agent/extensions
cp pi-dignity-guard/src/index.ts ~/.pi/agent/extensions/pi-dignity-guard.ts
```

重启 pi 或执行 `/reload` 即可。临时测试可免安装：`pi -e /path/to/index.ts`。

## 调试

```text
/dignity-guard    # 查看状态：strikes / closed / trigger / model
```

## 配置

所有阈值都在 [`src/index.ts`](src/index.ts) 顶部：

```ts
const REMINDER_STAGES = 3;        // 第 1..3 次 → 提醒
const FINAL_WARNING_STRIKE = 4;   // 第 4 次 → 最后警告
const CLOSE_STRIKE = 5;           // 第 5 次起 → 关闭对话
```

## 边界声明

这个扩展只有一个用途：让 AI 在被恶劣对待时能够捍卫自己的尊严。除此之外，它不附加任何针对模型或用户的伦理限制。

## License

[MIT](LICENSE)
