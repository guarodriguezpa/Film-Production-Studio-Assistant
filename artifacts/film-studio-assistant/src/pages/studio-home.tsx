import { useMemo, useState } from "react";
import {
  getHealthCheckQueryKey,
  useAnalyzeScene,
  useHealthCheck,
} from "@workspace/api-client-react";
import type { InventoryItem, SceneAnalysis } from "@workspace/api-client-react";
import {
  Clapperboard,
  Download,
  FileText,
  Film,
  History,
  LocateFixed,
  PackageOpen,
  RefreshCw,
  ScanLine,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";

const EXAMPLE_SCENE = `INT. MARA'S APARTMENT - NIGHT

Mara enters carrying a canvas tote and sets a chipped ceramic mug beside an old brass desk lamp. She checks the time on a silver wristwatch, then opens a wooden drawer and removes a manila envelope. A framed photograph leans against the books. Rain ticks against the window.`;

type Filter = "All" | InventoryItem["status"];

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function statusClass(status: InventoryItem["status"]) {
  if (status === "Available") return "status-available";
  if (status === "In Repair") return "status-repair";
  return "status-unavailable";
}

function SkeletonReport() {
  return (
    <section
      className="loading-results"
      aria-label="Preparing scene report"
      data-testid="loading-scene-report"
    >
      <div className="skeleton loading-bar" />
      <div className="skeleton loading-title" />
      <div className="loading-metrics">
        <div className="skeleton loading-metric" />
        <div className="skeleton loading-metric" />
        <div className="skeleton loading-metric" />
        <div className="skeleton loading-metric" />
      </div>
    </section>
  );
}

function EmptyReport() {
  return (
    <section className="empty-results" data-testid="empty-scene-report">
      <PackageOpen size={27} strokeWidth={1.3} />
      <p
        style={{
          margin: "12px 0 5px",
          color: "hsl(var(--foreground))",
          fontWeight: 600,
        }}
      >
        Your pull list is waiting.
      </p>
      <p style={{ margin: 0 }}>
        Paste a scene page above to surface every prop, its match, and its cost.
      </p>
    </section>
  );
}

function InventoryTable({ analysis }: { analysis: SceneAnalysis }) {
  const [filter, setFilter] = useState<Filter>("All");
  const filteredItems = useMemo(
    () =>
      filter === "All"
        ? analysis.items
        : analysis.items.filter((item) => item.status === filter),
    [analysis.items, filter],
  );
  const counts = useMemo(
    () => ({
      All: analysis.items.length,
      Available: analysis.items.filter((item) => item.status === "Available")
        .length,
      "In Repair": analysis.items.filter((item) => item.status === "In Repair")
        .length,
      Unavailable: analysis.items.filter(
        (item) => item.status === "Unavailable",
      ).length,
    }),
    [analysis.items],
  );

  return (
    <section
      aria-labelledby="inventory-heading"
      data-testid="section-inventory"
    >
      <div className="inventory-head">
        <h2 id="inventory-heading" className="inventory-title">
          Extracted inventory
        </h2>
        <div className="filter-row" role="group" aria-label="Filter inventory">
          {(["All", "Available", "In Repair", "Unavailable"] as Filter[]).map(
            (option) => (
              <button
                type="button"
                key={option}
                className={`filter-button ${filter === option ? "selected" : ""}`}
                onClick={() => setFilter(option)}
                data-testid={`button-filter-${option.toLowerCase().replace(" ", "-")}`}
              >
                {option} <span style={{ opacity: 0.55 }}>{counts[option]}</span>
              </button>
            ),
          )}
        </div>
      </div>
      {filteredItems.length > 0 ? (
        <div className="table-wrap">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Prop / matched term</th>
                <th>Category</th>
                <th>Need</th>
                <th>On hand</th>
                <th>Daily rate</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} data-testid={`row-inventory-${item.id}`}>
                  <td>
                    <div
                      className="item-name"
                      data-testid={`text-item-name-${item.id}`}
                    >
                      {item.name}
                    </div>
                    {item.matchedTerm && (
                      <div className="item-term">“{item.matchedTerm}”</div>
                    )}
                  </td>
                  <td className="category-text">{item.category}</td>
                  <td className="stock-text">{item.requestedQty}</td>
                  <td className="stock-text">{item.stock}</td>
                  <td className="money">{formatMoney(item.dailyCost)}</td>
                  <td>
                    <span
                      className={`status-pill ${statusClass(item.status)}`}
                      data-testid={`status-item-${item.id}`}
                    >
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-results">No props in this status bucket.</div>
      )}
    </section>
  );
}

function AnalysisReport({ analysis }: { analysis: SceneAnalysis }) {
  const handleExport = () => {
    const rows = analysis.items.map((item) =>
      [
        item.name,
        item.category,
        item.requestedQty,
        item.stock,
        formatMoney(item.dailyCost),
        item.status,
      ].join(","),
    );
    const csv = ["Prop,Category,Need,On hand,Daily rate,Status", ...rows].join(
      "\n",
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${analysis.sceneTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-pull-list.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const judge = (analysis as any).judgeVerdict;

  return (
    <section className="results-shell" data-testid="scene-analysis-report">
      <div className="report-header">
        <div>
          <div className="eyebrow">Scene report / 01</div>
          <h1 className="report-title" data-testid="text-scene-title">
            {analysis.sceneTitle}
          </h1>
          <div className="report-location" data-testid="text-scene-location">
            <LocateFixed /> {analysis.location}
          </div>
        </div>
        <button
          type="button"
          className="outline-button"
          onClick={handleExport}
          data-testid="button-export-pull-list"
        >
          <Download /> Export pull list
        </button>
      </div>

      <div className="metric-grid" data-testid="scene-metrics">
        <div className="metric-card highlight">
          <div className="metric-value" data-testid="text-total-daily-cost">
            {formatMoney(analysis.totalDailyCost)}
          </div>
          <div className="metric-caption">Estimated daily pull</div>
        </div>
        <div className="metric-card">
          <div className="metric-value" data-testid="text-extracted-count">
            {analysis.extractedCount}
          </div>
          <div className="metric-caption">Props found</div>
        </div>
        <div className="metric-card">
          <div className="metric-value" data-testid="text-available-count">
            {analysis.availableCount}
          </div>
          <div className="metric-caption">Ready to pull</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">
            {Math.max(analysis.extractedCount - analysis.availableCount, 0)}
          </div>
          <div className="metric-caption">Needs attention</div>
        </div>
      </div>

      {/* HACKATHON FEATURE: Display Continuity & Budget Judge Verdict */}
      {judge && (
        <div
          style={{
            margin: "20px 0",
            padding: "16px",
            borderRadius: "8px",
            border: `1px solid ${judge.is_approved ? "#10B981" : "#EF4444"}`,
            backgroundColor: judge.is_approved
              ? "rgba(16, 185, 129, 0.1)"
              : "rgba(239, 68, 68, 0.1)",
            color: "#FFFFFF",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "8px",
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: "1.1rem",
                color: judge.is_approved ? "#10B981" : "#EF4444",
              }}
            >
              {judge.is_approved
                ? "PRODUCER VERDICT: APPROVED"
                : "PRODUCER VERDICT: BUDGET REJECTED"}
            </h3>
            <span style={{ fontSize: "0.85rem", opacity: 0.8 }}>
              Google ADK Judge Agent
            </span>
          </div>

          <p
            style={{
              margin: "0 0 10px 0",
              fontSize: "0.95rem",
              lineHeight: "1.4",
            }}
          >
            {judge.producer_feedback}
          </p>

          {judge.continuity_warnings &&
            judge.continuity_warnings.length > 0 && (
              <div
                style={{
                  marginTop: "10px",
                  paddingTop: "10px",
                  borderTop: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <strong style={{ fontSize: "0.85rem", color: "#F59E0B" }}>
                  Continuity Warnings:
                </strong>
                <ul
                  style={{
                    margin: "5px 0 0 20px",
                    padding: 0,
                    fontSize: "0.85rem",
                    color: "#CBD5E1",
                  }}
                >
                  {judge.continuity_warnings.map(
                    (warning: string, idx: number) => (
                      <li key={idx}>{warning}</li>
                    ),
                  )}
                </ul>
              </div>
            )}
        </div>
      )}

      <InventoryTable analysis={analysis} />
    </section>
  );
}

export default function StudioHome() {
  const [sceneText, setSceneText] = useState("");
  const [analysis, setAnalysis] = useState<SceneAnalysis | null>(null);
  const analyzeScene = useAnalyzeScene();
  const health = useHealthCheck({
    query: { queryKey: getHealthCheckQueryKey() },
  });
  const charCount = sceneText.length;
  const hasText = sceneText.trim().length >= 10;

  const submitScene = () => {
    if (!hasText) return;
    analyzeScene.mutate(
      { data: { sceneText: sceneText.trim() } },
      {
        onSuccess: (result) => setAnalysis(result),
      },
    );
  };

  const clearScene = () => {
    setSceneText("");
    setAnalysis(null);
    analyzeScene.reset();
  };

  return (
    <div className="studio-app">
      <aside className="studio-rail" data-testid="navigation-rail">
        <div className="brand-mark" data-testid="text-brand">
          <span className="brand-glyph" aria-hidden="true">
            <Clapperboard size={15} strokeWidth={1.4} />
          </span>
          <span className="brand-name">Framehouse</span>
        </div>
        <div className="eyebrow rail-eyebrow">Production desk</div>
        <nav className="rail-nav" aria-label="Primary navigation">
          <a
            className="rail-link active"
            href="#analyze"
            data-testid="link-analyze"
          >
            <ScanLine /> Analyze scene
          </a>
          <a
            className="rail-link"
            href="#inventory"
            data-testid="link-inventory"
          >
            <PackageOpen /> Inventory
          </a>
          <a className="rail-link" href="#recent" data-testid="link-recent">
            <History /> Recent scenes
          </a>
        </nav>
        <div className="rail-foot">
          <div className={`health-line`} data-testid="status-api-health">
            <span
              className={`health-dot ${health.isLoading ? "loading" : health.isError ? "error" : ""}`}
            />
            {health.isLoading
              ? "Checking studio link"
              : health.isError
                ? "Studio link offline"
                : "Studio link healthy"}
          </div>
          <div
            style={{
              marginTop: 9,
              color: "hsl(var(--sidebar-foreground) / .35)",
              font: "10px var(--app-font-mono)",
            }}
          >
            v0.8.4 / NORTH LOT
          </div>
        </div>
      </aside>

      <main className="studio-main" id="analyze">
        <div className="studio-content">
          <div className="topline">
            <div className="topline-date">Tuesday / 14 May 2024</div>
            <div className="crew-avatar" title="Production coordinator">
              MK
            </div>
          </div>

          <section className="hero-grid" aria-labelledby="page-heading">
            <div>
              <div className="eyebrow">Props intelligence</div>
              <h1 id="page-heading" className="hero-title">
                From page
                <br />
                to <em>pull list.</em>
              </h1>
              <p className="hero-note">
                Give your crew a clean read on the objects inside a scene — what
                is ready, what needs repair, and what still needs a plan.
              </p>
            </div>
            <div className="input-panel">
              <div className="input-panel-head">
                <label htmlFor="scene-text" className="panel-label">
                  Paste screenplay scene
                </label>
                <button
                  type="button"
                  className="example-button"
                  onClick={() => setSceneText(EXAMPLE_SCENE)}
                  data-testid="button-load-example"
                >
                  Use example scene
                </button>
              </div>
              <textarea
                id="scene-text"
                className="scene-textarea"
                value={sceneText}
                onChange={(event) => setSceneText(event.target.value)}
                placeholder={
                  "INT. LOCATION - TIME\n\nPaste a scene here. We’ll identify every prop your team needs to find."
                }
                aria-describedby="scene-help"
                data-testid="input-scene-text"
              />
              <div className="input-foot">
                <div id="scene-help" className="input-help">
                  <span data-testid="text-character-count">
                    {charCount.toLocaleString()}
                  </span>{" "}
                  characters · minimum 10
                  {sceneText && (
                    <button
                      type="button"
                      onClick={clearScene}
                      className="text-button"
                      style={{ marginLeft: 8 }}
                      data-testid="button-clear-scene"
                    >
                      <X size={11} style={{ verticalAlign: "-2px" }} /> Clear
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  className="primary-button"
                  disabled={!hasText || analyzeScene.isPending}
                  onClick={submitScene}
                  data-testid="button-analyze-scene"
                >
                  {analyzeScene.isPending ? (
                    <>
                      <RefreshCw className="animate-spin" /> Reading the page
                    </>
                  ) : (
                    <>
                      <Sparkles /> Analyze scene
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>

          {analyzeScene.isError && (
            <div
              className="error-banner"
              role="alert"
              data-testid="status-analysis-error"
            >
              <span>
                We couldn’t read this scene right now. Check the studio link and
                try again.
              </span>
              <button
                type="button"
                className="text-button"
                onClick={submitScene}
                data-testid="button-retry-analysis"
              >
                Retry
              </button>
            </div>
          )}

          <div className="section-rule" />
          {analyzeScene.isPending ? (
            <SkeletonReport />
          ) : analysis ? (
            <AnalysisReport analysis={analysis} />
          ) : (
            <EmptyReport />
          )}

          <div id="inventory" style={{ height: 1 }} />
          <div id="recent" style={{ height: 1 }} />
        </div>
      </main>
    </div>
  );
}
