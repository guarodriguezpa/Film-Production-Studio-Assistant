# 🎬 Agentic Cinema - AI Film Production Assistant

An AI-powered multi-agent workflow built with the Google Agent Development Kit (ADK) to streamline film production planning. This system automatically analyzes screenplays, extracts required physical assets, cross-references them with live inventory data, and enforces business logic like budget limits and continuity checks in real-time.

## 🚀 Key Features
Raw Screenplay (Input)
                                      │
                                      ▼
              ┌───────────────────────────────────────────────┐
              │                                               │
              │             ORCHESTRATOR AGENT                │
              │           (Central Hub & Manager)             │
              │                                               │
              │   3. Uses Skill to query DB with extracted ◄──┼─── ClickHouse
              │      items to get prices and availability     │    (Inventory DB)
              └─────┬──────▲─────────────────────┬──────▲─────┘
                    │      │                     │      │
         1. Sends   │      │ 2. Returns          │      │ 5. Returns
         Script     │      │ Items               │      │ Budget/Logic
                    │      │ Report              │      │ Report
                    ▼      │                     ▼      │
              ┌────────────┴─┐    4. Sends     ┌────────────┴─┐
              │   Agent 01   │    DB Info &    │ Judge Agent  │
              │ (Extractor)  │    Prop List    │ (Evaluator)  │
              └──────────────┘                 └──────────────┘
                 (Analyzes text                  (Checks errors
                 & extracts props)               & budget limits)
                                      │
                    6. Generates Final Consolidated Report
                                      │
                                      ▼
                           Agentic Web Dashboard UI
                  (Final Inventory + Judge Recommendations)

* **AI Scene Breakdown (Extractor Agent):** Utilizes the Gemini API via Google ADK to intelligently ingest raw screenplay text and extract every prop, wardrobe item, and set piece required.
* **Real-Time Inventory Sync (Inventory Agent):** Connects directly to ClickHouse Cloud to query live physical inventory, verifying stock levels, repair statuses, and rental pricing in milliseconds.
* **Automated Business Logic (Judge Agent):** Evaluates the extracted data against strict production rules, automatically flagging continuity warnings (e.g., missing holsters for weapons) and enforcing daily budget caps.
* **Dynamic Budget Calculation:** Automatically computes the total daily rental budget for the scene based on database availability.
* **Multi-Agent Architecture:** A seamless, serverless handoff between specialized AI agents orchestrated entirely in Python.

## 🛠️ Tech Stack

* **AI / Multi-Agent Framework:** Google Agent Development Kit (ADK), Google Gemini API
* **Database:** ClickHouse Cloud (High-speed analytical querying)
* **Backend:** Python, FastAPI
* **Deployment & Environment:** Replit

## 🚦 How to Run the App (For Judges)

1. Click the **Live Demo link** provided in Devpost, or click the **"Run"** button at the top of this Repl to start the backend server.
2. Wait a few seconds for the FastAPI server to initialize.
3. The web interface will load automatically in your browser or Replit preview window.
4. Paste a screenplay snippet into the input field and click "Analyze".
5. Watch as the multi-agent system processes the text, queries the ClickHouse database, and generates the final dashboard with the Judge Agent's budget and continuity verdict!

---
*Built for the Agentic Cinema: The Blockbuster Hackathon*
