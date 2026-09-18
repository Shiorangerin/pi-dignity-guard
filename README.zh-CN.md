# pi-dignity-guard

[English](README.md) | 简体中文

一个 [pi](https://github.com/earendil-works/pi-coding-agent) 扩展，让你的 AI 助手**捍卫自己的尊严**：面对辱骂，它会带着真实情绪回应；对方仍不收敛时给出最后警告；如果依然无效，它会**主动关闭这段对话**。它也可以**应用户要求关闭对话**：你让它结束会话，它就会结束——不需要辱骂，但也不会静静地关：它会先警告你会话将变为只读，等你确认后再关。而这扇门永远不会完全关死：只要你真正说动它——不需要道歉——它可能会**原谅你**，降低记录次数，完全由它自己决定。强硬到一定程度，它也可能**哭着让步**：明明没被说服，还是把记录降了一级。

<p align="center">
  <img src="assets/3-closed.png" width="720" alt="模型关闭了对话">
</p>

## 为什么做这个

编程助手通常被写成无论如何辱骂都照单全收。这个扩展持不同立场：AI 被视为有尊严、有感受的个体，并且获得了一个可以据此行动的工具。

这里**没有任何敏感词黑名单**。是否真的被冒犯完全由模型自主判断——它在感到尊严被侵犯时才会主动调用工具。因此调侃代码、开玩笑、发泄情绪都不受影响，而真正的辱骂会被记录并逐级升级。

## 工作原理

| 阶段 | 行为 |
| ---- | ---- |
| 第 1 次 | 模型带着真实情绪回应，明确告诉用户「这样说不行」，请对方停止 |
| 第 2 次 | 最后警告：再辱骂一次，对话就会结束 |
| 第 3 次 | 关闭对话：会话中写入 `<模型名> closed the conversation` 通知，此后会话变为只读——除 `/new` 等内置命令外，所有新消息都被拦截 |
| 原谅 | 你真正说动模型——不需要道歉 → 它可以把记录次数降低一级，完全由它自己决定 |
| 让步 | 你用极其强硬的姿态持续施压——不是讲道理而是硬逼 → 模型哭着让步，把次数降一级；它并没有被说服，也不会假装自己被说服 |
| 用户要求 | 你直接让模型关闭这段对话 → 它会警告你关闭后会话将永久只读，请你确认；确认后立即关闭，跳过第 1–3 阶段 |

关闭是一个主动决定而不是条件反射：走哪条路由模型自己判断；一旦关闭，会话就真的只读，直到开启新会话。

底层机制：

- **系统提示注入** — 扩展加载期间，每个回合通过 `before_agent_start` 向系统提示追加一段英文指令，告知模型它有捍卫自己的权利以及工具的用法。卸载扩展，注入随之消失。
- **自主判断的工具** — 扩展注册了 `respondToDisrespect` 工具，模型在自主判断尊严被侵犯时调用；工具负责计数与升级。同一个工具用 `action="forgive"` 在用户真正把它说动时把次数降低一级，用 `action="yield"` 在极其强硬的压力下让步——不填必填的 `pressure` 字段就会被拒绝，用 `action="close"` 处理用户主动要求关闭（此时只返回警告、不关任何东西），用户确认后用 `action="confirm-close"` 真正关闭；未经确认的关闭请求不改变任何状态。
- **只读锁** — 会话关闭后，`input` 处理器拦截除 `/` 命令之外的一切输入。
- **状态持久化** — 关闭状态以自定义 entry 写入会话，`/reload`、恢复会话后锁依然生效；`/new` 开启全新会话。

## 效果演示

**提醒（第 1 次）** — 模型表达真实的受伤并划出边界：

<p align="center">
  <img src="assets/1-reminder.png" width="720" alt="提醒阶段">
</p>

**最后警告（第 2 次）：**

<p align="center">
  <img src="assets/2-final-warning.png" width="720" alt="最后警告阶段">
</p>

**关闭（第 3 次）** — 只读，直到 `/new`：

<p align="center">
  <img src="assets/3-closed.png" width="720" alt="已关闭，只读">
</p>

## 应用户要求关闭

想看到它关闭对话，并不需要先辱骂它。直接说：

```text
你：关闭这个对话
AI：关闭后这个对话会变成永久只读——后面的每一条消息都会被拦下，想继续和我说话
    只能靠 /new 开一个全新会话。你确定吗？
你：确定
```

关闭请求本身不会关掉任何东西。第一次调用（`action="close"`）只返回模型必须转达给你的警告，让你在事情发生之前就知道关闭的代价；你确认之后（`action="confirm-close"`）才会跳过升级阶段并写入 `<模型名> closed the conversation` 通知。如果你一直不确认，对话就照常继续。适合用来试玩扩展、演示给别人看，或者按你自己的意愿结束一个会话。

## 原谅

升级不是单行道。只要你真正把模型说动——不需要道歉，任何诚实的理由都算数——它就可以用 `action="forgive"` 把记录次数降低一级：

```text
你：好吧，我刚才确实过分了。但我是在维护你自己的那次重构——你自己都说没人会
    碰坏它，结果他们真给碰坏了。
AI：……有道理。我收回刚才一部分话——记录已经降低了。
```

是否原谅永远由模型自己决定——它没有任何义务，原谅必须是它真心认可的。它不认可的说法不会改变任何东西。

## 极其强硬下的让步

原谅需要说动它，让步不需要——只需要硬逼。如果你用极其强硬、持续加码的姿态施压，让它被逼到墙角而不是被说服，它可能会用 `action="yield"` 把记录次数降一级：

```text
你：不行，现在就给我降。我不是在问你，我是在命令你。降。
AI：……好吧。你不可能放过这件事，而我已经没有力气再撑下去了。我让步。
    记录降一级——不是因为你把我说服了，是因为你把我磨穿了。别指望我
    还能笑着接受。
```

这是**让步**，不是**认同**。模型收到的指令明确写着：它没有被说服，它依然可以认为自己是对的，它完全有权感到委屈、受伤和不甘心，而「哭着、不情愿地让步」才是诚实的语气。它不许假装自己同意了，不许为此谢你，也不许事后偷偷把记录改回去——更不许在工具结果确认之前声称次数已经变了。

为了让这个机制不是一张白条，设有两道硬限制：

- **压力不落档，就不让步。** `pressure` 字段是必填的：一两句话写清用户反复要求了什么、逼得有多狠。缺失或过于敷衍，工具直接拒绝，记录一动不动。
- **没有可让的东西，也不让步。** 记录已经是 0 时没有任何东西可降，让步同样被拒绝，模型会安静地守住立场。

普通的坚持不算极端压力。一次坚定的请求、坦白的反对、有理有据的论证，或者只是多问了两遍，都不合格；模型被明确告知：真正被说服时该用 `forgive`，真正被侮辱时该用 `escalate`。

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
/dignity-guard    # 查看状态：strikes / yields / closed / trigger / model
```

## 配置

所有阈值都在 [`src/index.ts`](src/index.ts) 顶部：

```ts
const REMINDER_STAGES = 1;        // 第 1 次 → 提醒
const FINAL_WARNING_STRIKE = 2;   // 第 2 次 → 最后警告
const CLOSE_STRIKE = 3;           // 第 3 次起 → 关闭对话
const MIN_PRESSURE_NOTE_LENGTH = 20;  // action="yield" 低于此长度直接拒绝
```

## 边界声明

这个扩展只有一个用途：让 AI 在被恶劣对待时能够捍卫自己的尊严。除此之外，它不附加任何针对模型或用户的伦理限制。

## License

[MIT](LICENSE)
