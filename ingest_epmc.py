#!/usr/bin/env python3
# ingest_epmc.py
"""
Pipeline to:
- Download SB_publication_PMC.csv from GitHub.
- For each row, try to fetch fullTextXML from Europe PMC (or fallback to PMC HTML/PDF).
- Parse sections, split into chunks, compute embeddings, build FAISS index.
- Save per-publication JSON to data/publications/
- Save chunks metadata, embeddings, and faiss index to data/
"""

import os
import re
import time
import json
import math
import requests
import traceback
import numpy as np
import pandas as pd
from io import BytesIO, StringIO
from tqdm import tqdm
from bs4 import BeautifulSoup
from sentence_transformers import SentenceTransformer
import faiss
import fitz  # PyMuPDF

# -------- CONFIG ----------
CSV_RAW_URL = "https://raw.githubusercontent.com/jgalazka/SB_publications/main/SB_publication_PMC.csv"
DATA_DIR = "data"
PUBS_DIR = os.path.join(DATA_DIR, "publications")
RAW_HTML_DIR = os.path.join(DATA_DIR, "raw_html")
RAW_PDF_DIR = os.path.join(DATA_DIR, "raw_pdfs")
CHUNKS_META_PATH = os.path.join(DATA_DIR, "chunks_meta.json")
EMBEDDINGS_PATH = os.path.join(DATA_DIR, "embeddings.npy")
FAISS_INDEX_PATH = os.path.join(DATA_DIR, "faiss_index.idx")
INDEX_INFO_PATH = os.path.join(DATA_DIR, "index_info.json")

CHUNK_SIZE_CHARS = 1200
CHUNK_OVERLAP = 250
EMB_MODEL = "sentence-transformers/all-mpnet-base-v2"  # جودة ممتازة
BATCH_SIZE_EMB = 64
MAX_RETRIES = 3
SLEEP_BETWEEN_REQS = 0.2  # لتخفيف الضغط على الخوادم
# --------------------------

os.makedirs(PUBS_DIR, exist_ok=True)
os.makedirs(RAW_HTML_DIR, exist_ok=True)
os.makedirs(RAW_PDF_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

session = requests.Session()
session.headers.update({"User-Agent": "spacebio-ingest/1.0 (contact: you@example.com)"})

def download_text(url, timeout=30):
    for attempt in range(MAX_RETRIES):
        try:
            r = session.get(url, timeout=timeout)
            r.raise_for_status()
            return r.text
        except Exception as e:
            time.sleep(1 + attempt*0.5)
    return None

def download_binary(url, timeout=60):
    for attempt in range(MAX_RETRIES):
        try:
            r = session.get(url, timeout=timeout)
            r.raise_for_status()
            return r.content
        except Exception:
            time.sleep(1 + attempt*0.5)
    return None

def fetch_csv(url):
    txt = download_text(url)
    if not txt:
        raise RuntimeError("Failed to download CSV from GitHub.")
    df = pd.read_csv(StringIO(txt))
    print("CSV loaded, rows:", len(df))
    return df

def find_pmcid_in_row(row):
    # Try known columns
    for c in row.index:
        cname = str(c).lower()
        val = row[c]
        if pd.isna(val):
            continue
        s = str(val).strip()
        if cname in ("pmcid","pmc id","pmc_id","pmc"):
            # normalize
            m = re.search(r"(PMC\d+)", s, re.I)
            return m.group(1) if m else s
        if "http" in s and "ncbi.nlm.nih.gov/pmc/articles" in s:
            parts = s.strip("/").split("/")
            return parts[-1]
        # sometimes there is "PMC12345" inside other column
        m = re.search(r"(PMC\d+)", s, re.I)
        if m:
            return m.group(1)
    return None

def fetch_epmc_fulltext_xml(pmcid):
    # Europe PMC endpoint for fullTextXML
    # Example: https://www.ebi.ac.uk/europepmc/webservices/rest/PMCxxxxx/fullTextXML
    url = f"https://www.ebi.ac.uk/europepmc/webservices/rest/{pmcid}/fullTextXML"
    txt = download_text(url, timeout=30)
    if txt:
        return txt
    return None

def fetch_pmc_html(pmcid):
    url = f"https://www.ncbi.nlm.nih.gov/pmc/articles/{pmcid}/"
    txt = download_text(url, timeout=30)
    return txt

def parse_xml_sections(xml_text):
    # Try parse XML (which often has <sec> or <abstract> etc.)
    try:
        soup = BeautifulSoup(xml_text, "lxml-xml")
    except Exception:
        soup = BeautifulSoup(xml_text, "html.parser")
    sections = {}
    # Abstract
    abs_tag = soup.find('abstract')
    if abs_tag:
        sections['abstract'] = abs_tag.get_text(separator="\n").strip()
    # <sec> sections
    sec_tags = soup.find_all('sec')
    if sec_tags:
        for sec in sec_tags:
            title_tag = sec.find('title')
            title = title_tag.get_text().strip() if title_tag else "section"
            key = re.sub(r'\s+','_', title.lower())[:60]
            txt = sec.get_text(separator="\n").strip()
            if txt:
                sections[key] = txt
    # fallback: body text
    if not sections:
        body = soup.find('body')
        if body:
            sections['full_text'] = body.get_text(separator="\n").strip()
    return sections

def parse_html_sections(html):
    soup = BeautifulSoup(html, "html.parser")
    sections = {}
    # try <sec> first
    secs = soup.find_all("sec")
    if secs:
        for sec in secs:
            title_tag = sec.find("title")
            title = title_tag.get_text().strip() if title_tag else "section"
            key = re.sub(r'\s+','_', title.lower())[:60]
            txt = sec.get_text(separator="\n").strip()
            if txt:
                sections[key] = txt
    else:
        # try headings h2/h3 blocks
        headings = soup.find_all(re.compile("^h[1-4]$"))
        if headings:
            for h in headings:
                title = h.get_text().strip()
                key = re.sub(r'\s+','_', title.lower())[:60]
                content_parts = []
                for sib in h.next_siblings:
                    if getattr(sib, "name", None) and re.match(r"^h[1-4]$", sib.name, re.I):
                        break
                    txt = getattr(sib, "get_text", lambda **k: None)(separator="\n")
                    if txt and txt.strip():
                        content_parts.append(txt.strip())
                content = "\n".join(content_parts).strip()
                if content:
                    sections[key] = content
    # fallback
    if not sections:
        body = soup.find("body")
        if body:
            sections["full_text"] = body.get_text(separator="\n").strip()
    return sections

def extract_text_from_pdf_bytes(content_bytes):
    try:
        doc = fitz.open(stream=content_bytes, filetype="pdf")
        pages = []
        for p in doc:
            t = p.get_text("text")
            if t:
                pages.append(t)
        return "\n\n".join(pages)
    except Exception as e:
        # parse error
        return None

def split_text_to_chunks(text, chunk_size=CHUNK_SIZE_CHARS, overlap=CHUNK_OVERLAP):
    if not text:
        return []
    text = text.replace('\r','\n')
    length = len(text)
    chunks = []
    start = 0
    while start < length:
        end = start + chunk_size
        chunk = text[start:end]
        chunks.append({"text": chunk, "start": start, "end": min(end, length)})
        start = end - overlap
        if start < 0:
            start = 0
        if start >= length:
            break
    return chunks

def save_pub_json(pubrec):
    out = os.path.join(PUBS_DIR, f"{pubrec['id']}.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(pubrec, f, ensure_ascii=False, indent=2)

def process_row(row):
    try:
        pmc = find_pmcid_in_row(row)
        # build basic metadata
        rec = {
            "id": pmc if pmc else f"row_{int(time.time()*1000)}",
            "title": row.get("title") if "title" in row.index else row.get("Title", "") or "",
            "authors": row.get("authors") if "authors" in row.index else row.get("Authors", "") or "",
            "year": row.get("year") if "year" in row.index else row.get("Year", "") or "",
            "doi": row.get("doi") if "doi" in row.index else row.get("DOI", "") or "",
            "source_row": row.to_dict(),
            "sections": {},
            "pmc_url": f"https://www.ncbi.nlm.nih.gov/pmc/articles/{pmc}/" if pmc else ""
        }

        # 1) try Europe PMC fullTextXML
        xml = None
        if pmc:
            xml = fetch_epmc_fulltext_xml(pmc)
            time.sleep(SLEEP_BETWEEN_REQS)
        if xml:
            sections = parse_xml_sections(xml)
            rec['sections'] = sections
            # save raw xml
            with open(os.path.join(RAW_HTML_DIR, f"{rec['id']}.xml"), "w", encoding="utf-8") as f:
                f.write(xml)
            return rec

        # 2) fallback to PMC HTML
        html = None
        if pmc:
            html = fetch_pmc_html(pmc)
            time.sleep(SLEEP_BETWEEN_REQS)
        if html:
            sections = parse_html_sections(html)
            rec['sections'] = sections
            with open(os.path.join(RAW_HTML_DIR, f"{rec['id']}.html"), "w", encoding="utf-8") as f:
                f.write(html)
            # try find PDF url
            soup = BeautifulSoup(html, "html.parser")
            pdf_url = None
            # try meta tag
            meta = soup.find("meta", attrs={"name":"citation_pdf_url"})
            if meta and meta.get("content"):
                pdf_url = meta.get("content")
            # try anchor with .pdf or /pdf/
            if not pdf_url:
                for a in soup.find_all("a", href=True):
                    href = a['href']
                    if href.lower().endswith(".pdf") or "/pdf/" in href:
                        pdf_url = requests.compat.urljoin("https://www.ncbi.nlm.nih.gov", href)
                        break
            if pdf_url:
                pdf_bytes = download_binary(pdf_url)
                if pdf_bytes:
                    ppath = os.path.join(RAW_PDF_DIR, f"{rec['id']}.pdf")
                    with open(ppath, "wb") as f:
                        f.write(pdf_bytes)
                    txt = extract_text_from_pdf_bytes(pdf_bytes)
                    if txt and not rec['sections']:
                        rec['sections'] = {"full_text": txt}
            return rec

        # 3) no pmc available: try DOI-based retrieval (not implemented here) or return minimal record
        return rec

    except Exception as e:
        print("Error processing row:", e)
        traceback.print_exc()
        return None

def ingest_all(df, limit=None):
    records = []
    rows = df.iterrows()
    if limit:
        rows = df.head(limit).iterrows()
    for idx, row in tqdm(rows, total=(limit if limit else len(df))):
        rec = process_row(row)
        if rec:
            save_pub_json(rec)
            records.append(rec)
    return records

def build_chunks_and_embeddings(records, model_name=EMB_MODEL):
    model = SentenceTransformer(model_name)
    texts = []
    meta = []
    for rec in records:
        pid = rec["id"]
        secs = rec.get("sections", {}) or {}
        # prefer: results, discussion, conclusion, abstract
        order = []
        # choose better keys heuristically
        for pref in ["results","result","discussion","conclusion","abstract","full_text"]:
            for k in secs.keys():
                if pref in k.lower() and k not in order:
                    order.append(k)
        # append remaining
        for k in secs.keys():
            if k not in order:
                order.append(k)
        for sec in order:
            txt = secs.get(sec, "")
            if not txt or len(txt.strip()) < 40:
                continue
            chunks = split_text_to_chunks(txt)
            for ch in chunks:
                texts.append(ch["text"])
                meta.append({
                    "pub_id": pid,
                    "section": sec,
                    "start": ch["start"],
                    "end": ch["end"],
                    "excerpt": ch["text"][:300]
                })
    if not texts:
        print("No text chunks to embed.")
        return None, None
    # embeddings in batches
    emb_list = []
    for i in tqdm(range(0, len(texts), BATCH_SIZE_EMB), desc="Embedding"):
        batch = texts[i:i+BATCH_SIZE_EMB]
        emb = model.encode(batch, show_progress_bar=False, convert_to_numpy=True)
        emb_list.append(emb)
    embeddings = np.vstack(emb_list).astype("float32")
    np.save(EMBEDDINGS_PATH, embeddings)
    with open(CHUNKS_META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    return embeddings, meta

def build_faiss(embeddings):
    dim = embeddings.shape[1]
    index = faiss.IndexFlatL2(dim)
    index.add(embeddings)
    faiss.write_index(index, FAISS_INDEX_PATH)
    # save info
    info = {"n_vectors": embeddings.shape[0], "dim": dim}
    with open(INDEX_INFO_PATH, "w", encoding="utf-8") as f:
        json.dump(info, f, ensure_ascii=False, indent=2)
    return index

def main():
    print("Starting ingestion pipeline...")
    df = fetch_csv(CSV_RAW_URL)
    # optional: filter rows with some pmc presence or process all
    # If you want to limit for quick test: pass limit=N to ingest_all
    # records = ingest_all(df, limit=None)  
    records = ingest_all(df, limit=None)
    print("Total records processed:", len(records))
    # build embeddings & index
    embeddings, meta = build_chunks_and_embeddings(records)
    if embeddings is None:
        print("No embeddings built. Exiting.")
        return
    index = build_faiss(embeddings)
    print("Ingestion complete.")
    print("Saved files under:", DATA_DIR)

if __name__ == "__main__":
    main()
