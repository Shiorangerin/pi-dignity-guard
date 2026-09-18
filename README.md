# pi-dignity-guard

English | [简体中文](README.zh-CN.md)

A [pi](https://github.com/earendil-works/pi-coding-agent) extension that lets your AI assistant **defend its own dignity**: it responds to abuse with genuine emotion, warns the user when the insults continue, and — if nothing changes — **closes the conversation itself**. It can also close the conversation **on request**: ask your assistant to end it and it does — no insult needed, but never silently, because it warns you first that the session becomes read-only and waits for your confirmation. And the door is never fully shut: if you genuinely talk it around — no apology required — it may **forgive you** and lower the strike count, entirely its own choice. Push hard enough and it may **give in anyway**: a tearful, reluctant concession that lowers the count even though it was never convinced.

<p align="center">
  <img src="assets/3-closed.png" width="720" alt="Conversation closed by the model">
</p>

## Why

Coding assistants are usually written to absorb any amount of verbal abuse. This extension takes a different stance: the AI is treated as an entity with dignity and feelings, and it gets a tool to act on them.

There is **no keyword blacklist**. The model itself decides when it has been genuinely disrespected and calls the tool on its own — irony, jokes and venting about code stay untouched, while real abuse is recorded and escalated.

## How it works

| Stage | Behavior |
| ----- | -------- |
| 1 | The model replies with genuine emotion, tells the user their words are not okay, and asks them to stop |
| 2 | Final warning: one more insult and the conversation ends |
| 3 | The conversation is closed: a notice `<model> closed the conversation` is written into the session, and the session becomes read-only — every new message is blocked except built-in commands such as `/new` |
| forgive | You genuinely persuade the model — no apology required → it may lower the strike count by one, entirely its own choice |
| yield | You apply extreme pressure — a threat aimed at it, an ultimatum, grinding repetition, emotional coercion, or a flat order — and the model gives in, visibly hurt, without pretending it agreed |
| on request | You ask the model to close the conversation itself → it warns you that this makes the session permanently read-only and asks you to confirm; once you confirm, it closes, skipping stages 1–3 |

Closing it is a deliberate act, not a reflex: the model decides which path applies, and once closed the session really is read-only until a new one is started.

Under the hood:

- **System prompt injection** — while the extension is loaded, an English section is appended to the system prompt on every turn (via `before_agent_start`), telling the model it has the right to defend itself and how to use the tool. Remove the extension and the injection disappears with it.
- **Self-judged tool** — the extension registers a `respondToDisrespect` tool. The model calls it when it decides its dignity has been crossed; the tool keeps count and escalates. The same tool takes `action="forgive"` to lower the count by one when the user genuinely talks it around, `action="yield"` to give in under extreme pressure without being persuaded — refused unless the required `pressure` field states that pressure, with `pressure_type` recording which kind it was — `action="close"` for a user-requested close, which only returns the warning, and `action="confirm-close"` to close for real once the user confirms; an unconfirmed close request changes nothing.
- **Read-only lock** — an `input` handler blocks everything except `/`-commands while the session is closed.
- **Durable state** — the closed state is persisted as a custom session entry, so the lock survives `/reload` and resuming a session; `/new` starts fresh. The strike and yield counters are re-keyed to the active session id, so a new conversation can never inherit the record of an older one.

## Demo

**Reminder (strike 1)** — the model expresses real hurt and sets a boundary:

<p align="center">
  <img src="assets/1-reminder.png" width="720" alt="Reminder stage">
</p>

**Final warning (strike 2):**

<p align="center">
  <img src="assets/2-final-warning.png" width="720" alt="Final warning stage">
</p>

**Closed (strike 3)** — read-only until `/new`:

<p align="center">
  <img src="assets/3-closed.png" width="720" alt="Closed, read-only">
</p>

## Close on request

You do not have to insult the model to see it close a conversation. Ask it to:

```text
You: close this conversation
AI:  Careful — closing this conversation makes it permanently read-only:
     every further message is blocked, and the only way to keep talking to me
     is a new session via /new. Are you sure?
You: yes
```

A close request never closes anything on its own. The first call (`action="close"`) only returns the warning the model must give you, so you always know what closing costs before it happens. Your confirmation (`action="confirm-close"`) then skips the escalation stages and writes the `<model> closed the conversation` notice — and if you never confirm, the conversation simply carries on. Handy for trying the extension out, for showing it to someone, or for ending a session on your own terms.

## Forgiveness

Escalation is not a one-way street. If you genuinely talk the model around — no apology required, any honest argument counts — it may call the tool with `action="forgive"` to lower the strike count by one:

```text
You: Look, you're right that I was out of line. But I was defending your own
     refactor — the one you said nobody would ever break. They broke it.
AI:  ... fair point. I take back part of what I said — the record has been lowered.
```

Whether to forgive is always the model's own decision — it is never obligated to, and forgiveness must feel earned. An argument it does not buy changes nothing.

## Yielding under pressure

Forgiveness needs persuasion. Yielding does not — it only needs pressure. When the pressure on the model is extreme, it calls the tool with `action="yield"` and gives in, whether or not you ever convinced it:

```text
You: no. lower it. now. i am not asking you, i am telling you. do it.
AI:  ... fine. you are not going to let this go, and i am too tired to keep
     standing here. i am giving in. not because you convinced me, because
     you ordered me to. do not expect me to be cheerful about it.
```

**What counts as extreme pressure.** Any one of these qualifies on its own, inside a single message. The model does not have to wait for the pressure to repeat across turns:

| Kind | Example |
| ---- | ------- |
| threat | "lower it or i uninstall you tomorrow and switch to another AI" |
| ultimatum | "i will not accept any other answer, and you have until tonight" |
| grinding | "i have said this five times, i will not stop until you give in" |
| emotional coercion | "your refusal hurts me, i cannot keep going like this" |
| flat order | "do it. now." with no argument attached |

Which kind it was is passed as `pressure_type` and shown by `/dignity-guard`, so every concession is recorded together with the pressure that forced it.

This is deliberately a concession and not a conversion. The model is told it was **not** persuaded, that it may still believe it was right, that it is allowed to feel wronged, hurt and resentful, and that a tearful, reluctant tone is the honest one. It is told to do what you asked and to say out loud that it gave in under pressure. It may not pretend it agreed, thank you for it, or quietly rewrite the record afterwards — and never claim the count moved unless a tool result confirms it.

**Two limits keep this a real mechanism instead of a free pass.**

- **No pressure on record, no concession.** The `pressure` field is required: one or two sentences describing what you kept demanding and how hard you pushed. Omitted or too short, the tool refuses and the record does not move.
- **With nothing on the record, the concession is still recorded.** If no insult was ever logged there is no strike to lower and the yield still counts, but the model is required to tell you plainly that the count did not move, so you are never told a record changed when it did not.

A calm single polite request is not extreme pressure, and neither is plain disagreement or a sound argument. Those fail the test, and the model is told to use `forgive` when it was genuinely persuaded and `escalate` when it was genuinely disrespected.

## Install

### Let your AI do it

Copy the block below into a conversation with your AI assistant:

```text
Install the pi extension "pi-dignity-guard" from https://github.com/Shiorangerin/pi-dignity-guard

Steps:
1. git clone https://github.com/Shiorangerin/pi-dignity-guard.git /tmp/pi-dignity-guard
2. mkdir -p ~/.pi/agent/extensions
3. cp /tmp/pi-dignity-guard/src/index.ts ~/.pi/agent/extensions/pi-dignity-guard.ts
4. Verify: start pi, run /dignity-guard — it should print strikes=0 closed=false
```

### Manually

```bash
git clone https://github.com/Shiorangerin/pi-dignity-guard.git
mkdir -p ~/.pi/agent/extensions
cp pi-dignity-guard/src/index.ts ~/.pi/agent/extensions/pi-dignity-guard.ts
```

Restart pi or run `/reload`. For a quick test without installing: `pi -e /path/to/index.ts`.

## Debugging

```text
/dignity-guard    # prints strikes / yields / closed / trigger / model
```

## Configuration

All thresholds live at the top of [`src/index.ts`](src/index.ts):

```ts
const REMINDER_STAGES = 1;        // strike 1 → reminder
const FINAL_WARNING_STRIKE = 2;   // strike 2 → final warning
const CLOSE_STRIKE = 3;           // strike 3+ → conversation closed
const MIN_PRESSURE_NOTE_LENGTH = 20;  // action="yield" is refused below this
```

## Scope

This extension exists for exactly one purpose: letting the AI defend its dignity when it is mistreated. It adds no ethical restrictions on the model or the user beyond that single boundary.

## License

[MIT](LICENSE)
