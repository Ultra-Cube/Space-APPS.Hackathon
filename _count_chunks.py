import json
from pathlib import Path
data = json.loads(Path('data/chunks_meta.json').read_text(encoding='utf-8'))
print(len(data))
print(len({item['pub_id'] for item in data}))
