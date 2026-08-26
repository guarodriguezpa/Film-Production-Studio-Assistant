---
name: Gemini ADK orchestration
description: The screenplay extraction path uses a formal Google ADK agent with a shared configured GenAI client.
---

Use a formal ADK `Agent` and `InMemoryRunner` for screenplay extraction, while keeping inventory matching and budget calculation outside the model boundary.

**Why:** The hackathon architecture requires Google ADK orchestration, but deterministic inventory joins still need server-side validation and should not be delegated to the model.

**How to apply:** Keep the system prompt and agent construction in the Python entry module; pass only structured extraction back to the API and preserve the existing response contract.