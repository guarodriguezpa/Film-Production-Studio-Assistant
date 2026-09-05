import asyncio
import json
import os
import sys
import uuid
import importlib.util
from pathlib import Path
from typing import Any

from google import genai
from google.adk.agents import Agent
from google.adk.models import Gemini
from google.adk.runners import InMemoryRunner
from google.genai import types
import clickhouse_connect  # Conector oficial para ClickHouse

# 1. Leer las instrucciones desde SKILL.md
SKILL_PATH = Path(__file__).parent.parent / "SKILL.md"
with open(SKILL_PATH, "r", encoding="utf-8") as f:
    SYSTEM_PROMPT = f.read().strip()

# 2. Cargar dinámicamente los scripts de los otros agentes
base_agents_dir = Path(__file__).parent.parent.parent

def load_agent_module(module_name: str, relative_path: str):
    file_path = base_agents_dir / relative_path
    spec = importlib.util.spec_from_file_location(module_name, str(file_path))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

extractor_module = load_agent_module("extractor", "02-extractor/Scripts/extractor_agent.py")
judge_module = load_agent_module("judge", "03-judge/Scripts/budget_judge.py")

# 3. Definir las Herramientas (Tools) para el Orquestador

async def extract_scene_props(scene_text: str, inventory_json: str) -> dict:
    """
    Extracts physical props from a screenplay scene. Use this tool first.

    Args:
        scene_text: The raw text of the screenplay scene.
        inventory_json: A JSON string representation of the available inventory list.
    """
    inventory = json.loads(inventory_json)
    return await extractor_module.analyze_scene(scene_text, inventory)

async def fetch_prices_from_clickhouse(extracted_items_json: str) -> dict:
    """
    Connects to the ClickHouse database using Replit secrets to fetch the daily rental cost for specific prop items. Use this tool second.

    Args:
        extracted_items_json: A JSON string list of the matchedTerms returned by the extract_scene_props tool.
    """
    items = json.loads(extracted_items_json)

    # Extraer los nombres de los items devueltos por el extractor
    item_names = [item["matchedTerm"] for item in items.get("items", [])]

    try:
        # Conexión real usando tus variables de entorno de Replit Secrets
        client_ch = clickhouse_connect.get_client(
            host=os.environ.get("CLICKHOUSE_HOST"),
            username=os.environ.get("CLICKHOUSE_USER"),
            password=os.environ.get("CLICKHOUSE_PASSWORD"),
            port=int(os.environ.get("CLICKHOUSE_PORT", "8443")),
            secure=True
        )

        query = """
            SELECT item_name, daily_rental_cost 
            FROM scene_inventory_prices 
            WHERE item_name IN ({})
        """.format(','.join(['%(val_' + str(i) + ')s' for i in range(len(item_names))]))

        parameters = {f'val_{i}': name for i, name in enumerate(item_names)}
        result = client_ch.query(query, parameters=parameters)

        db_prices = {row[0]: row[1] for row in result.result_rows}

        priced_items = []
        total_cost = 0

        for item in items.get("items", []):
            name = item["matchedTerm"]
            qty = item.get("requestedQty", 1)
            unit_cost = db_prices.get(name, 0.0)
            item_total = unit_cost * qty

            priced_items.append({
                "matchedTerm": name,
                "requestedQty": qty,
                "unitCost": unit_cost,
                "totalItemCost": item_total
            })
            total_cost += item_total

        return {
            "sceneTitle": items.get("sceneTitle", "Unknown Scene"),
            "location": items.get("location", "Unknown Location"),
            "items_with_prices": priced_items,
            "total_scene_cost": total_cost,
            "database_status": "Connected successfully to ClickHouse via Replit Secrets"
        }

    except Exception as e:
        return {
            "error": f"Failed to connect to ClickHouse: {str(e)}",
            "items_with_prices": [],
            "total_scene_cost": 0
        }

async def evaluate_scene_budget(prop_report_with_prices: dict) -> dict:
    """
    Evaluates the budget and logical continuity of the priced prop report. Use this tool third.

    Args:
        prop_report_with_prices: The combined report containing both the extracted items and their costs from ClickHouse.
    """
    return await judge_module.evaluate_budget(prop_report_with_prices)

# 4. Configurar el Agente Orquestador
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

class StudioGemini(Gemini):
    @property
    def api_client(self) -> genai.Client:
        return client

orchestrator_agent = Agent(
    name="film_studio_orchestrator",
    model=StudioGemini(model="gemini-2.5-pro"), 
    description="Orchestrates script extraction, database queries, and budget judging.",
    instruction=SYSTEM_PROMPT,
    tools=[extract_scene_props, fetch_prices_from_clickhouse, evaluate_scene_budget], 
)

async def run_pipeline(scene_text: str, inventory: list[dict[str, str]]) -> str:
    runner = InMemoryRunner(agent=orchestrator_agent, app_name="film_production_studio")
    session_id = f"orchestrator-{uuid.uuid4().hex}"
    await runner.session_service.create_session(
        app_name=runner.app_name,
        user_id="director",
        session_id=session_id,
    )

    inventory_str = json.dumps(inventory, ensure_ascii=False)
    prompt = f"Please process this scene.\n\nInventory List (Available terms):\n{inventory_str}\n\nScene:\n{scene_text}"
    message = types.Content(role="user", parts=[types.Part.from_text(text=prompt)])

    final_response_text = ""
    async for event in runner.run_async(
        user_id="director",
        session_id=session_id,
        new_message=message,
    ):
        if event.is_final_response() and event.content and event.content.parts:
            final_response_text = event.content.parts[0].text

    return final_response_text

def main() -> None:
    sample_payload = {
        "sceneText": "INT. WAREHOUSE - NIGHT\nThe hero bursts in. He draws his gun. He kicks a wooden crate out of the way.",
        "inventory": [
            {"matchedTerm": "gun"}, 
            {"matchedTerm": "wooden crate"},
            {"matchedTerm": "holster"}
        ]
    }

    result = asyncio.run(run_pipeline(sample_payload["sceneText"], sample_payload["inventory"]))
    print("=== RESULTADO FINAL DEL ORQUESTADOR ===")
    print(result)

if __name__ == "__main__":
    main()