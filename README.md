# 🎬 Agentic Cinema - AI Film Production Assistant

An AI-powered multi-agent workflow designed to streamline film production planning. This system automatically analyzes screenplays, extracts required physical assets, and cross-references them with live inventory data to compute production budgets in real-time.

## 🚀 Key Features

* **AI Scene Breakdown (Agent 1):** Utilizes the Gemini API to intelligently ingest raw screenplay text (like our Billy test scene) and extract every prop, wardrobe item, and set piece required.
* **Real-Time Inventory Sync (Agent 2):** Connects directly to **ClickHouse** to query live physical inventory, checking stock levels, repair status, and rental categories.
* **Dynamic Budget Calculation:** Automatically computes the total daily rental budget for the scene based on the availability and pricing of the extracted items.
* **Multi-Agent Architecture:** A seamless handoff between a Node.js/Express backend and a Python-powered analytical engine.

## 🛠️ Tech Stack

* **Database:** ClickHouse Cloud (High-speed inventory querying)
* **AI / LLM:** Google Gemini API (Scene analysis and extraction)
* **Backend:** Node.js, Express.js, TypeScript, Python
* **Deployment & Environment:** Replit

## 🚦 How to Run the App (For Judges)

1. Click the **"Run"** button at the top of this Repl to start the backend server.
2. Wait a few seconds for the console to display `Server listening port: 3000`.
3. The web interface will load automatically in the preview window.
4. Paste a screenplay snippet into the input field and click "Analyze".
5. Watch as the multi-agent system processes the text, queries the ClickHouse database, and generates the final dashboard and budget!

---
*Built for the Agentic Cinema: The Blockbuster Hackathon*