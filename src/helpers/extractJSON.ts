export function extractJson(text: string) {
  try {
    const codeBlockMatch = text.match(/```json([\s\S]*?)```/i);
    if (codeBlockMatch) {
      text = codeBlockMatch[1];
    }

    text = text.replace(/```/g, "").trim();

    text = text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

    text = text.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");

    return JSON.parse(text);
  } catch (e) {
    console.error("JSON PARSE FAILED:", e, "\nRaw:", text);
    return null;
  }
}
