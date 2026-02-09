import { useState, useEffect, useRef } from "react";

const QUESTIONS = [
  {
    id: 1,
    question: "What is the price of the Pro Plan?",
    staleAnswer: {
      text: "The Pro Plan is $29/month. It includes 10 team members, 50GB storage, and priority email support.",
      source: "Training data (6 months ago)",
      confidence: "High",
      correct: false,
    },
    ragAnswer: {
      text: "The Pro Plan is now $39/month (updated last week). It includes 25 team members, 100GB storage, priority support, and the new AI Assistant feature.",
      source: "Live pricing API → last updated 2 hours ago",
      confidence: "High",
      correct: true,
    },
    realAnswer: "The Pro Plan was updated to $39/month with expanded features 3 weeks ago.",
    category: "Pricing",
  },
  {
    id: 2,
    question: "What's our company's return policy?",
    staleAnswer: {
      text: "Our return policy allows returns within 30 days of purchase with a receipt. Items must be in original packaging.",
      source: "Training data (6 months ago)",
      confidence: "High",
      correct: false,
    },
    ragAnswer: {
      text: "As of January 2026, our return policy allows returns within 60 days. Digital products now have a 14-day refund window. Receipt or order confirmation email accepted.",
      source: "Company policy DB → version 4.2, updated Jan 15, 2026",
      confidence: "High",
      correct: true,
    },
    realAnswer: "The return window was extended to 60 days in January 2026, and digital refund policies were added.",
    category: "Policy",
  },
  {
    id: 3,
    question: "Who is the current Head of Engineering?",
    staleAnswer: {
      text: "The Head of Engineering is Sarah Chen. She's been in the role since 2023 and leads a team of 45 engineers.",
      source: "Training data (6 months ago)",
      confidence: "High",
      correct: false,
    },
    ragAnswer: {
      text: "The current Head of Engineering is Marcus Rivera, who took over the role on December 1, 2025. The engineering team has grown to 62 members under the new AI-first initiative.",
      source: "HR Database → org chart updated Dec 1, 2025",
      confidence: "High",
      correct: true,
    },
    realAnswer: "Sarah Chen moved to CTO at a startup. Marcus Rivera was promoted to Head of Engineering in December 2025.",
    category: "People",
  },
  {
    id: 4,
    question: "What integrations does our platform support?",
    staleAnswer: {
      text: "We support integrations with Slack, Jira, GitHub, and Google Workspace. You can set them up in Settings > Integrations.",
      source: "Training data (6 months ago)",
      confidence: "High",
      correct: false,
    },
    ragAnswer: {
      text: "We currently support 12 integrations: Slack, Jira, GitHub, Google Workspace, Linear, Notion, Figma, Salesforce, HubSpot, Zapier, Microsoft Teams, and the new AI Copilot API (beta). Setup is in Settings > Integrations > Marketplace.",
      source: "Product docs → v3.8 release notes, Feb 1, 2026",
      confidence: "High",
      correct: true,
    },
    realAnswer: "8 new integrations were added in the last 6 months, including the AI Copilot API in the latest release.",
    category: "Product",
  },
];

const RAG_PIPELINE_STEPS = [
  {
    id: 1,
    title: "User Query",
    icon: "💬",
    description: "User asks a question",
    detail: "The user's natural language question enters the system.",
    color: "#6366f1",
  },
  {
    id: 2,
    title: "Embed Query",
    icon: "🔢",
    description: "Convert to vector",
    detail: "The question is converted into a numerical vector (embedding) that captures its semantic meaning.",
    color: "#8b5cf6",
  },
  {
    id: 3,
    title: "Retrieve",
    icon: "🔍",
    description: "Search knowledge base",
    detail: "The vector is used to find the most relevant documents from an up-to-date vector database.",
    color: "#a855f7",
  },
  {
    id: 4,
    title: "Augment",
    icon: "📎",
    description: "Attach context to prompt",
    detail: "Retrieved documents are injected into the LLM prompt as fresh context alongside the original question.",
    color: "#c084fc",
  },
  {
    id: 5,
    title: "Generate",
    icon: "✨",
    description: "LLM produces answer",
    detail: "The LLM generates a response grounded in the retrieved, current information — not just its training data.",
    color: "#d946ef",
  },
];

const TypeWriter = ({ text, speed = 18, onComplete }) => {
  const [displayed, setDisplayed] = useState("");
  const idx = useRef(0);

  useEffect(() => {
    setDisplayed("");
    idx.current = 0;
    const timer = setInterval(() => {
      if (idx.current < text.length) {
        setDisplayed(text.slice(0, idx.current + 1));
        idx.current++;
      } else {
        clearInterval(timer);
        onComplete?.();
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text]);

  return <span>{displayed}</span>;
};

const PipelineVisualizer = ({ activeStep, onStepClick }) => {
  return (
    <div style={{ padding: "24px 0" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 0, position: "relative", justifyContent: "center", flexWrap: "wrap" }}>
        {RAG_PIPELINE_STEPS.map((step, i) => (
          <div key={step.id} style={{ display: "flex", alignItems: "center" }}>
            <div
              onClick={() => onStepClick(step.id)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
                padding: "12px 16px",
                borderRadius: "16px",
                background: activeStep >= step.id
                  ? `linear-gradient(135deg, ${step.color}18, ${step.color}08)`
                  : "transparent",
                border: activeStep === step.id ? `2px solid ${step.color}` : "2px solid transparent",
                transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
                transform: activeStep === step.id ? "scale(1.05)" : "scale(1)",
                minWidth: "100px",
              }}
            >
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "14px",
                  background: activeStep >= step.id
                    ? `linear-gradient(135deg, ${step.color}, ${step.color}cc)`
                    : "#1e1e2e",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px",
                  transition: "all 0.4s ease",
                  boxShadow: activeStep >= step.id ? `0 4px 20px ${step.color}44` : "none",
                }}
              >
                {step.icon}
              </div>
              <span style={{
                fontSize: "12px",
                fontWeight: 600,
                color: activeStep >= step.id ? "#e2e8f0" : "#64748b",
                textAlign: "center",
                lineHeight: 1.3,
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {step.title}
              </span>
            </div>
            {i < RAG_PIPELINE_STEPS.length - 1 && (
              <div style={{
                width: "32px",
                height: "2px",
                background: activeStep > step.id
                  ? `linear-gradient(90deg, ${step.color}, ${RAG_PIPELINE_STEPS[i + 1].color})`
                  : "#2a2a3e",
                transition: "all 0.4s ease",
                flexShrink: 0,
              }} />
            )}
          </div>
        ))}
      </div>
      {activeStep > 0 && (
        <div style={{
          marginTop: "20px",
          padding: "16px 20px",
          background: "#13131f",
          borderRadius: "12px",
          border: `1px solid ${RAG_PIPELINE_STEPS[activeStep - 1]?.color}33`,
        }}>
          <p style={{ color: "#94a3b8", fontSize: "14px", margin: 0, lineHeight: 1.6, fontFamily: "'IBM Plex Sans', sans-serif" }}>
            <span style={{ color: RAG_PIPELINE_STEPS[activeStep - 1]?.color, fontWeight: 700 }}>
              Step {activeStep}:
            </span>{" "}
            {RAG_PIPELINE_STEPS[activeStep - 1]?.detail}
          </p>
        </div>
      )}
    </div>
  );
};

export default function RAGDemo() {
  const [view, setView] = useState("intro");
  const [selectedQ, setSelectedQ] = useState(null);
  const [showStale, setShowStale] = useState(false);
  const [showRAG, setShowRAG] = useState(false);
  const [staleTyping, setStaleTyping] = useState(false);
  const [ragTyping, setRagTyping] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(0);
  const [showReveal, setShowReveal] = useState(false);
  const [animatingPipeline, setAnimatingPipeline] = useState(false);

  const handleAskQuestion = (q) => {
    setSelectedQ(q);
    setShowStale(false);
    setShowRAG(false);
    setStaleTyping(false);
    setRagTyping(false);
    setPipelineStep(0);
    setShowReveal(false);
    setAnimatingPipeline(false);

    setTimeout(() => {
      setShowStale(true);
      setStaleTyping(true);
    }, 600);
  };

  const handleShowRAG = () => {
    setAnimatingPipeline(true);
    setPipelineStep(1);
    let step = 1;
    const interval = setInterval(() => {
      step++;
      if (step <= 5) {
        setPipelineStep(step);
      } else {
        clearInterval(interval);
        setAnimatingPipeline(false);
        setShowRAG(true);
        setRagTyping(true);
      }
    }, 700);
  };

  const categoryColors = {
    Pricing: "#f59e0b",
    Policy: "#3b82f6",
    People: "#10b981",
    Product: "#f43f5e",
  };

  const sectionStyle = {
    background: "#0a0a14",
    minHeight: "100vh",
    fontFamily: "'IBM Plex Sans', sans-serif",
    color: "#e2e8f0",
  };

  if (view === "intro") {
    return (
      <div style={sectionStyle}>
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
        <div style={{ maxWidth: "800px", margin: "0 auto", padding: "60px 24px" }}>
          <div style={{ textAlign: "center", marginBottom: "60px" }}>
            <div style={{
              display: "inline-block",
              padding: "6px 16px",
              background: "linear-gradient(135deg, #6366f122, #d946ef22)",
              border: "1px solid #6366f144",
              borderRadius: "100px",
              fontSize: "12px",
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 600,
              color: "#a78bfa",
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              marginBottom: "24px",
            }}>
              Interactive Lesson
            </div>
            <h1 style={{
              fontSize: "clamp(32px, 5vw, 52px)",
              fontWeight: 700,
              lineHeight: 1.1,
              margin: "0 0 20px",
              background: "linear-gradient(135deg, #e2e8f0, #a78bfa, #d946ef)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              fontFamily: "'Space Mono', monospace",
            }}>
              Why AI Agents<br />Go Stale
            </h1>
            <p style={{ fontSize: "18px", color: "#94a3b8", maxWidth: "560px", margin: "0 auto 40px", lineHeight: 1.7 }}>
              And how <span style={{ color: "#a78bfa", fontWeight: 600 }}>Retrieval-Augmented Generation</span> keeps them fresh.
            </p>
          </div>

          <div style={{
            background: "#12121e",
            borderRadius: "20px",
            padding: "32px",
            border: "1px solid #1e1e2e",
            marginBottom: "32px",
          }}>
            <h3 style={{ fontSize: "14px", fontFamily: "'JetBrains Mono', monospace", color: "#f59e0b", margin: "0 0 16px", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase" }}>
              ⚠ The Problem
            </h3>
            <p style={{ color: "#cbd5e1", lineHeight: 1.8, margin: "0 0 16px", fontSize: "15px" }}>
              LLMs are trained on data up to a <strong style={{ color: "#f59e0b" }}>cutoff date</strong>. After that, they're working from a frozen snapshot. When your business rules shift, products change, or staff rotate — the agent doesn't know. It gives confident answers that are <em>completely wrong</em>.
            </p>
            <p style={{ color: "#94a3b8", lineHeight: 1.8, margin: 0, fontSize: "15px" }}>
              Static knowledge bases make this worse. If your agent pulls from documents that haven't been refreshed, every answer is based on outdated information.
            </p>
          </div>

          <div style={{
            background: "#12121e",
            borderRadius: "20px",
            padding: "32px",
            border: "1px solid #1e1e2e",
            marginBottom: "40px",
          }}>
            <h3 style={{ fontSize: "14px", fontFamily: "'JetBrains Mono', monospace", color: "#10b981", margin: "0 0 16px", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase" }}>
              ✦ The Fix: RAG
            </h3>
            <p style={{ color: "#cbd5e1", lineHeight: 1.8, margin: "0 0 16px", fontSize: "15px" }}>
              <strong style={{ color: "#10b981" }}>Retrieval-Augmented Generation</strong> lets your agent pull from external, updatable sources at query time — instead of relying solely on baked-in training data.
            </p>
            <p style={{ color: "#94a3b8", lineHeight: 1.8, margin: 0, fontSize: "15px" }}>
              Think of it as giving the agent a live reference library instead of making it rely on memory alone. The agent retrieves relevant, fresh documents and uses them to generate grounded answers.
            </p>
          </div>

          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => setView("demo")}
              style={{
                padding: "16px 32px",
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                color: "#fff",
                border: "none",
                borderRadius: "14px",
                fontSize: "16px",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "'IBM Plex Sans', sans-serif",
                boxShadow: "0 4px 24px #6366f144",
                transition: "transform 0.2s, box-shadow 0.2s",
              }}
              onMouseOver={e => { e.target.style.transform = "translateY(-2px)"; e.target.style.boxShadow = "0 8px 32px #6366f166"; }}
              onMouseOut={e => { e.target.style.transform = "translateY(0)"; e.target.style.boxShadow = "0 4px 24px #6366f144"; }}
            >
              Try the Interactive Demo →
            </button>
            <button
              onClick={() => setView("pipeline")}
              style={{
                padding: "16px 32px",
                background: "transparent",
                color: "#a78bfa",
                border: "2px solid #6366f144",
                borderRadius: "14px",
                fontSize: "16px",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "'IBM Plex Sans', sans-serif",
                transition: "all 0.2s",
              }}
              onMouseOver={e => { e.target.style.borderColor = "#6366f1"; e.target.style.background = "#6366f111"; }}
              onMouseOut={e => { e.target.style.borderColor = "#6366f144"; e.target.style.background = "transparent"; }}
            >
              Explore the RAG Pipeline
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === "pipeline") {
    return (
      <div style={sectionStyle}>
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
        <div style={{ maxWidth: "860px", margin: "0 auto", padding: "40px 24px" }}>
          <button onClick={() => setView("intro")} style={{
            background: "none", border: "none", color: "#64748b", cursor: "pointer",
            fontFamily: "'JetBrains Mono', monospace", fontSize: "13px", marginBottom: "32px", padding: 0,
          }}>
            ← Back to Overview
          </button>

          <h2 style={{
            fontSize: "28px", fontFamily: "'Space Mono', monospace", fontWeight: 700,
            margin: "0 0 8px",
            background: "linear-gradient(135deg, #a78bfa, #d946ef)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            The RAG Pipeline
          </h2>
          <p style={{ color: "#64748b", margin: "0 0 24px", fontSize: "15px" }}>
            Click each step to understand how RAG works under the hood.
          </p>

          <PipelineVisualizer activeStep={pipelineStep} onStepClick={setPipelineStep} />

          <div style={{ marginTop: "32px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{
              background: "#12121e",
              borderRadius: "16px",
              padding: "24px",
              border: "1px solid #1e1e2e",
            }}>
              <h3 style={{ fontSize: "13px", fontFamily: "'JetBrains Mono', monospace", color: "#f59e0b", margin: "0 0 16px", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase" }}>
                Without RAG (Traditional LLM)
              </h3>
              <div style={{
                display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap",
                justifyContent: "center",
              }}>
                {["💬 Query", "🧠 LLM (stale data)", "📤 Answer"].map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                      padding: "10px 18px", background: "#1e1e2e", borderRadius: "10px",
                      fontSize: "13px", fontFamily: "'JetBrains Mono', monospace", color: "#f59e0b",
                    }}>
                      {s}
                    </div>
                    {i < 2 && <span style={{ color: "#333" }}>→</span>}
                  </div>
                ))}
              </div>
              <p style={{ color: "#94a3b8", fontSize: "13px", margin: "12px 0 0", textAlign: "center" }}>
                The LLM only uses its training data — which may be months or years old.
              </p>
            </div>

            <div style={{
              background: "#12121e",
              borderRadius: "16px",
              padding: "24px",
              border: "1px solid #10b98133",
            }}>
              <h3 style={{ fontSize: "13px", fontFamily: "'JetBrains Mono', monospace", color: "#10b981", margin: "0 0 16px", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase" }}>
                With RAG
              </h3>
              <div style={{
                display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap",
                justifyContent: "center",
              }}>
                {["💬 Query", "🔢 Embed", "🔍 Retrieve", "📎 Augment", "✨ Generate"].map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{
                      padding: "10px 14px", background: "#10b98115", borderRadius: "10px",
                      fontSize: "12px", fontFamily: "'JetBrains Mono', monospace", color: "#10b981",
                      border: "1px solid #10b98122",
                    }}>
                      {s}
                    </div>
                    {i < 4 && <span style={{ color: "#333" }}>→</span>}
                  </div>
                ))}
              </div>
              <p style={{ color: "#94a3b8", fontSize: "13px", margin: "12px 0 0", textAlign: "center" }}>
                Fresh documents are retrieved and injected into the prompt before the LLM generates.
              </p>
            </div>

            <div style={{
              background: "#12121e", borderRadius: "16px", padding: "24px",
              border: "1px solid #1e1e2e",
            }}>
              <h3 style={{ fontSize: "13px", fontFamily: "'JetBrains Mono', monospace", color: "#d946ef", margin: "0 0 16px", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase" }}>
                Agentic RAG (Advanced)
              </h3>
              <p style={{ color: "#cbd5e1", fontSize: "14px", lineHeight: 1.7, margin: 0 }}>
                The next evolution: agents that can <strong style={{ color: "#d946ef" }}>break complex questions into sub-queries</strong>, validate their own outputs, and dynamically choose between searching internal docs, databases, or the web. They can even collaborate with other specialized agents — each handling different knowledge domains.
              </p>
            </div>
          </div>

          <div style={{ marginTop: "32px", textAlign: "center" }}>
            <button
              onClick={() => setView("demo")}
              style={{
                padding: "14px 28px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                color: "#fff", border: "none", borderRadius: "14px", fontSize: "15px",
                fontWeight: 600, cursor: "pointer", fontFamily: "'IBM Plex Sans', sans-serif",
                boxShadow: "0 4px 24px #6366f144",
              }}
            >
              Try the Before & After Demo →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // DEMO VIEW
  return (
    <div style={sectionStyle}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "40px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px", flexWrap: "wrap", gap: "12px" }}>
          <button onClick={() => setView("intro")} style={{
            background: "none", border: "none", color: "#64748b", cursor: "pointer",
            fontFamily: "'JetBrains Mono', monospace", fontSize: "13px", padding: 0,
          }}>
            ← Back
          </button>
          <div style={{
            display: "inline-block", padding: "5px 14px",
            background: "#6366f115", border: "1px solid #6366f133",
            borderRadius: "100px", fontSize: "12px",
            fontFamily: "'JetBrains Mono', monospace", color: "#818cf8",
          }}>
            Before & After RAG
          </div>
        </div>

        <h2 style={{
          fontSize: "24px", fontFamily: "'Space Mono', monospace", fontWeight: 700,
          margin: "0 0 8px", color: "#e2e8f0",
        }}>
          Ask the Agent
        </h2>
        <p style={{ color: "#64748b", margin: "0 0 24px", fontSize: "14px" }}>
          Pick a question and see how a stale agent vs. a RAG-powered agent responds.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px", marginBottom: "32px" }}>
          {QUESTIONS.map((q) => (
            <button
              key={q.id}
              onClick={() => handleAskQuestion(q)}
              style={{
                padding: "16px",
                background: selectedQ?.id === q.id ? "#1e1e2e" : "#12121e",
                border: selectedQ?.id === q.id ? `2px solid ${categoryColors[q.category]}` : "2px solid #1e1e2e",
                borderRadius: "14px",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.3s ease",
              }}
              onMouseOver={e => { if (selectedQ?.id !== q.id) e.currentTarget.style.borderColor = "#333"; }}
              onMouseOut={e => { if (selectedQ?.id !== q.id) e.currentTarget.style.borderColor = "#1e1e2e"; }}
            >
              <span style={{
                fontSize: "10px", fontFamily: "'JetBrains Mono', monospace",
                color: categoryColors[q.category], fontWeight: 700, letterSpacing: "1px",
                textTransform: "uppercase",
              }}>
                {q.category}
              </span>
              <p style={{ color: "#e2e8f0", fontSize: "14px", margin: "8px 0 0", lineHeight: 1.4, fontWeight: 500 }}>
                {q.question}
              </p>
            </button>
          ))}
        </div>

        {selectedQ && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* STALE AGENT */}
            {showStale && (
              <div style={{
                background: "#12121e", borderRadius: "16px", padding: "24px",
                border: "1px solid #f59e0b33",
                animation: "fadeSlideIn 0.4s ease",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                  <div style={{
                    width: "32px", height: "32px", borderRadius: "8px",
                    background: "linear-gradient(135deg, #f59e0b33, #f59e0b11)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px",
                  }}>
                    🤖
                  </div>
                  <div>
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "#f59e0b" }}>Stale Agent</span>
                    <span style={{
                      marginLeft: "8px", fontSize: "11px", padding: "2px 8px",
                      background: "#ef444422", color: "#f87171", borderRadius: "100px",
                      fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
                    }}>
                      NO RAG
                    </span>
                  </div>
                </div>
                <div style={{
                  background: "#0a0a14", borderRadius: "12px", padding: "16px",
                  fontSize: "14px", color: "#cbd5e1", lineHeight: 1.7,
                  borderLeft: "3px solid #f59e0b44",
                }}>
                  {staleTyping ? (
                    <TypeWriter
                      text={selectedQ.staleAnswer.text}
                      onComplete={() => setStaleTyping(false)}
                    />
                  ) : (
                    selectedQ.staleAnswer.text
                  )}
                </div>
                <div style={{ marginTop: "12px", display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", fontFamily: "'JetBrains Mono', monospace", color: "#64748b" }}>
                    📁 {selectedQ.staleAnswer.source}
                  </span>
                  <span style={{
                    fontSize: "11px", padding: "2px 10px", borderRadius: "100px",
                    background: "#ef444418", color: "#f87171", fontWeight: 600,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    ✗ OUTDATED
                  </span>
                </div>

                {!staleTyping && !showRAG && !animatingPipeline && (
                  <button
                    onClick={handleShowRAG}
                    style={{
                      marginTop: "16px", padding: "12px 24px",
                      background: "linear-gradient(135deg, #10b981, #059669)",
                      color: "#fff", border: "none", borderRadius: "12px",
                      fontSize: "14px", fontWeight: 600, cursor: "pointer",
                      fontFamily: "'IBM Plex Sans', sans-serif",
                      boxShadow: "0 4px 20px #10b98133",
                      width: "100%",
                      transition: "transform 0.2s",
                    }}
                    onMouseOver={e => e.target.style.transform = "translateY(-1px)"}
                    onMouseOut={e => e.target.style.transform = "translateY(0)"}
                  >
                    Now ask with RAG enabled →
                  </button>
                )}
              </div>
            )}

            {/* PIPELINE ANIMATION */}
            {animatingPipeline && (
              <div style={{
                background: "#12121e", borderRadius: "16px", padding: "24px",
                border: "1px solid #6366f133",
              }}>
                <p style={{
                  fontSize: "12px", fontFamily: "'JetBrains Mono', monospace",
                  color: "#818cf8", margin: "0 0 8px", fontWeight: 600,
                  letterSpacing: "1px", textTransform: "uppercase",
                }}>
                  RAG Pipeline Running...
                </p>
                <PipelineVisualizer activeStep={pipelineStep} onStepClick={() => {}} />
              </div>
            )}

            {/* RAG AGENT */}
            {showRAG && (
              <div style={{
                background: "#12121e", borderRadius: "16px", padding: "24px",
                border: "1px solid #10b98133",
                animation: "fadeSlideIn 0.4s ease",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                  <div style={{
                    width: "32px", height: "32px", borderRadius: "8px",
                    background: "linear-gradient(135deg, #10b98133, #10b98111)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px",
                  }}>
                    🧠
                  </div>
                  <div>
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "#10b981" }}>RAG-Powered Agent</span>
                    <span style={{
                      marginLeft: "8px", fontSize: "11px", padding: "2px 8px",
                      background: "#10b98122", color: "#34d399", borderRadius: "100px",
                      fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
                    }}>
                      RAG ENABLED
                    </span>
                  </div>
                </div>
                <div style={{
                  background: "#0a0a14", borderRadius: "12px", padding: "16px",
                  fontSize: "14px", color: "#cbd5e1", lineHeight: 1.7,
                  borderLeft: "3px solid #10b98144",
                }}>
                  {ragTyping ? (
                    <TypeWriter
                      text={selectedQ.ragAnswer.text}
                      onComplete={() => setRagTyping(false)}
                    />
                  ) : (
                    selectedQ.ragAnswer.text
                  )}
                </div>
                <div style={{ marginTop: "12px", display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", fontFamily: "'JetBrains Mono', monospace", color: "#64748b" }}>
                    📡 {selectedQ.ragAnswer.source}
                  </span>
                  <span style={{
                    fontSize: "11px", padding: "2px 10px", borderRadius: "100px",
                    background: "#10b98118", color: "#34d399", fontWeight: 600,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    ✓ CURRENT
                  </span>
                </div>

                {!ragTyping && !showReveal && (
                  <button
                    onClick={() => setShowReveal(true)}
                    style={{
                      marginTop: "16px", padding: "12px 24px",
                      background: "#1e1e2e", color: "#a78bfa",
                      border: "2px solid #6366f133", borderRadius: "12px",
                      fontSize: "14px", fontWeight: 600, cursor: "pointer",
                      fontFamily: "'IBM Plex Sans', sans-serif",
                      width: "100%",
                    }}
                  >
                    Reveal what actually changed 🔎
                  </button>
                )}
              </div>
            )}

            {/* TRUTH REVEAL */}
            {showReveal && (
              <div style={{
                background: "linear-gradient(135deg, #6366f108, #d946ef08)",
                borderRadius: "16px", padding: "24px",
                border: "1px solid #6366f133",
                animation: "fadeSlideIn 0.4s ease",
              }}>
                <h4 style={{
                  fontSize: "13px", fontFamily: "'JetBrains Mono', monospace",
                  color: "#a78bfa", margin: "0 0 12px", fontWeight: 600,
                  letterSpacing: "1px", textTransform: "uppercase",
                }}>
                  💡 Ground Truth
                </h4>
                <p style={{ color: "#e2e8f0", fontSize: "15px", lineHeight: 1.7, margin: "0 0 16px" }}>
                  {selectedQ.realAnswer}
                </p>
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px",
                }}>
                  <div style={{
                    padding: "12px", background: "#ef444411", borderRadius: "10px",
                    border: "1px solid #ef444422",
                  }}>
                    <p style={{ fontSize: "12px", fontFamily: "'JetBrains Mono', monospace", color: "#f87171", margin: "0 0 4px", fontWeight: 600 }}>
                      Stale Agent
                    </p>
                    <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>
                      Gave confidently wrong info from 6-month-old training data. A user could make decisions on bad information.
                    </p>
                  </div>
                  <div style={{
                    padding: "12px", background: "#10b98111", borderRadius: "10px",
                    border: "1px solid #10b98122",
                  }}>
                    <p style={{ fontSize: "12px", fontFamily: "'JetBrains Mono', monospace", color: "#34d399", margin: "0 0 4px", fontWeight: 600 }}>
                      RAG Agent
                    </p>
                    <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>
                      Retrieved live data, cited its source and freshness. The answer reflects actual current state.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <style>{`
          @keyframes fadeSlideIn {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    </div>
  );
}
