#!/usr/bin/env python3
"""Rebuild embeddings and FAISS index from cached publication JSON files."""

from __future__ import annotations

import json
from pathlib import Path
from typing import List, Dict, Any

from ingest_epmc import (
    PUBS_DIR,
    CHUNKS_META_PATH,
    EMBEDDINGS_PATH,
    FAISS_INDEX_PATH,
    INDEX_INFO_PATH,
    build_chunks_and_embeddings,
    build_faiss,
)


def load_cached_records() -> List[Dict[str, Any]]:
    """Load all cached publication JSON records from the publications directory."""
    records: List[Dict[str, Any]] = []
    pub_dir = Path(PUBS_DIR)
    if not pub_dir.exists():
        raise FileNotFoundError(f"Publications directory not found: {pub_dir}")

    for path in sorted(pub_dir.glob("PMC*.json")):
        with path.open("r", encoding="utf-8") as handle:
            records.append(json.load(handle))
    return records


def main() -> None:
    records = load_cached_records()
    if not records:
        raise RuntimeError("No cached publications found. Run ingest_epmc.py first.")

    print(f"Loaded {len(records)} cached publications from {PUBS_DIR}.")

    embeddings, meta = build_chunks_and_embeddings(records)
    if embeddings is None or meta is None:
        raise RuntimeError("No embeddings were generated from cached publications.")

    index = build_faiss(embeddings)

    print("Rebuilt artifacts:")
    print(f"  • {CHUNKS_META_PATH}: {len(meta)} chunks")
    print(f"  • {EMBEDDINGS_PATH}: shape {embeddings.shape}")
    print(f"  • {FAISS_INDEX_PATH}: {index.ntotal} vectors")
    print(f"  • {INDEX_INFO_PATH}: metadata updated")


if __name__ == "__main__":
    main()
