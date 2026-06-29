---
name: Gemini API usage pattern
description: How to call @google/genai v2.x correctly in this codebase
---

## Rule
`@google/genai` v2.x API differs from v1. Always use:
- `contents` as a plain string (not an array of parts)
- `response.text` (not `response.candidates[0].content.parts[0].text`)
- `config: { responseMimeType: "application/json" }` for JSON output
- Model: `gemini-2.0-flash` (not gemini-1.5)

**Why:** v2 broke backward compat with v1 patterns. Using v1 patterns silently returns undefined.

## How to apply
```typescript
const response = await genai.models.generateContent({
  model: "gemini-2.0-flash",
  contents: promptString,  // plain string, NOT array
  config: { maxOutputTokens: 4096, responseMimeType: "application/json" },
});
const text = response.text ?? "[]";
```

## Quota handling
- Free tier quota exhausts frequently. Always catch 429/RESOURCE_EXHAUSTED.
- Pattern: try Gemini → catch quota error → use template fallback.
- Check: `errStr.includes("429") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("quota")`
- Template fallbacks exist in: `study-plans.ts`, `current-affairs.ts`
