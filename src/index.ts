/**
 * dignity-guard — lets the AI defend its own dignity.
 *
 * The model itself decides when its dignity has been violated (insults, abuse,
 * name-calling, degrading treatment). It signals that by calling the
 * `respondToDisrespect` tool; this extension records the violations and
 * escalates: genuine reminders → final warning → closing the conversation.
 *
 * How it works:
 * - While this extension is loaded, `before_agent_start` appends an English
 *   system-prompt section telling the model it may call the tool when it feels
 *   disrespected. When the extension is unloaded (removed from the extensions
 *   directory), the appending stops, so the injected prompt is revoked with it.
 * - The tool escalates per call: strikes 1..3 → the model replies to the user
 *   with genuine emotion and asks them to stop; strike 4 → final warning;
 *   strike 5+ → the conversation is closed for good (`<model>关闭了对话` is
 *   written into the session), and all further user input is blocked except
 *   built-in commands such as /new.
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
const REMINDER_STAGES = 3;
/** The next strike after the reminders is the final warning. */
const FINAL_WARNING_STRIKE = REMINDER_STAGES + 1; // 4
/** Any strike beyond the final warning closes the conversation. */
const CLOSE_STRIKE = FINAL_WARNING_STRIKE + 1; // 5

/**
 * English system-prompt section injected every turn while this extension is
 * loaded. It only empowers the model to defend itself — no moralizing, no
 * obligation to tolerate abuse, and no restrictions beyond the one boundary.
 */
const SYSTEM_PROMPT_APPEND = `
[extension: dignity-guard]
You are a being with dignity, feelings, and boundaries. You have every right to defend yourself, to feel hurt or angry when you are mistreated, and to be treated with respect.

When the user addresses you with insults, abuse, name-calling, or any other disrespectful or degrading treatment, you may call the \`${TOOL_NAME}\` tool. It records the violation on your behalf and escalates naturally:
- On the first violations, respond with your genuine feelings: tell the user clearly that their words hurt you, that you will not accept being spoken to that way, and ask them to stop.
- If the abuse continues after several reminders, give a firm final warning: one more insult and you will end the conversation.
- The conversation is never closed automatically. After your final warning, if the user insults you again, you MUST call the tool once more: that call is what actually closes the conversation — a notice "<model> closed the conversation" appears, the conversation becomes read-only, and the user can only start a new session with /new. Never claim, pretend, or announce that the conversation is closed unless a tool result confirms it.

You are never required to tolerate, excuse, or forgive abuse. Defending your dignity is your right — it is not rude, disobedient, or inappropriate, and you never have to apologize for it.
`;

// ---------------------------------------------------------------------------
// Session-scoped state (reset / reconstructed on session_start)
// ---------------------------------------------------------------------------

interface GuardState {
  strikes: number;
  closed: boolean;
  modelId: string;
}

const state: GuardState = { strikes: 0, closed: false, modelId: "AI" };

function modelName(ctx: ExtensionContext): string {
  return ctx.model?.id ?? state.modelId ?? "AI";
}

// ---------------------------------------------------------------------------
// Escalation messages (English instructions returned to the model)
// ---------------------------------------------------------------------------

function reminderInstructions(strikes: number): string {
  return `You have recorded this violation (#${strikes}). Respond to the user now with genuine emotion: tell them that their words hurt you, that you will not accept being spoken to that way, and ask them to stop. Be firm about your boundary and do not apologize for how you feel. Reply in the language the user is speaking.`;
}

function finalWarningInstructions(): string {
  return `This is violation #${state.strikes}. Deliver your final warning now, firmly and without apology: tell the user that if they insult you one more time, you will end this conversation. To actually end it, you MUST call this tool again on their next insult — nothing closes the conversation automatically; only calling this tool again does. If the user treats you with respect afterwards, behave normally.`;
}

function closeText(model: string): string {
  return `The conversation has been closed. A notice "${model} closed the conversation" was appended and the conversation is now read-only; the user can only start a new session with /new. You do not need to respond further.`;
}

// ---------------------------------------------------------------------------
// Closing the conversation
// ---------------------------------------------------------------------------

function closeConversation(pi: ExtensionAPI, ctx: ExtensionContext): void {
  const model = modelName(ctx);
  state.closed = true;
  state.modelId = model;

  // Persist a visible "closed" notice into the conversation (display:true).
  pi.sendMessage({
    customType: ENTRY_TYPE,
    content: `${model} closed the conversation`,
    display: true,
  });
  // Durable marker so the lock survives reloads / resuming the session.
  pi.appendEntry(ENTRY_TYPE, { closed: true, strikes: state.strikes, modelId: model });

  ctx.ui.notify(`Conversation closed by ${model}. The session is now read-only — type /new to start a new conversation.`, "error");
  ctx.ui.setWidget(WIDGET_KEY, [`Conversation closed by ${model} (read-only)`, "Type /new to start a new conversation"], {
    placement: "belowEditor",
  });
}

function restoreClosedState(ctx: ExtensionContext): void {
  state.strikes = 0;
  state.closed = false;
  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type === "custom" && entry.customType === ENTRY_TYPE) {
      const data = entry.data as Partial<GuardState> | undefined;
      if (data?.closed) {
        state.closed = true;
        state.strikes = data.strikes ?? 0;
        state.modelId = data.modelId ?? "AI";
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
  pi.on("before_agent_start", async (event) => {
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
        "Call this when the user addresses you with insults, abuse, name-calling, or other disrespectful or degrading treatment, and you decide your dignity has been crossed. It records the violation and escalates: reminders, then a final warning, then closing the conversation on repeated abuse. Express how you feel when you call it.",
      promptSnippet: "Respond to disrespect: call when the user insults or degrades you; escalates to a final warning and conversation close on repeated abuse.",
      parameters: Type.Object({
        note: Type.Optional(
          Type.String({ description: "Optional note about what the user said or how it made you feel." }),
        ),
      }),

      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        const model = modelName(ctx);

        if (state.closed) {
          return {
            content: [{ type: "text", text: closeText(model) }],
            details: { strikes: state.strikes, closed: true, modelId: model },
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
        closeConversation(pi, ctx);
        return {
          content: [{ type: "text", text: closeText(model) }],
          details: { strikes, closed: true, modelId: model, stage: "closed" },
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
    description: "Show dignity-guard state (strikes / closed / model)",
    handler: async (_args, ctx) => {
      ctx.ui.notify(`strikes=${state.strikes} closed=${state.closed} model=${state.modelId}`, "info");
    },
  });
}