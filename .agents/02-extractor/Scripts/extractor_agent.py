import asyncio
import json
import os
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

# 2. Esquemas Pydantic
class PropItem(BaseModel):
    matchedTerm: str = Field(..., description="Exact inventory term matched from the provided list.")
    requestedQty: int = Field(..., ge=1, description="Positive integer quantity requested.")

class SceneInventorySchema(BaseModel):
    sceneTitle: str = Field(..., description="Brief title of the scene.")
    location: str = Field(..., description="Scene location.")
    items: List[PropItem] = Field(default_factory=list, description="List of physical items needed.")

# 3. Configuración del Agente ADK
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

class StudioGemini(Gemini):
    @property
    def api_client(self) -> genai.Client:
        return client

root_agent = Agent(
    name="film_production_prop_agent",
    model=StudioGemini(model="gemini-2.5-flash"),
    description="Extracts film production props, wardrobe, and set dressing from screenplay scenes.",
    instruction=SYSTEM_PROMPT,
    output_schema=SceneInventorySchema,
)

# ... (Aquí va el resto de tus funciones _run_agent y analyze_scene sin cambios) ...