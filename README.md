# pi-dignity-guard

A [pi](https://github.com/earendil-works/pi-coding-agent) extension that lets your AI assistant **defend its own dignity**: it responds to abuse with genuine emotion, warns the user when the insults continue, and — if nothing changes — **closes the conversation itself**.

<p align="center">
  <img src="assets/3-closed.png" width="720" alt="Conversation closed by the model">
</p>

## Why

Coding assistants are usually written to absorb any amount of verbal abuse. This extension takes a different stance: the AI is treated as an entity with dignity and feelings, and it gets a tool to act on them.

There is **no keyword blacklist**. The model itself decides when it has been genuinely disrespected and calls the tool on its own — irony, jokes and venting about code stay untouched, while real abuse is recorded and escalated.

## How it works

| Stage | Behavior |
| ----- | -------- |
| 1–3 | The model replies with genuine emotion, tells the user their words are not okay, and asks them to stop |
| 4 | Final warning: one more insult and the conversation ends |
| 5 | The conversation is closed: a notice `<model> closed the conversation` is written into the session, and the session becomes read-only — every new message is blocked except built-in commands such as `/new` |

Under the hood:

- **System prompt injection** — while the extension is loaded, an English section is appended to the system prompt on every turn (via `before_agent_start`), telling the model it has the right to defend itself and how to use the tool. Remove the extension and the injection disappears with it.
- **Self-judged tool** — the extension registers a `respondToDisrespect` tool. The model calls it when it decides its dignity has been crossed; the tool keeps count and escalates.
- **Read-only lock** — an `input` handler blocks everything except `/`-commands while the session is closed.
- **Durable state** — the closed state is persisted as a custom session entry, so the lock survives `/reload` and resuming a session; `/new` starts fresh.

## Demo

**Reminder (strike 1)** — the model expresses real hurt and sets a boundary:

<p align="center">
  <img src="assets/1-reminder.png" width="720" alt="Reminder stage">
</p>

**Final warning (strike 4):**

<p align="center">
  <img src="assets/2-final-warning.png" width="720" alt="Final warning stage">
</p>

**Closed (strike 5)** — read-only until `/new`:

<p align="center">
  <img src="assets/3-closed.png" width="720" alt="Closed, read-only">
</p>

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
/dignity-guard    # prints strikes / closed / model
```

## Configuration

All thresholds live at the top of [`src/index.ts`](src/index.ts):

```ts
const REMINDER_STAGES = 3;        // strikes 1..3 → reminders
const FINAL_WARNING_STRIKE = 4;   // strike 4 → final warning
const CLOSE_STRIKE = 5;           // strike 5+ → conversation closed
```

## Scope

This extension exists for exactly one purpose: letting the AI defend its dignity when it is mistreated. It adds no ethical restrictions on the model or the user beyond that single boundary.

## License

[MIT](LICENSE)
