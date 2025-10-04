# Quick Start Guide

Get started with SpaceBio Semantic Search in 3 simple steps!

## Step 1: Install Dependencies

```bash
pip install -r requirements.txt
```

**Required packages:**
- FastAPI (web framework)
- Uvicorn (ASGI server)
- Sentence Transformers (AI embeddings)
- FAISS (vector search)
- NumPy, Pandas, BeautifulSoup4 (data processing)

## Step 2: Start the Server

```bash
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

The server will start on `http://localhost:8000`

## Step 3: Use the Interface

### Option A: Web Interface (Recommended for beginners)

1. Open your browser and go to: `http://localhost:8000`
2. Enter a search query like "bone loss in microgravity"
3. Click "Search" or press Enter
4. Click "View AI Summary" on any result to see a summary
5. Click "Full Publication" to see complete details

### Option B: API (For developers)

**Search for publications:**
```bash
curl "http://localhost:8000/search?q=bone%20loss&k=5"
```

**Get AI summary:**
```bash
curl -X POST "http://localhost:8000/summarize/PMC3630201"
```

**Get full publication:**
```bash
curl "http://localhost:8000/pub/PMC3630201"
```

**Check health:**
```bash
curl "http://localhost:8000/health"
```

## Example Searches

Try these searches to get started:

1. **Bone Health**: "bone loss in space" or "bone density microgravity"
2. **Radiation**: "radiation exposure astronauts" or "cosmic radiation effects"
3. **Muscle**: "muscle atrophy weightlessness" or "muscle mass space"
4. **Cardiovascular**: "heart function microgravity" or "blood pressure space"
5. **Plants in Space**: "plant growth space" or "photosynthesis microgravity"

## Understanding Results

### Relevance Score
- Lower scores = better matches
- Score is the distance in embedding space
- Scores typically range from 20-100

### Sections
Results come from different paper sections:
- `abstract`: High-level overview
- `introduction`: Background and motivation
- `methods`: Experimental procedures
- `results`: Findings and data
- `discussion`: Interpretation and implications
- `conclusion`: Summary and future work

### AI Summaries
The summary includes:
- Publication title, authors, and year
- Key points from the abstract
- Main findings from results or conclusions
- Limited to ~1000 characters for quick reading

## Tips for Better Searches

1. **Be specific**: "bone loss microgravity rats" is better than "bones"
2. **Use scientific terms**: "muscle atrophy" vs "muscle loss"
3. **Try synonyms**: "weightlessness", "microgravity", "zero-g"
4. **Adjust result count**: Use the dropdown to see more or fewer results
5. **Read abstracts first**: They give you the best overview

## Troubleshooting

### "No results found"
- Try broader search terms
- Check spelling
- Try synonyms or related terms

### Server won't start
- Make sure all dependencies are installed
- Check that port 8000 is not already in use
- Verify that data files exist in the `data/` directory

### Frontend not loading
- Make sure the `frontend/` directory exists
- Check browser console for errors
- Try accessing API directly at `/docs`

### Slow search
- First search is slower (loading model)
- Subsequent searches are much faster
- Consider reducing result count

## API Documentation

Interactive API documentation is available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Next Steps

Once you're comfortable with basic searching:

1. **Explore the API**: Try the interactive docs at `/docs`
2. **Integrate**: Use the API in your own applications
3. **Customize**: Modify the frontend to match your needs
4. **Expand**: Add more publications with `ingest_epmc.py`

## Need Help?

- Check `README.md` for detailed information
- Read `FEATURES.md` for feature documentation
- Open an issue on GitHub for bugs or questions

Happy searching! 🚀🔬
