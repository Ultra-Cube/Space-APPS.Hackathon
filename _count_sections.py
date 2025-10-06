import json
from pathlib import Path
pub_dir = Path('data/publications')
tot = 0
with_sections = 0
with_long_sections = 0
section_counts = {}
long_section_counts = {}
for path in pub_dir.glob('PMC*.json'):
    tot += 1
    data = json.loads(path.read_text(encoding='utf-8'))
    sections = data.get('sections', {}) or {}
    count = len([k for k,v in sections.items() if isinstance(v, str) and v.strip()])
    long_count = len([k for k,v in sections.items() if isinstance(v, str) and len(v.strip()) >= 40])
    if count:
        with_sections += 1
    if long_count:
        with_long_sections += 1
    section_counts[count] = section_counts.get(count, 0) + 1
    long_section_counts[long_count] = long_section_counts.get(long_count, 0) + 1

print({'total': tot, 'with_sections': with_sections, 'with_long_sections': with_long_sections})
print('section_counts', sorted(section_counts.items())[:10])
print('long_section_counts', sorted(long_section_counts.items())[:10])
