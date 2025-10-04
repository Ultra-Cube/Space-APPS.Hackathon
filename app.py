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
