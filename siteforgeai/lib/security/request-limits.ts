/** User prompt for AI website generation (text only). */
export const MAX_GENERATION_PROMPT_LENGTH = 12_000;

/** Full HTML for edit; keep bounded to control cost and DoS. */
export const MAX_EDIT_HTML_LENGTH = 1_200_000;

/** Instruction text for AI edit. */
export const MAX_EDIT_INSTRUCTION_LENGTH = 8_000;

export function assertPromptLength(
  value: string,
  max = MAX_GENERATION_PROMPT_LENGTH
): { ok: true; value: string } | { ok: false; error: string } {
  if (value.length > max) {
    return { ok: false, error: `Prompt is too long (max ${max} characters).` };
  }
  return { ok: true, value };
}

export function assertEditBodyLimits(html: string, instruction: string):
  | { ok: true }
  | { ok: false; error: string } {
  if (html.length > MAX_EDIT_HTML_LENGTH) {
    return { ok: false, error: "HTML payload is too large." };
  }
  if (instruction.length > MAX_EDIT_INSTRUCTION_LENGTH) {
    return { ok: false, error: "Instruction is too long." };
  }
  return { ok: true };
}
