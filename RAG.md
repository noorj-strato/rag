# Implementing Retrieval-Augmented Generation (RAG) in Python

A step-by-step guide to building RAG into any AI agent — from indexing your knowledge base to keeping it fresh.

---

## The Core Idea

RAG extends LLM capabilities to your organization's knowledge base **without retraining the model**. You're building a pipeline with three jobs: **index your knowledge**, **retrieve what's relevant**, and **inject it into the prompt**.

---

## Step 1: Prepare Your Knowledge Base

Before anything, you need documents in a format you can search semantically. This means converting your data into **embeddings** — numerical vectors that capture meaning.

```python
from openai import OpenAI
from langchain.text_splitters import RecursiveCharacterTextSplitter

client = OpenAI()

# Your raw knowledge — could be docs, PDFs, database exports, API responses
documents = [
    "The Pro Plan costs $39/month as of January 2026. It includes 25 team members...",
    "Our return policy allows 60-day returns. Digital products have a 14-day window...",
    # ... hundreds or thousands of chunks
]

# Step 1a: Chunk your documents
# Large documents need to be split into digestible pieces.
# Too large = diluted relevance. Too small = lost context.
splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,      # ~500 chars per chunk
    chunk_overlap=50,    # overlap so you don't cut mid-sentence
)
chunks = []
for doc in documents:
    chunks.extend(splitter.split_text(doc))

# Step 1b: Generate embeddings for each chunk
def get_embedding(text: str) -> list[float]:
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return response.data[0].embedding

embedded_chunks = [
    {"text": chunk, "embedding": get_embedding(chunk)}
    for chunk in chunks
]
```

### Why Chunking Matters

If you feed a 20-page document as one embedding, the vector becomes a vague average of everything in it. Smaller chunks mean more precise retrieval. The `chunk_overlap` prevents you from slicing a sentence in half and losing meaning.

### TypeScript Equivalent

Use the `openai` npm package — the embedding call is nearly identical. For splitting, `langchain` has a JS version, or you can use `@xenova/transformers` for local embeddings.

---

## Step 2: Store in a Vector Database

You need somewhere to store these embeddings and search them fast. This is where vector databases come in.

```python
import chromadb

# ChromaDB is the simplest to start with (runs locally, no setup)
chroma_client = chromadb.Client()
collection = chroma_client.create_collection(name="knowledge_base")

# Index all your chunks
collection.add(
    ids=[f"chunk_{i}" for i in range(len(embedded_chunks))],
    documents=[c["text"] for c in embedded_chunks],
    embeddings=[c["embedding"] for c in embedded_chunks],
    metadatas=[{"source": "pricing_doc", "updated_at": "2026-01-15"}]  # track freshness!
)
```

### Vector Database Options

| Database | Type | Best For |
|----------|------|----------|
| **ChromaDB** | Local, zero config | Prototyping and small projects |
| **Pinecone** | Managed cloud | Production scale, minimal ops |
| **Weaviate** | Self-hosted / cloud | Flexible schema, hybrid search |
| **Qdrant** | Self-hosted / cloud | High performance, filtering |
| **Milvus** | Self-hosted | Large-scale enterprise |
| **pgvector** | PostgreSQL extension | Already on Postgres, add vector search |

The metadata field is critical. Storing `updated_at` lets you filter out stale chunks or prioritize recent ones during retrieval.

---

## Step 3: The Retrieval Function

When a user asks a question, you embed their query the same way and find the closest chunks.

### Basic Retrieval

```python
def retrieve(query: str, n_results: int = 3) -> list[str]:
    results = collection.query(
        query_texts=[query],
        n_results=n_results,
    )
    return results["documents"][0]  # list of the top matching chunks
```

### Production Retrieval (with freshness filtering and re-ranking)

```python
def retrieve_smart(query: str, n_results: int = 5) -> list[str]:
    results = collection.query(
        query_texts=[query],
        n_results=n_results,
        where={"updated_at": {"$gte": "2025-06-01"}},  # filter out old data
    )

    # Re-rank: the vector search gets you candidates,
    # but a second pass can improve precision
    candidates = results["documents"][0]

    # Optional: use a cross-encoder or LLM to re-rank
    # This catches cases where embedding similarity != actual relevance
    return candidates[:3]
```

---

## Step 4: Augment the Prompt

This is where retrieval meets generation. You take the retrieved chunks and inject them into the LLM prompt as context.

```python
def ask_agent(user_question: str) -> str:
    # Retrieve relevant context
    context_chunks = retrieve_smart(user_question)
    context = "\n\n---\n\n".join(context_chunks)

    # Build the augmented prompt
    messages = [
        {
            "role": "system",
            "content": f"""You are a helpful assistant. Answer the user's question
using ONLY the provided context. If the context doesn't contain enough
information to answer, say so — do not make things up.

CONTEXT:
{context}"""
        },
        {
            "role": "user",
            "content": user_question
        }
    ]

    # Generate
    response = client.chat.completions.create(
        model="gpt-4o",  # or claude via Anthropic SDK
        messages=messages,
        temperature=0.2,  # lower = more faithful to context
    )

    return response.choices[0].message.content
```

### Two Critical Details

1. **The system prompt explicitly tells the LLM to use the provided context and express uncertainty** when it can't answer — this prevents the agent from confidently making things up when it lacks current information.

2. **Low temperature** keeps the model grounded in the retrieved facts rather than getting creative with hallucinated details.

---

## Step 5: Keep It Fresh (The Hard Part)

This is where most RAG implementations fail. Keeping agents fresh isn't a one-time setup — it's an ongoing commitment. Your RAG system is only as fresh as the data it queries.

```python
import schedule
import time
from datetime import datetime

def refresh_knowledge_base():
    """Pull fresh data from all sources and re-index."""

    # 1. Pull from live sources
    pricing = fetch_from_api("/api/pricing")
    policies = fetch_from_api("/api/policies")
    org_chart = fetch_from_api("/api/org")

    # 2. Detect what changed (don't re-index everything)
    new_chunks = chunk_and_embed(pricing + policies + org_chart)

    # 3. Upsert — update existing, add new, remove deleted
    collection.upsert(
        ids=[c["id"] for c in new_chunks],
        documents=[c["text"] for c in new_chunks],
        embeddings=[c["embedding"] for c in new_chunks],
        metadatas=[{**c["meta"], "updated_at": datetime.now().isoformat()}]
    )

    print(f"Refreshed {len(new_chunks)} chunks at {datetime.now()}")

# Automate it — the key is making it automatic, not dependent on someone remembering
schedule.every(1).hours.do(refresh_knowledge_base)   # hourly for fast-moving data
# schedule.every().week.do(refresh_knowledge_base)   # weekly for stable data

while True:
    schedule.run_pending()
    time.sleep(60)
```

### Refresh Cadence Guidelines

| Data Type | Suggested Cadence |
|-----------|-------------------|
| News / social media | Every 15–60 minutes |
| Pricing / inventory | Hourly |
| Product documentation | Per release / daily |
| Company policies | Daily / weekly |
| HR / org chart | On change (event-driven) |

---

## Step 6: Add Feedback Loops

Track whether answers are actually useful. Did users edit its drafts? Override its suggestions? These signals reveal far more than uptime metrics.

```python
def ask_agent_with_tracking(user_question: str) -> dict:
    context_chunks = retrieve_smart(user_question)
    answer = generate_answer(user_question, context_chunks)

    # Log everything for analysis
    log_entry = {
        "question": user_question,
        "retrieved_chunks": context_chunks,
        "answer": answer,
        "timestamp": datetime.now().isoformat(),
        # These get filled in later by user actions:
        "user_edited": None,       # did they modify the answer?
        "user_overrode": None,     # did they reject it entirely?
        "thumbs_up": None,         # explicit feedback
    }
    save_to_analytics(log_entry)

    return {"answer": answer, "sources": context_chunks, "id": log_entry["id"]}
```

When you see patterns — certain question types always get overridden, certain document sources produce bad answers — that tells you where your knowledge base has gaps or staleness.

---

## Dependencies

```bash
pip install openai langchain chromadb schedule
```

---

## Next Steps

Once basic RAG is working, consider these improvements:

- **Agentic RAG** — the agent decides *where* to search based on the query type (see AGENTIC-RAG.md)
- **Hybrid search** — combine vector similarity with keyword search (BM25) for better recall
- **Query routing** — use a classifier to send pricing questions to one knowledge base and policy questions to another
- **Re-ranking** — use a cross-encoder model to re-score retrieved chunks for higher precision
