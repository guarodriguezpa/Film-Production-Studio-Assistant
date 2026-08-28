import { Router, type IRouter } from "express";
import { AnalyzeSceneBody, AnalyzeSceneResponse } from "@workspace/api-zod";
import { spawn } from "node:child_process";
import path from "node:path";
import { createClient } from "@clickhouse/client"; // Cliente oficial de ClickHouse para Node

type InventoryRecord = {
  id: string;
  name: string;
  category: string;
  dailyCost: number;
  stock: number;
  status: "Available" | "In Repair" | "Unavailable";
  condition: string;
  terms: string[];
};

// Inicializamos el cliente de ClickHouse usando las variables de entorno de tu proyecto
const clickhouse = createClient({
  url: process.env.CLICKHOUSE_HOST || process.env.CLICKHOUSE_URL,
  username: process.env.CLICKHOUSE_USER || "default",
  password: process.env.CLICKHOUSE_PASSWORD || "",
});

// Función para obtener el inventario directamente desde la base de datos ClickHouse
async function fetchInventoryFromClickHouse(): Promise<InventoryRecord[]> {
  try {
    const resultSet = await clickhouse.query({
      query: 'SELECT item_id, item_name, category, daily_rent_cost, stock_available, warehouse_location FROM prop_inventory',
      format: 'JSONEachRow',
    });
    const rows = await resultSet.json<any[]>();

    // Mapeamos los campos de ClickHouse al formato que espera tu aplicación
    return rows.map((row, index) => ({
      id: row.item_id || `prop-${index + 1}`,
      name: row.item_name,
      category: row.category || "Props",
      dailyCost: Number(row.daily_rent_cost) || 50,
      stock: Number(row.stock_available) || 1,
      status: Number(row.stock_available) > 0 ? "Available" : "Unavailable",
      condition: "Good",
      // Generamos los términos de búsqueda automáticamente a partir del nombre del ítem
      terms: [row.item_name.toLowerCase(), row.item_name.split(" ")[0].toLowerCase()]
    }));
  } catch (error) {
    console.error("Error consultando ClickHouse, usando respaldo:", error);
    // Si llegara a fallar la red, devolvemos un arreglo vacío para evitar caídas
    return [];
  }
}

type GeminiExtraction = {
  sceneTitle?: string;
  location?: string;
  items?: Array<{ matchedTerm?: string; requestedQty?: number }>;
};

const extractWithGemini = (sceneText: string, inventoryList: InventoryRecord[]): Promise<GeminiExtraction> =>
  new Promise((resolve, reject) => {
    const python = spawn("python", [path.resolve(process.cwd(), "python/scene_analyzer.py")], {
      env: process.env,
    });
    let output = "";
    let errorOutput = "";
    python.stdout.on("data", (chunk: Buffer) => { output += chunk.toString(); });
    python.stderr.on("data", (chunk: Buffer) => { errorOutput += chunk.toString(); });
    python.on("error", reject);
    python.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(errorOutput || "Gemini analysis failed."));
        return;
      }
      try {
        const result = JSON.parse(output) as GeminiExtraction & { error?: string };
        if (result.error) reject(new Error(result.error));
        else resolve(result);
      } catch {
        reject(new Error("Gemini returned an invalid scene analysis."));
      }
    });
    python.stdin.write(JSON.stringify({
      sceneText,
      inventory: inventoryList.flatMap((item) => item.terms.map((term) => ({ term, item: item.name }))),
    }));
    python.stdin.end();
  });

const router: IRouter = Router();

router.post("/production/scene-analysis", async (req, res) => {
  const parsed = AnalyzeSceneBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Paste at least 10 characters of scene text to analyze." });
    return;
  }

  // 1. Consultamos el inventario en vivo desde ClickHouse en cada petición
  const inventory = await fetchInventoryFromClickHouse();

  let extraction: GeminiExtraction;
  try {
    extraction = await extractWithGemini(parsed.data.sceneText, inventory);
  } catch {
    res.status(502).json({ error: "Gemini could not analyze this scene. Please try again." });
    return;
  }

  const items = (extraction.items ?? []).flatMap((match) => {
    const matchedTerm = match.matchedTerm?.toLowerCase();
    const item = inventory.find((candidate) =>
      candidate.name.toLowerCase() === matchedTerm ||
      candidate.terms.some((term) => term.toLowerCase() === matchedTerm),
    );
    if (!item) return [];
    return [{
      id: item.id,
      name: item.name,
      category: item.category,
      dailyCost: item.dailyCost,
      stock: item.stock,
      status: item.status,
      requestedQty: Math.max(1, Math.round(match.requestedQty ?? 1)),
      condition: item.condition,
      matchedTerm,
    }];
  });
  const availableCount = items.filter((item) => item.status === "Available").length;
  const response = {
    sceneTitle: extraction.sceneTitle || "Untitled scene",
    location: extraction.location || "Location not specified",
    extractedCount: items.length,
    availableCount,
    totalDailyCost: items.filter((item) => item.status === "Available").reduce((sum, item) => sum + item.dailyCost, 0),
    items,
  };

  res.json(AnalyzeSceneResponse.parse(response));
});

export default router;