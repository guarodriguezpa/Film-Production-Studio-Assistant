import asyncio
import json
import os
import sys
import uuid
from typing import Any, List
from pydantic import BaseModel, Field

from google import genai
from google.adk.agents import Agent
from google.adk.models import Gemini
from google.adk.runners import InMemoryRunner
from google.genai import types

class JudgeDecision(BaseModel):
    is_approved: bool = Field(..., description="True if the total cost is reasonable (under $300), False if it exceeds the budget.")
    continuity_warnings: List[str] = Field(default_factory=list, description="Warnings about missing logical items based on the scene.")
    producer_feedback: str = Field(..., description="A brief and strict note from the producer regarding the budget and missing items.")

SYSTEM_PROMPT = """
You are a strict Line Producer for an action film. Your job is to review the prop report extracted from a scene and its daily rental cost from ClickHouse.
The maximum acceptable budget for props in a single scene is $300.
1. Evaluate the total cost. If it exceeds $300, reject the budget (is_approved: false) and demand cuts.
2. Evaluate logical continuity based on the item list. For example, if there are 'guns', warn if 'holsters' or 'ammo' are missing. If there are 'syringes', warn if 'vials' or tourniquets are missing.
Do not invent items that do not make sense with the provided data. Be direct and professional.
""".strip()

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