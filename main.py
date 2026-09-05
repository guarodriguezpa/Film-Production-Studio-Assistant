import os
import sys

# 1. FORZAMOS A REPLIT A LEER LAS LIBRERÍAS (Como en tu arquitectura vieja)
import clickhouse_connect
import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel

# 2. Conectamos la nueva arquitectura
sys.path.append(os.path.join(os.path.dirname(__file__), ".agents", "01-orchestrator", "Scripts"))

try:
    from orchestrator import run_pipeline
except ImportError as e:
    print(f"Error cargando el orquestador: {e}")
    sys.exit(1)

# 3. Configurar la App
app = FastAPI(title="Agentic Cinema API")

class ScenePayload(BaseModel):
    sceneText: str
    inventory: list

# 4. Endpoint principal
@app.post("/analyze-scene")
async def analyze_scene_endpoint(payload: ScenePayload):
    try:
        result = await run_pipeline(payload.sceneText, payload.inventory)
        return {"status": "success", "data": result}
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)