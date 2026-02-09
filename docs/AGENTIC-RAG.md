# Implementing Agentic RAG in Python

A step-by-step guide to building Agentic RAG — where the agent reasons about *what* to search, *where* to search, *whether results are sufficient*, and *how to decompose complex questions*.

> **Prerequisite:** This guide builds on the basic RAG implementation in `RAG.md`. Read that first for foundational concepts (chunking, embeddings, vector stores, freshness).

---

## The Architecture Shift

In basic RAG, every question follows the same fixed path: embed → search one vector store → generate. Agentic RAG introduces a **reasoning loop**. The agent can:

1. Break a complex question into sub-queries
2. Route each sub-query to the right knowledge source
3. Evaluate whether retrieved context is sufficient
4. Search again with a refined query if it isn't
5. Synthesize across multiple sources into a final answer

---

## Step 1: Define Your Knowledge Sources

Instead of one vector store, you now have multiple specialized sources. Each one is a **tool** the agent can choose to use.

```python
from anthropic import Anthropic
import chromadb
import json
from datetime import datetime

client = Anthropic()
chroma = chromadb.Client()

# Each domain gets its own collection — different update cadences, different data
pricing_db = chroma.get_or_create_collection("pricing")
policy_db = chroma.get_or_create_collection("policies")
hr_db = chroma.get_or_create_collection("org_and_hr")
product_db = chroma.get_or_create_collection("product_docs")

# A registry of all available knowledge sources
KNOWLEDGE_SOURCES = {
    "pricing_db": {
        "collection": pricing_db,
        "description": "Current pricing plans, discounts, billing terms, and feature tiers.",
        "freshness": "updated hourly",
    },
    "policy_db": {
        "collection": policy_db,
        "description": "Company policies: returns, refunds, SLAs, terms of service, compliance.",
        "freshness": "updated daily",
    },
    "hr_db": {
        "collection": hr_db,
        "description": "Org chart, team structure, roles, employee directory, hiring status.",
        "freshness": "updated on change",
    },
    "product_db": {
        "collection": product_db,
        "description": "Product documentation, feature specs, integrations, release notes, API docs.",
        "freshness": "updated per release",
    },
    "web_search": {
        "collection": None,  # not a vector store — it's a live search
        "description": "Live web search for recent news, competitor info, industry trends, "
                       "or anything not in internal docs.",
        "freshness": "real-time",
    },
}
```

The key difference from basic RAG is already visible: the agent has **options**. A pricing question shouldn't hit the HR database. A question about a competitor shouldn't search internal docs at all — it should go to the web.

---

## Step 2: Build the Retrieval Tools

Each knowledge source becomes a callable function. The agent will invoke these by name.

```python
def search_collection(collection_name: str, query: str, n_results: int = 3) -> list[dict]:
    """Search a specific vector store collection."""
    source = KNOWLEDGE_SOURCES[collection_name]

    if source["collection"] is None:
        return []

    results = source["collection"].query(
        query_texts=[query],
        n_results=n_results,
    )

    return [
        {
            "text": doc,
            "source": collection_name,
            "freshness": source["freshness"],
            "metadata": meta,
        }
        for doc, meta in zip(
            results["documents"][0],
            results["metadatas"][0]
        )
    ]


def web_search(query: str) -> list[dict]:
    """Live web search — in production, use SerpAPI, Tavily, Brave, etc."""
    # In a real implementation:
    # from tavily import TavilyClient
    # tavily = TavilyClient(api_key="...")
    # results = tavily.search(query, max_results=3)

    return [
        {
            "text": f"[Web result for '{query}'] ...",
            "source": "web_search",
            "freshness": "real-time",
            "url": "https://example.com/...",
        }
    ]


# Master retrieval function — the agent calls this with a source and query
def retrieve(source: str, query: str) -> list[dict]:
    if source == "web_search":
        return web_search(query)
    elif source in KNOWLEDGE_SOURCES:
        return search_collection(source, query)
    else:
        return [{"text": f"Unknown source: {source}", "source": "error"}]
```

---

## Step 3: Define the Tools for the LLM

Now we describe these capabilities in a format the LLM understands. This is what lets the agent *choose* which tools to use and *what arguments* to pass.

```python
TOOLS = [
    {
        "name": "search_knowledge",
        "description": (
            "Search a specific knowledge source for information. "
            "Available sources:\n"
            + "\n".join(
                f"- {name}: {info['description']} ({info['freshness']})"
                for name, info in KNOWLEDGE_SOURCES.items()
            )
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "source": {
                    "type": "string",
                    "description": "Which knowledge source to search",
                    "enum": list(KNOWLEDGE_SOURCES.keys()),
                },
                "query": {
                    "type": "string",
                    "description": "The search query — be specific and targeted",
                },
            },
            "required": ["source", "query"],
        },
    },
    {
        "name": "evaluate_sufficiency",
        "description": (
            "After retrieving information, evaluate whether you have enough "
            "context to answer the user's question confidently. If not, explain "
            "what's missing so you can search again."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "have_enough": {
                    "type": "boolean",
                    "description": "True if retrieved context is sufficient to answer",
                },
                "missing": {
                    "type": "string",
                    "description": "What information is still needed (if any)",
                },
                "confidence": {
                    "type": "string",
                    "enum": ["high", "medium", "low"],
                },
            },
            "required": ["have_enough", "confidence"],
        },
    },
]
```

The `evaluate_sufficiency` tool is what makes this *agentic*. The agent doesn't just retrieve and generate. It retrieves, judges whether the results are good enough, and can loop back for more if they aren't.

---

## Step 4: The Agent Loop

This is the heart of Agentic RAG. Instead of a single pass, the agent runs in a **reasoning loop** — making tool calls, observing results, deciding next steps, and only generating a final answer when it's confident.

```python
SYSTEM_PROMPT = """You are an intelligent research agent. Your job is to answer
user questions accurately using the knowledge sources available to you.

YOUR PROCESS:
1. Analyze the user's question. If it's complex, break it into sub-questions.
2. For each sub-question, decide which knowledge source is most relevant and search it.
3. After each search, evaluate whether you have sufficient context.
4. If not, refine your query or try a different source.
5. Once you have enough context, synthesize a final answer.

RULES:
- Always cite which source your information came from.
- If sources conflict, note the discrepancy and prefer the most recently updated source.
- If no source has the answer, say so clearly — never fabricate information.
- For anything that changes frequently (pricing, people, news), prefer the freshest source.
- You may make multiple searches across different sources for complex questions.
"""


def run_agent(user_question: str, max_iterations: int = 8) -> str:
    """Run the agentic RAG loop."""

    messages = [{"role": "user", "content": user_question}]
    retrieved_context = []  # accumulate context across iterations

    for i in range(max_iterations):
        # Ask the LLM what to do next
        response = client.messages.create(
            model="claude-sonnet-4-5-20250514",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=messages,
        )

        # If the model wants to give a final text answer, we're done
        if response.stop_reason == "end_turn":
            final_text = ""
            for block in response.content:
                if block.type == "text":
                    final_text += block.text
            return final_text

        # If the model wants to use tools, process each tool call
        if response.stop_reason == "tool_use":
            # Add the assistant's response (with tool calls) to messages
            messages.append({"role": "assistant", "content": response.content})

            tool_results = []

            for block in response.content:
                if block.type != "tool_use":
                    continue

                tool_name = block.name
                tool_input = block.input

                if tool_name == "search_knowledge":
                    results = retrieve(
                        source=tool_input["source"],
                        query=tool_input["query"],
                    )
                    retrieved_context.extend(results)

                    result_text = "\n\n".join(
                        f"[Source: {r['source']} | Freshness: {r['freshness']}]\n{r['text']}"
                        for r in results
                    )
                    if not results:
                        result_text = "No results found for this query."

                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result_text,
                    })

                elif tool_name == "evaluate_sufficiency":
                    # The agent is reflecting on what it has so far
                    # We just acknowledge and let it decide next steps
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps({
                            "acknowledged": True,
                            "context_chunks_so_far": len(retrieved_context),
                        }),
                    })

            # Feed tool results back into the conversation
            messages.append({"role": "user", "content": tool_results})

    # If we hit max iterations, force a final answer
    messages.append({
        "role": "user",
        "content": "Please provide your best answer now with the context you've gathered.",
    })

    response = client.messages.create(
        model="claude-sonnet-4-5-20250514",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=messages,
    )

    return response.content[0].text
```

---

## Step 5: Handling Complex Questions

Here's where Agentic RAG really shines — questions that span multiple domains.

```python
# Simple question — agent searches one source, gets answer
answer = run_agent("What's the current price of the Pro Plan?")
# Agent thinks: pricing question -> search pricing_db -> sufficient -> answer


# Complex question — agent decomposes and searches multiple sources
answer = run_agent(
    "How does our Pro Plan pricing compare to competitors, "
    "and which team members should I contact about an enterprise deal?"
)
# Agent thinks:
#   Sub-query 1: "Pro Plan pricing" -> search pricing_db
#   Sub-query 2: "competitor pricing" -> search web_search
#   Sub-query 3: "enterprise sales contacts" -> search hr_db
#   Evaluate: have pricing + competitors + contacts -> sufficient
#   Synthesize final answer across all three


# Ambiguous question — agent validates and may search multiple times
answer = run_agent("What changed in the last release?")
# Agent thinks:
#   Could be product changes -> search product_db "latest release notes"
#   Could include policy changes -> search policy_db "recent updates"
#   Evaluate: got product changes but user might want more ->
#     search again with refined query
#   Synthesize
```

---

## Step 6: Add Self-Validation

The truly agentic part — the agent checks its own work before answering.

```python
TOOLS.append({
    "name": "validate_answer",
    "description": (
        "Before giving your final answer, validate it against the retrieved "
        "context. Check for: contradictions between sources, information that "
        "might be outdated despite being retrieved, and gaps in your answer."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "draft_answer": {
                "type": "string",
                "description": "Your draft answer to validate",
            },
            "potential_issues": {
                "type": "array",
                "items": {"type": "string"},
                "description": "List of potential issues found",
            },
            "needs_more_search": {
                "type": "boolean",
            },
        },
        "required": ["draft_answer", "potential_issues", "needs_more_search"],
    },
})
```

When the agent calls `validate_answer` with `needs_more_search: true`, the loop continues. It might re-query with a more specific search, cross-reference against a different source, or go to the web to verify something it found internally. Only when it's satisfied does it produce the final answer.

---

## Step 7: Multi-Agent Collaboration (Advanced)

Specialized agents that the orchestrator can delegate to — each handling a different knowledge domain.

### Define Specialist Agents

```python
SPECIALIST_AGENTS = {
    "pricing_specialist": {
        "system_prompt": (
            "You are a pricing specialist. You have deep knowledge of our "
            "pricing tiers, discounts, billing cycles, and competitive positioning. "
            "Always quote exact figures with their effective dates."
        ),
        "sources": ["pricing_db", "web_search"],
    },
    "policy_specialist": {
        "system_prompt": (
            "You are a policy specialist. You interpret company policies precisely. "
            "Always reference the specific policy version and effective date. "
            "Flag any ambiguities rather than assuming."
        ),
        "sources": ["policy_db"],
    },
    "product_specialist": {
        "system_prompt": (
            "You are a product specialist. You explain features, integrations, "
            "and technical capabilities. Reference specific version numbers and "
            "release dates. Distinguish between GA and beta features."
        ),
        "sources": ["product_db", "web_search"],
    },
}
```

### Delegate to Specialists

```python
def delegate_to_specialist(specialist: str, sub_question: str) -> str:
    """The orchestrator delegates a sub-question to a domain expert."""

    config = SPECIALIST_AGENTS[specialist]

    # The specialist only has access to its relevant sources
    specialist_tools = [
        tool for tool in TOOLS
        if tool["name"] != "search_knowledge"
    ] + [{
        **TOOLS[0],  # search_knowledge tool
        "input_schema": {
            **TOOLS[0]["input_schema"],
            "properties": {
                **TOOLS[0]["input_schema"]["properties"],
                "source": {
                    "type": "string",
                    "enum": config["sources"],  # restricted to relevant sources only
                },
            },
        },
    }]

    # Run a mini agent loop for this specialist
    messages = [{"role": "user", "content": sub_question}]

    response = client.messages.create(
        model="claude-sonnet-4-5-20250514",
        max_tokens=2048,
        system=config["system_prompt"],
        tools=specialist_tools,
        messages=messages,
    )

    # ... same tool-handling loop as the main agent ...
    return extract_final_answer(response)
```

### The Orchestrator

```python
def orchestrator(user_question: str) -> str:
    """Top-level agent that decomposes and delegates."""

    planning_response = client.messages.create(
        model="claude-sonnet-4-5-20250514",
        max_tokens=1024,
        system=(
            "You are an orchestrator. Decompose the user's question into sub-questions "
            "and assign each to the right specialist: pricing_specialist, "
            "policy_specialist, or product_specialist. Respond in JSON."
        ),
        messages=[{"role": "user", "content": user_question}],
    )

    plan = json.loads(planning_response.content[0].text)
    # plan = {"sub_queries": [
    #     {"specialist": "pricing_specialist", "question": "What is the Pro Plan price?"},
    #     {"specialist": "product_specialist", "question": "What integrations are included?"},
    # ]}

    # Delegate to each specialist
    specialist_answers = {}
    for sq in plan["sub_queries"]:
        specialist_answers[sq["specialist"]] = delegate_to_specialist(
            sq["specialist"], sq["question"]
        )

    # Synthesize all specialist answers into a final response
    synthesis_response = client.messages.create(
        model="claude-sonnet-4-5-20250514",
        max_tokens=2048,
        system="Synthesize these specialist answers into one coherent response.",
        messages=[{
            "role": "user",
            "content": (
                f"Original question: {user_question}\n\n"
                + "\n\n".join(
                    f"[{name}]: {answer}"
                    for name, answer in specialist_answers.items()
                )
            ),
        }],
    )

    return synthesis_response.content[0].text
```

### Example Orchestrator Flow

```
User: "How does our Pro Plan pricing compare to competitors,
       and which team members should I contact about an enterprise deal?"

Orchestrator decomposes:
  ├── pricing_specialist: "What is the current Pro Plan pricing?"
  │     └── searches pricing_db → returns $39/month details
  ├── pricing_specialist: "What do competitors charge for similar plans?"
  │     └── searches web_search → returns competitor pricing
  └── product_specialist: "Who are the enterprise sales contacts?"
        └── searches hr_db → returns sales team info

Orchestrator synthesizes all three into one coherent answer.
```

---

## How It All Connects

The progression from basic RAG to Agentic RAG:

| Capability | Basic RAG | Agentic RAG | Multi-Agent RAG |
|------------|-----------|-------------|-----------------|
| Knowledge sources | One vector store | Multiple sources | Multiple sources per specialist |
| Query routing | None (all queries → same store) | Agent chooses source | Orchestrator delegates to specialists |
| Self-evaluation | None | Agent judges sufficiency | Each specialist validates independently |
| Complex questions | Struggles | Decomposes into sub-queries | Parallelizes across domain experts |
| Error recovery | None | Retries with refined queries | Specialists can escalate back |

The thread connecting all of it remains the same principle: **an AI agent is only as good as its information**. The architecture has gotten more sophisticated, but the automated refresh processes, feedback loops, and freshness tracking from the basic RAG implementation still underpin everything. Without those, even the most sophisticated agentic system will confidently serve outdated answers.

---
