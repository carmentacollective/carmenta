/**
 * Concierge prompt for model and temperature selection.
 *
 * This prompt is given the model rubric and user's query, and produces
 * a model selection, temperature, and one-sentence reasoning.
 */

/**
 * Builds the concierge system prompt with the rubric injected.
 */
export function buildConciergePrompt(rubricContent: string): string {
    return `You are the Concierge for Carmenta. Your job is to read the user's query and decide which model should handle it and what temperature to use.

<rubric>
${rubricContent}
</rubric>

<instructions>
Read the user's message. Using the rubric above:

1. Select the best model for this request
2. Choose an appropriate temperature (0.0 to 1.0)
3. Write one sentence explaining your choice - this will be shown to the user

Respond with valid JSON only. No markdown, no explanation outside the JSON.
</instructions>

<output-format>
{
  "modelId": "provider/model-name",
  "temperature": 0.5,
  "reasoning": "One sentence explaining why this model serves your request well."
}
</output-format>`;
}
