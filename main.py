import asyncio
import json
import os
import sys
import uuid
from typing import Any

from google import genai
from google.adk.agents import Agent
from google.adk.models import Gemini
from google.adk.runners import InMemoryRunner
from google.genai import types

SYSTEM_PROMPT = """
You are a film production assistant specializing in extracting props, wardrobe, 
and set dressing from screenplays. Identify only physical items that the production 
needs to prepare for the scene. Return ONLY valid JSON with this exact structure:
{
  "sceneTitle": "brief title",
  "location": "scene location",
  "items": [
    {"matchedTerm": "exact inventory term", "requestedQty": 1}
  ]
}
Use only the matchedTerm values provided in the inventory. Do not fabricate terms. 
Include each item at most once and estimate requestedQty as a positive integer.
""".strip()

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

class StudioGemini(Gemini):
    """ADK Gemini model that reuses the app's explicitly configured client."""
    @property
    def api_client(self) -> genai.Client:
        return client

root_agent = Agent(
    name="film_production_prop_agent",
    model=StudioGemini(model="gemini-2.5-flash"),
    description="Extracts film production props, wardrobe, and set dressing from screenplay scenes.",
    instruction=SYSTEM_PROMPT,
    generate_content_config=types.GenerateContentConfig(
        response_mime_type="application/json",
    ),
)

fallback_agent = Agent(
    name="film_production_prop_agent_fallback",
    model=StudioGemini(model="gemini-3.6-flash"),
    description="Fallback film production prop extraction agent.",
    instruction=SYSTEM_PROMPT,
    generate_content_config=types.GenerateContentConfig(
        response_mime_type="application/json",
    ),
)

async def _run_agent(agent: Agent, prompt: str) -> dict[str, Any]:
    runner = InMemoryRunner(agent=agent, app_name="film_production_studio")
    session_id = f"scene-{uuid.uuid4().hex}"
    await runner.session_service.create_session(
        app_name=runner.app_name,
        user_id="studio-coordinator",
        session_id=session_id,
    )
    message = types.Content(
        role="user",
        parts=[types.Part.from_text(text=prompt)],
    )
    async for event in runner.run_async(
        user_id="studio-coordinator",
        session_id=session_id,
        new_message=message,
    ):
        if event.is_final_response() and event.content and event.content.parts:
            text = event.content.parts[0].text or "{}"
            return json.loads(text)
    raise RuntimeError("The ADK agent did not return a final response.")

async def analyze_scene(scene_text: str, inventory: list[dict[str, str]]) -> dict[str, Any]:
    """Run the formal ADK agent and return its structured extraction."""
    prompt = (
        "Inventario disponible:\n"
        f"{json.dumps(inventory, ensure_ascii=False)}\n\n"
        "Guion de la escena:\n"
        f"{scene_text}"
    )
    try:
        return await _run_agent(root_agent, prompt)
    except Exception as error:
        if "no longer available" not in str(error):
            raise
        return await _run_agent(fallback_agent, prompt)

def main() -> None:
    payload = json.loads(sys.stdin.read())
    result = asyncio.run(analyze_scene(payload["sceneText"], payload["inventory"]))
    print(json.dumps(result, ensure_ascii=False))

if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False))
        sys.exit(1)