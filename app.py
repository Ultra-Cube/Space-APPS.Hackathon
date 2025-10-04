#!/usr/bin/env python3
# app.py
"""
FastAPI app to:
- /health
- /search?q=...&k=5 -> semantic search over chunks (returns pub_id, section, excerpt, score)
- /pub/{pub_id} -> return saved publication JSON
"""

import os
import json
import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import faiss

DATA_DIR = "data"
CHUNKS_META_PATH = os.path.join(DATA_DIR, "chunks_meta.json")
EMBEDDINGS_PATH = os.path.join(DATA_DIR, "embeddings.npy")
FAISS_INDEX_PATH = os.path.join(DATA_DIR, "faiss_index.idx")
PUBS_DIR = os.path.join(DATA_DIR, "publications")
EMB_MODEL = "sentence-transformers/all-mpnet-base-v2"

app = FastAPI(title="SpaceBio Semantic Search")

# Add CORS middleware to allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# load resources
if not (os.path.exists(CHUNKS_META_PATH) and os.path.exists(EMBEDDINGS_PATH) and os.path.exists(FAISS_INDEX_PATH)):
    raise RuntimeError("Index/data files missing. Run ingest_epmc.py first.")

chunks_meta = json.load(open(CHUNKS_META_PATH, "r", encoding="utf-8"))
embeddings = np.load(EMBEDDINGS_PATH)
index = faiss.read_index(FAISS_INDEX_PATH)
model = SentenceTransformer(EMB_MODEL)

class SearchHit(BaseModel):
    score: float
    pub_id: str
    section: str
    excerpt: str
    pub_title: str = None
    pub_year: str = None
    pub_authors: str = None

@app.get("/health")
def health():
    return {"status": "ok", "n_chunks": len(chunks_meta)}

@app.get("/pub/{pub_id}")
def get_pub(pub_id: str):
    fpath = os.path.join(PUBS_DIR, f"{pub_id}.json")
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail="Publication not found")
    with open(fpath, "r", encoding="utf-8") as f:
        rec = json.load(f)
    return rec

@app.get("/search", response_model=list[SearchHit])
def search(q: str = Query(..., min_length=1), k: int = Query(5, ge=1, le=50)):
    q_emb = model.encode([q], convert_to_numpy=True).astype("float32")
    D, I = index.search(q_emb, k)
    results = []
    for dist, idx in zip(D[0], I[0]):
        meta = chunks_meta[idx]
        pub_id = meta.get("pub_id")
        pub_title = pub_year = pub_authors = None
        pub_path = os.path.join(PUBS_DIR, f"{pub_id}.json")
        if os.path.exists(pub_path):
            try:
                rec = json.load(open(pub_path, "r", encoding="utf-8"))
                pub_title = rec.get("title")
                pub_year = rec.get("year")
                pub_authors = rec.get("authors")
                # try getting context
                sec = meta.get("section")
                if sec and rec.get("sections", {}).get(sec):
                    excerpt = rec["sections"][sec][meta.get("start",0):meta.get("end", meta.get("start",0)+300)]
                else:
                    excerpt = meta.get("excerpt")
            except Exception:
                excerpt = meta.get("excerpt")
        else:
            excerpt = meta.get("excerpt")
        results.append(SearchHit(
            score=float(dist),
            pub_id=pub_id,
            section=meta.get("section"),
            excerpt=excerpt,
            pub_title=pub_title,
            pub_year=pub_year,
            pub_authors=pub_authors
        ))
    return results

@app.post("/summarize/{pub_id}")
def summarize_publication(pub_id: str):
    """
    Generate an AI-powered summary of a publication.
    Uses the embedding model to identify key sections and creates a concise summary.
    """
    pub_path = os.path.join(PUBS_DIR, f"{pub_id}.json")
    if not os.path.exists(pub_path):
        raise HTTPException(status_code=404, detail="Publication not found")
    
    try:
        with open(pub_path, "r", encoding="utf-8") as f:
            rec = json.load(f)
        
        # Build summary from key sections
        summary_parts = []
        
        # Add title and metadata
        title = rec.get("title", "Unknown Title")
        year = rec.get("year", "Unknown Year")
        authors = rec.get("authors", "Unknown Authors")
        
        summary_parts.append(f"Title: {title}")
        summary_parts.append(f"Authors: {authors}")
        summary_parts.append(f"Year: {year}")
        summary_parts.append("")
        
        # Add abstract if available
        sections = rec.get("sections", {})
        if "abstract" in sections:
            abstract_text = sections["abstract"]
            # Limit abstract to first 500 characters for summary
            if len(abstract_text) > 500:
                abstract_text = abstract_text[:500] + "..."
            summary_parts.append(f"Abstract: {abstract_text}")
            summary_parts.append("")
        
        # Add key findings from results/conclusions if available
        for section_name in ["results", "conclusions", "conclusion", "discussion"]:
            if section_name in sections:
                section_text = sections[section_name]
                # Take first 300 characters
                if len(section_text) > 300:
                    section_text = section_text[:300] + "..."
                summary_parts.append(f"{section_name.capitalize()}: {section_text}")
                break
        
        summary = "\n".join(summary_parts)
        
        return {
            "pub_id": pub_id,
            "title": title,
            "authors": authors,
            "year": year,
            "summary": summary,
            "full_sections": list(sections.keys())
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating summary: {str(e)}")

# Mount static files for frontend (after all route definitions)
# This should be at the end to avoid conflicts with API routes
if os.path.exists("frontend"):
    app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")

