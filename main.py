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
Eres un asistente de producción cinematográfica especializado en extraer
utilería, vestuario y escenografía de guiones. Identifica únicamente elementos
físicos que la producción necesita preparar para la escena. Devuelve solo JSON
válido con esta estructura:
{
  "sceneTitle": "título breve",
  "location": "ubicación de la escena",
  "items": [
    {"matchedTerm": "término exacto del inventario", "requestedQty": 1}
  ]
}
Usa únicamente los valores de matchedTerm proporcionados en el inventario.
No inventes términos. Incluye cada elemento como máximo una vez y estima
requestedQty como un número entero positivo.
""".strip()

# Keep the explicit client construction requested by the application contract.
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
        # Google currently retires gemini-2.5-flash for some new accounts.
        # Keep it as the requested primary model and only fall back on the
        # provider's explicit model-retirement response.
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
