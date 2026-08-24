import { Router, type IRouter } from "express";
import { AnalyzeSceneBody, AnalyzeSceneResponse } from "@workspace/api-zod";

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

const uniqueMatches = (sceneText: string) => {
  const normalized = sceneText.toLowerCase();
  return inventory
    .map((item) => {
      const matchedTerm = item.terms.find((term) => normalized.includes(term));
      return matchedTerm ? { item, matchedTerm } : null;
    })
    .filter((match): match is { item: InventoryRecord; matchedTerm: string } => Boolean(match));
};

const inferTitle = (sceneText: string) => {
  const heading = sceneText.match(/(?:int\.|ext\.|scene)\s+([^\n]+)/i)?.[1]?.trim();
  return heading ? heading.replace(/\s+-\s+.*$/, "") : "Untitled scene";
};

const inferLocation = (sceneText: string) => {
  const match = sceneText.match(/(?:int\.|ext\.)\s+([^\n-]+?)(?:\s+-|\n|$)/i)?.[1]?.trim();
  return match ? match.charAt(0).toUpperCase() + match.slice(1).toLowerCase() : "Location not specified";
};

const router: IRouter = Router();

router.post("/production/scene-analysis", (req, res) => {
  const parsed = AnalyzeSceneBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Paste at least 10 characters of scene text to analyze." });
    return;
  }

  const matches = uniqueMatches(parsed.data.sceneText);
  const items = matches.map(({ item, matchedTerm }) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    dailyCost: item.dailyCost,
    stock: item.stock,
    status: item.status,
    requestedQty: 1,
    condition: item.condition,
    matchedTerm,
  }));
  const availableCount = items.filter((item) => item.status === "Available").length;
  const response = {
    sceneTitle: inferTitle(parsed.data.sceneText),
    location: inferLocation(parsed.data.sceneText),
    extractedCount: items.length,
    availableCount,
    totalDailyCost: items.filter((item) => item.status === "Available").reduce((sum, item) => sum + item.dailyCost, 0),
    items,
  };

  res.json(AnalyzeSceneResponse.parse(response));
});

export default router;