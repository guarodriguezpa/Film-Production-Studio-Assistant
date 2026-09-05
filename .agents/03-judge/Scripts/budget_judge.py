import asyncio
import json
import os
import sys
import uuid
from pathlib import Path
from typing import Any, List
from pydantic import BaseModel, Field

from google import genai
from google.adk.agents import Agent
from google.adk.models import Gemini
from google.adk.runners import InMemoryRunner
from google.genai import types

# 1. Leer las instrucciones desde SKILL.md
SKILL_PATH = Path(__file__).parent.parent / "SKILL.md"
with open(SKILL_PATH, "r", encoding="utf-8") as f:
    SYSTEM_PROMPT = f.read().strip()

# 2. Esquema Pydantic para la decisión del Juez
class JudgeDecision(BaseModel):
    is_approved: bool = Field(..., description="True if the total cost is reasonable (under $300), False if it exceeds the budget.")
    continuity_warnings: List[str] = Field(default_factory=list, description="Warnings about missing logical items based on the scene.")
    producer_feedback: str = Field(..., description="A brief and strict note from the producer regarding the budget and missing items.")

# 3. Configuración del Agente ADK
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

class StudioGemini(Gemini):
    @property
    def api_client(self) -> genai.Client:
        return client

judge_agent = Agent(
    name="film_production_budget_judge",
    model=StudioGemini(model="gemini-3.6-flash"),
    description="Evaluates scene prop budgets and continuity logic.",
    instruction=SYSTEM_PROMPT,
    output_schema=JudgeDecision,
)

async def evaluate_budget(report_data: dict[str, Any]) -> dict[str, Any]:
    runner = InMemoryRunner(agent=judge_agent, app_name="film_production_studio")
    session_id = f"judge-{uuid.uuid4().hex}"
    await runner.session_service.create_session(
        app_name=runner.app_name,
        user_id="producer",
        session_id=session_id,
    )

    prompt = f"Scene Prop Report:\n{json.dumps(report_data, ensure_ascii=False)}"
    message = types.Content(role="user", parts=[types.Part.from_text(text=prompt)])

    async for event in runner.run_async(
        user_id="producer",
        session_id=session_id,
        new_message=message,
    ):
        if event.is_final_response() and event.content and event.content.parts:
            text = event.content.parts[0].text or "{}"
            validated_output = JudgeDecision(**json.loads(text))
            return validated_output.model_dump()

    raise RuntimeError("The Judge Agent did not return a response.")

def main() -> None:
    payload = json.loads(sys.stdin.read())
    result = asyncio.run(evaluate_budget(payload))
    print(json.dumps(result, ensure_ascii=False))

if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False))
        sys.exit(1)