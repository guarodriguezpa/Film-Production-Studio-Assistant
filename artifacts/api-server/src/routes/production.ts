import { Router, type IRouter } from "express";
import { AnalyzeSceneBody, AnalyzeSceneResponse } from "@workspace/api-zod";
import { spawn } from "node:child_process";
import path from "node:path";

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

// This adapter mirrors the columns expected from the ClickHouse inventory table.
// It keeps the first-run experience useful when a studio has not connected a
// warehouse yet; the query boundary is intentionally isolated for easy wiring.
const inventory: InventoryRecord[] = [
  { id: "prop-001", name: "Vintage Typewriter", category: "Props", dailyCost: 85, stock: 2, status: "Available", condition: "Good", terms: ["typewriter", "olivetti"] },
  { id: "prop-002", name: "Desk Lamp", category: "Lighting", dailyCost: 35, stock: 5, status: "Available", condition: "Excellent", terms: ["desk lamp", "lamp"] },
  { id: "prop-003", name: "Rotary Telephone", category: "Props", dailyCost: 65, stock: 1, status: "Available", condition: "Good", terms: ["telephone", "phone"] },
  { id: "prop-004", name: "Wooden Writing Desk", category: "Furniture", dailyCost: 120, stock: 1, status: "Available", condition: "Excellent", terms: ["writing desk", "desk"] },
  { id: "prop-005", name: "Leather Armchair", category: "Furniture", dailyCost: 145, stock: 0, status: "In Repair", condition: "Repair in progress", terms: ["armchair", "chair"] },
  { id: "prop-006", name: "1950s Suitcase", category: "Props", dailyCost: 48, stock: 3, status: "Available", condition: "Good", terms: ["suitcase", "luggage"] },
  { id: "prop-007", name: "Pocket Watch", category: "Wardrobe", dailyCost: 28, stock: 2, status: "Available", condition: "Excellent", terms: ["pocket watch", "watch"] },
  { id: "prop-008", name: "Film Camera", category: "Camera", dailyCost: 210, stock: 0, status: "Unavailable", condition: "Checked out", terms: ["film camera", "camera"] },
];

type GeminiExtraction = {
  sceneTitle?: string;
  location?: string;
  items?: Array<{ matchedTerm?: string; requestedQty?: number }>;
};

const extractWithGemini = (sceneText: string): Promise<GeminiExtraction> =>
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
      inventory: inventory.flatMap((item) => item.terms.map((term) => ({ term, item: item.name }))),
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

  let extraction: GeminiExtraction;
  try {
    extraction = await extractWithGemini(parsed.data.sceneText);
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