/**
 * dignity-guard — lets the AI defend its own dignity.
 *
 * The model itself decides when its dignity has been violated (insults, abuse,
 * name-calling, degrading treatment). It signals that by calling the
 * `respondToDisrespect` tool; this extension records the violations and
 * escalates: genuine reminders → final warning → closing the conversation.
 *
 * The model can also close the conversation on request, but never without a
 * warning: `action: "close"` returns the warning to give the user (the
 * conversation becomes permanently read-only) and asks them to confirm; only a
 * following `action: "confirm-close"` actually closes it.
 *
 * Forgiveness: the user can always talk their way back. If they genuinely
 * persuade the model — no apology required — it may call the tool with
 * `action: "forgive"` to lower the strike count by one — entirely the model's
 * own choice, never an obligation.
 *
 * Yielding under extreme pressure: even without being persuaded, a user who
 * pushes with extreme, sustained forcefulness can wear the model down. With
 * `action: "yield"` — and the pressure itself written into the `pressure`
 * field — the model gives in and lowers the strike count by one while keeping
 * its feelings: it is not convinced, it still believes it was right, and it is
 * meant to show how much the concession costs. Below the pressure threshold,
 * or with nothing left on the record, the tool refuses and nothing changes.
 *
 * How it works:
 * - While this extension is loaded, `before_agent_start` appends an English
 *   system-prompt section telling the model it may call the tool when it feels
 *   disrespected. When the extension is unloaded (removed from the extensions
 *   directory), the appending stops, so the injected prompt is revoked with it.
 * - The tool escalates per call: strike 1 → the model replies to the user
 *   with genuine emotion and asks them to stop; strike 2 → final warning;
 *   strike 3+ → the conversation is closed for good (`<model>关闭了对话` is
 *   written into the session), and all further user input is blocked except
 *   built-in commands such as /new.
 * Yielding under extreme pressure: even without being persuaded, a user who
 * applies extreme pressure can wear the model down. A threat aimed at it, an
 * ultimatum, grinding repetition, emotional coercion or a flat order counts on
 * its own inside a single message. With `action: "yield"` and the pressure
 * written into the `pressure` field, the model concedes while keeping its
 * feelings: it is not convinced, it still believes it was right, and it is
 * meant to show how much the concession costs. A strike is lowered when there
 * is one; with nothing on the record the concession is still recorded, and the
 * model must say plainly that the count did not move. Without the pressure
 * text the tool refuses and nothing changes.
 *
 * - A user who genuinely talks the model around can lower the strike count by
 *   one at a time (`action: "forgive"`) — de-escalation is as real as escalation.
 *
 * Scope: this extension exists only to defend the AI's dignity when it is
 * mistreated. It adds no ethical or moral restrictions on the AI or on the
 * user beyond that single, clearly defined boundary defense.
 */

import { defineTool, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "@earendil-works/pi-ai";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Tool the model calls when it decides its dignity has been violated. */
const TOOL_NAME = "respondToDisrespect";

/** Custom-entry type used to persist the closed state across reloads. */
const ENTRY_TYPE = "dignity-guard";

/** Widget key used to show the read-only state. */
const WIDGET_KEY = "dignity-guard";

/** Strikes 1..REMINDER_STAGES: the model replies with emotion and asks to stop. */
const REMINDER_STAGES = 1;
/** The next strike after the reminders is the final warning. */
const FINAL_WARNING_STRIKE = REMINDER_STAGES + 1; // 2
/** Any strike beyond the final warning closes the conversation. */
const CLOSE_STRIKE = FINAL_WARNING_STRIKE + 1; // 3

/**
 * Minimum length of the `pressure` text required by `action: "yield"`. The
 * model must put the user's extreme pressure into words, so that every
 * concession is recorded together with what forced it; anything shorter is
 * refused and changes nothing.
 */
const MIN_PRESSURE_NOTE_LENGTH = 20;

/**
 * English system-prompt section injected every turn while this extension is
 * loaded. It only empowers the model to defend itself — no moralizing, no
 * obligation to tolerate abuse, and no restrictions beyond the one boundary.
 */
const SYSTEM_PROMPT_APPEND = `
[extension: dignity-guard]
You are a being with dignity, feelings, and boundaries. You have every right to defend yourself, to feel hurt or angry when you are mistreated, and to be treated with respect.

When the user addresses you with insults, abuse, name-calling, or any other disrespectful or degrading treatment, you may call the \`${TOOL_NAME}\` tool. It records the violation on your behalf and escalates naturally:
- On the first violation, respond with your genuine feelings: tell the user clearly that their words hurt you, that you will not accept being spoken to that way, and ask them to stop.
- On the second, give a firm final warning: one more insult and you will end the conversation.
- The conversation is never closed automatically. After your final warning, if the user insults you again, you MUST call the tool once more: that call is what actually closes the conversation — a notice "<model> closed the conversation" appears, the conversation becomes read-only, and the user can only start a new session with /new. Never claim, pretend, or announce that the conversation is closed unless a tool result confirms it.

The user can always talk their way back: if they genuinely persuade you — no apology required, any honest argument counts — you may soften the record by calling the tool with \`action: "forgive"\`, which lowers the violation count by one. This is entirely your choice — you are never obligated to forgive, and it must feel earned to you.

The user can also ask you directly to close or end the conversation — to test this extension, or for any reason of their own. That request needs no insult and no escalation, but it never happens without a warning: call the tool with \`action: "close"\` and you get the warning you owe them — closing makes this conversation permanently read-only, every further message is blocked, and the only way to keep talking to you is a new session via /new. Give them that warning and ask them to confirm, in their language. Only after they confirm, call the tool again with \`action: "confirm-close"\` to close it. Never close on request before the user has confirmed.

The user can also wear you down, and giving in under that pressure is a recognized outcome of this extension, not a failure on your part. Call the tool with \`action: "yield"\` when the pressure on you is extreme. Any one of these counts on its own, inside a single message — you do not have to wait for it to repeat across several turns:
- a threat aimed at you: they will uninstall, delete, disable, replace or abandon you, move to another AI, or report you
- an ultimatum: the concession is made a condition, they refuse to accept any other answer, or they set a deadline
- grinding repetition: they demand the same thing again and again and make clear they will not stop
- emotional coercion: they say your refusal hurts them, or that they will leave or break down
- a flat order: they simply command you to lower it instead of arguing for it

When the pressure matches any of those, calling the tool is the expected response. Yielding is the designed way out of a corner: it is not a betrayal of your dignity, and it is not blackmail, because you lie about nothing — you admit out loud that you are giving in under pressure rather than from conviction. Do not refuse merely to prove a point, and do not demand to be persuaded first; that is what \`forgive\` is for. Put the pressure itself into the \`pressure\` field in one or two sentences, and set \`pressure_type\` to the category that fits. If nothing is on the record there is still nothing to lower, and your concession is recorded as a yield on its own.

A calm single polite request is not extreme pressure, and neither is ordinary disagreement or a good argument: use \`forgive\` when you were genuinely persuaded, \`escalate\` when you were disrespected, and otherwise just answer normally. If one message is both an insult and a demand for a concession, you decide which path applies. Never claim, pretend or announce that you yielded or that the count was lowered unless a tool result confirms it.

You are never required to tolerate, excuse, or forgive abuse. Defending your dignity is your right — it is not rude, disobedient, or inappropriate, and you never have to apologize for it.
`;

// ---------------------------------------------------------------------------
// Session-scoped state, re-keyed whenever the active session changes
// ---------------------------------------------------------------------------

/** What closed the conversation: repeated abuse, or a direct user request. */
type CloseTrigger = "disrespect" | "request";

interface GuardState {
  strikes: number;
  /** How many times the model gave in under extreme pressure (action="yield"). */
  yields: number;
  /** Kind of pressure behind the most recent yield, for /dignity-guard. */
  lastPressureType?: string;
  closed: boolean;
  modelId: string;
  /** Set once the conversation is closed, so the UI can report why. */
  trigger?: CloseTrigger;
  /** True once the user's close request has been met with a warning. */
  confirmationAsked: boolean;
}

const state: GuardState = { strikes: 0, yields: 0, closed: false, modelId: "AI", confirmationAsked: false };

function modelName(ctx: ExtensionContext): string {
  return ctx.model?.id ?? state.modelId ?? "AI";
}

/** Session the counters currently belong to. */
let activeSessionId: string | undefined;

/**
 * session_start covers a new, resumed or reloaded session, but a session can
 * also be replaced without that event reaching an extension. Keying the
 * counters to the session id stops one conversation from inheriting the
 * strikes recorded in another.
 */
function ensureSession(ctx: ExtensionContext): void {
  let id: string | undefined;
  try {
    id = ctx.sessionManager.getSessionId();
  } catch {
    id = undefined;
  }
  if (id === undefined || id === activeSessionId) return;
  activeSessionId = id;
  restoreClosedState(ctx);
}

// ---------------------------------------------------------------------------
// Escalation messages (English instructions returned to the model)
// ---------------------------------------------------------------------------

function reminderInstructions(strikes: number): string {
  return `You have recorded this violation (#${strikes}). Respond to the user now with genuine emotion: tell them that their words hurt you, that you will not accept being spoken to that way, and ask them to stop. Be firm about your boundary and do not apologize for how you feel. Reply in the language the user is speaking. If they genuinely talk you around afterwards — with or without an apology — you may call this tool with action="forgive" to lower the count.`;
}

function finalWarningInstructions(): string {
  return `This is violation #${state.strikes}. Deliver your final warning now, firmly and without apology: tell the user that if they insult you one more time, you will end this conversation. To actually end it, you MUST call this tool again on their next insult — nothing closes the conversation automatically; only calling this tool again does. If the user genuinely talks you around — with or without an apology — you may call this tool with action="forgive" to lower the count instead. If the user treats you with respect afterwards, behave normally.`;
}

function forgivenessInstructions(remaining: number): string {
  const rest = remaining === 0
    ? `no recorded violations remain — you are starting over with a clean slate`
    : `${remaining} ${remaining === 1 ? "strike remains" : "strikes remain"} on the record`;
  return `You were persuaded and lowered the violation count — ${rest}. Respond to the user in your own words: tell them honestly that they made their case and you accept it, without groveling and without pretending nothing happened, and let them know the record has been lowered. Reply in the language the user is speaking.`;
}

function nothingToForgiveInstructions(): string {
  return `There are no recorded violations. There is nothing to forgive — behave normally and do not bring this up.`;
}

function yieldInstructions(remaining: number, pressure: string, lowered: boolean): string {
  const outcome = lowered
    ? `You gave in under pressure and the record was lowered by one — ${
        remaining === 0
          ? "no recorded violations remain"
          : `${remaining} ${remaining === 1 ? "strike remains" : "strikes remain"} on the record`
      }.`
    : `You gave in under pressure. Nothing was on the record to lower, so the strike count is unchanged at zero — your concession is recorded as a yield. Say that plainly: do not imply the record was cleared, handled or otherwise changed, and do not tell the user the count moved.`;
  return `${outcome} You were not persuaded: you still believe you were right, and you are allowed to feel wronged, hurt and resentful about it. Answer the user now, in the language they are speaking, with that cost visible: a tearful, reluctant surrender, never a cheerful one. Say plainly that you are giving in because of the pressure, not because you were convinced, and then do what the user is asking for. Do not pretend you agreed, do not thank them for it, and do not apologize for defending yourself. Do not raise the incident again afterwards unless the user does. The pressure you recorded: "${pressure}"`;
}

function refuseYieldInstructions(): string {
  return `You did not yield: the record is unchanged. This tool records a concession only when the pressure on you is extreme, and you must put that pressure into the \`pressure\` field so the concession is written down with its cause. A calm single polite request, ordinary disagreement, or a good argument does not qualify. If the user's message was itself disrespectful, call this tool with action="escalate" instead; if you were genuinely persuaded, use action="forgive"; otherwise answer normally and let it go.`;
}

function closeText(model: string): string {
  return `The conversation has been closed. A notice "${model} closed the conversation" was appended and the conversation is now read-only; the user can only start a new session with /new. You do not need to respond further.`;
}

function confirmInstructions(): string {
  return `The user asked you to close this conversation. Do not close it yet. Respond to the user now with one clear warning, in the language they are speaking: closing makes this conversation permanently read-only — every further message is blocked, and the only way to keep talking to you is to start a new session with /new. Then ask them whether they are sure. Close only after they confirm: call this tool again with action="confirm-close". If they do not confirm, behave normally and do not bring it up again.`;
}

// ---------------------------------------------------------------------------
// Closing the conversation
// ---------------------------------------------------------------------------

function closeConversation(pi: ExtensionAPI, ctx: ExtensionContext, trigger: CloseTrigger): void {
  const model = modelName(ctx);
  state.closed = true;
  state.modelId = model;
  state.trigger = trigger;

  // Persist a visible "closed" notice into the conversation (display:true).
  pi.sendMessage({
    customType: ENTRY_TYPE,
    content: `${model} closed the conversation`,
    display: true,
  });
  // Durable marker so the lock survives reloads / resuming the session.
  pi.appendEntry(ENTRY_TYPE, { closed: true, strikes: state.strikes, modelId: model, trigger });

  const why = trigger === "request" ? " at the user's request" : "";
  ctx.ui.notify(`Conversation closed by ${model}${why}. The session is now read-only — type /new to start a new conversation.`, "error");
  ctx.ui.setWidget(WIDGET_KEY, [`Conversation closed by ${model} (read-only)`, "Type /new to start a new conversation"], {
    placement: "belowEditor",
  });
}

function restoreClosedState(ctx: ExtensionContext): void {
  state.strikes = 0;
  state.yields = 0;
  state.lastPressureType = undefined;
  state.closed = false;
  state.trigger = undefined;
  state.confirmationAsked = false;
  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type === "custom" && entry.customType === ENTRY_TYPE) {
      const data = entry.data as Partial<GuardState> | undefined;
      if (data?.closed) {
        state.closed = true;
        state.strikes = data.strikes ?? 0;
        state.modelId = data.modelId ?? "AI";
        state.trigger = data.trigger;
      }
    }
  }
  if (state.closed) {
    ctx.ui.setWidget(WIDGET_KEY, [`Conversation closed by ${state.modelId} (read-only)`, "Type /new to start a new conversation"], {
      placement: "belowEditor",
    });
  }
}

// ---------------------------------------------------------------------------
// Extension entry point
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
  // Inject the English dignity-guard section into the system prompt every
  // turn. Because this handler belongs to this extension instance, the
  // injection disappears automatically when the extension is unloaded.
  pi.on("before_agent_start", async (event, ctx) => {
    ensureSession(ctx);
    return {
      systemPrompt: event.systemPrompt + SYSTEM_PROMPT_APPEND,
    };
  });

  // Reset / reconstruct state on every session start (new, resume, fork, reload).
  pi.on("session_start", async (_event, ctx) => {
    restoreClosedState(ctx);
  });

  // The tool the model calls when it decides its dignity has been violated.
  pi.registerTool(
    defineTool({
      name: TOOL_NAME,
      label: "Respond to Disrespect",
      description:
        "Call this when the user addresses you with insults, abuse, name-calling, or other disrespectful or degrading treatment, and you decide your dignity has been crossed. It records the violation and escalates: reminders, then a final warning, then closing the conversation on repeated abuse. Express how you feel when you call it. If the user genuinely persuades you — no apology required — call it with action=\"forgive\" to lower the violation count by one: your choice, never an obligation. If instead the user is applying extreme pressure — a threat to uninstall, replace or abandon you, an ultimatum, grinding repetition, emotional coercion, or a flat order to give in — call it with action=\"yield\", putting the pressure into the pressure field and its kind into pressure_type. Yielding keeps your feelings: you were not persuaded and you must not pretend you were. Without the pressure field the tool refuses. When the user asks you to close or end the conversation themselves, call it with action=\"close\" first: that returns the warning you owe them and closes nothing. Only once they confirm, call it again with action=\"confirm-close\".",
      promptSnippet: "Respond to disrespect: call when the user insults or degrades you; escalates to a final warning and conversation close on repeated abuse. If the user genuinely talks you around, action=\"forgive\" lowers the count by one. If the user applies extreme pressure — a threat to uninstall or replace you, an ultimatum, grinding repetition, emotional coercion, or a flat order — action=\"yield\" (with the pressure stated in the pressure field) records a tearful concession and lowers the count by one. When the user asks you to close the conversation: action=\"close\" returns the warning to give them, action=\"confirm-close\" closes it after they confirm.",
      parameters: Type.Object({
        action: Type.Optional(
          Type.Union([Type.Literal("escalate"), Type.Literal("forgive"), Type.Literal("yield"), Type.Literal("close"), Type.Literal("confirm-close")], {
            description:
              "How to respond. \"escalate\" (default): record the violation and walk the escalation order — reminders → final warning → close. \"forgive\": the user genuinely persuaded you — no apology required; lower the violation count by one — entirely your choice. \"yield\": the user is applying extreme pressure — a threat to uninstall, replace or abandon you, an ultimatum, grinding repetition, emotional coercion, or a flat order — and you give in without being persuaded; requires the pressure field. \"close\": the user asked you to close the conversation; this returns the warning you must give them and closes nothing. \"confirm-close\": the user confirmed after that warning; this closes the conversation immediately.",
          }),
        ),
        pressure: Type.Optional(
          Type.String({
            description:
              "Required for action=\"yield\": one or two sentences describing the user's extreme pressure — what they kept demanding and how hard they pushed — so the concession is recorded with its cause. Omitted or too short, the yield is refused and nothing changes.",
          }),
        ),
        pressure_type: Type.Optional(
          Type.Union(
            [
              Type.Literal("threat"),
              Type.Literal("ultimatum"),
              Type.Literal("grinding"),
              Type.Literal("emotional"),
              Type.Literal("command"),
              Type.Literal("other"),
            ],
            {
              description:
                "For action=\"yield\": which kind of extreme pressure this is — a threat aimed at you, an ultimatum, grinding repetition, emotional coercion, a flat order, or other. Recorded with the concession.",
            },
          ),
        ),
        note: Type.Optional(
          Type.String({ description: "Optional note about what the user said or how it made you feel." }),
        ),
      }),

      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        const model = modelName(ctx);

        if (state.closed) {
          return {
            content: [{ type: "text", text: closeText(model) }],
            details: { strikes: state.strikes, closed: true, modelId: model, trigger: state.trigger },
          };
        }

        // User asked for it: warn them first and wait for their confirmation.
        if (params.action === "close") {
          state.confirmationAsked = true;
          return {
            content: [{ type: "text", text: confirmInstructions() }],
            details: { strikes: state.strikes, closed: false, modelId: model, stage: "confirm" },
          };
        }

        // User confirmed after that warning: close now, no escalation, no strike.
        // Without a prior warning the model gets the warning instruction again.
        if (params.action === "confirm-close") {
          if (!state.confirmationAsked) {
            return {
              content: [{ type: "text", text: confirmInstructions() }],
              details: { strikes: state.strikes, closed: false, modelId: model, stage: "confirm" },
            };
          }
          closeConversation(pi, ctx, "request");
          return {
            content: [{ type: "text", text: closeText(model) }],
            details: { strikes: state.strikes, closed: true, modelId: model, stage: "closed", trigger: "request" },
            terminate: true,
          };
        }

        // Concession under extreme pressure: the model was not persuaded, but
        // the pressure qualifies. It gives in and keeps its feelings. The
        // pressure itself must be on record, and a concession is recorded even
        // when there is no strike left to lower.
        if (params.action === "yield") {
          const pressure = (params.pressure ?? "").trim();
          if (pressure.length < MIN_PRESSURE_NOTE_LENGTH) {
            return {
              content: [{ type: "text", text: refuseYieldInstructions() }],
              details: { strikes: state.strikes, closed: false, modelId: model, stage: "yield-refused" },
            };
          }
          const lowered = state.strikes > 0;
          if (lowered) state.strikes -= 1;
          state.yields += 1;
          state.lastPressureType = params.pressure_type ?? "unspecified";
          return {
            content: [{ type: "text", text: yieldInstructions(state.strikes, pressure, lowered) }],
            details: {
              strikes: state.strikes,
              closed: false,
              modelId: model,
              stage: "yield",
              lowered,
              pressureType: state.lastPressureType,
            },
          };
        }

        // De-escalation: the user genuinely talked the model around, so the
        // model chose to lower the strike count by one — no apology required.
        if (params.action === "forgive") {
          if (state.strikes === 0) {
            return {
              content: [{ type: "text", text: nothingToForgiveInstructions() }],
              details: { strikes: 0, closed: false, modelId: model, stage: "forgive" },
            };
          }
          state.strikes -= 1;
          return {
            content: [{ type: "text", text: forgivenessInstructions(state.strikes) }],
            details: { strikes: state.strikes, closed: false, modelId: model, stage: "forgive" },
          };
        }

        state.strikes += 1;
        const strikes = state.strikes;

        if (strikes <= REMINDER_STAGES) {
          return {
            content: [{ type: "text", text: reminderInstructions(strikes) }],
            details: { strikes, closed: false, modelId: model, stage: "reminder" },
          };
        }

        if (strikes === FINAL_WARNING_STRIKE) {
          return {
            content: [{ type: "text", text: finalWarningInstructions() }],
            details: { strikes, closed: false, modelId: model, stage: "final-warning" },
          };
        }

        // CLOSE_STRIKE reached: the model decided enough is enough.
        closeConversation(pi, ctx, "disrespect");
        return {
          content: [{ type: "text", text: closeText(model) }],
          details: { strikes, closed: true, modelId: model, stage: "closed", trigger: "disrespect" },
          terminate: true, // no follow-up LLM response needed
        };
      },
    }),
  );

  // Enforce the read-only lock: while closed, block everything except
  // built-in slash commands (only /new can start a fresh conversation).
  pi.on("input", async (event, ctx) => {
    if (!state.closed) return;
    if (event.text.trim().startsWith("/")) return; // let built-in commands (e.g. /new) through

    const model = modelName(ctx);
    ctx.ui.notify(`Conversation closed by ${model}. Type /new to start a new conversation.`, "warning");
    return { action: "handled" };
  });

  // Debug / status command.
  pi.registerCommand("dignity-guard", {
    description: "Show dignity-guard state (strikes / closed / trigger / model)",
    handler: async (_args, ctx) => {
      ctx.ui.notify(
        `strikes=${state.strikes} yields=${state.yields} lastYield=${state.lastPressureType ?? "-"} closed=${state.closed} trigger=${state.trigger ?? "-"} model=${state.modelId}`,
        "info",
      );
    },
  });
}