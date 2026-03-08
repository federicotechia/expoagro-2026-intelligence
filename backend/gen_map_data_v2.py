import fitz
import json
import os

pdf_path = '../infoextra/EXPOAGRO-2026-Plano-Expositores-2026-01-30-CON-final (1).pdf'
if not os.path.exists(pdf_path):
    pdf_path = 'infoextra/EXPOAGRO-2026-Plano-Expositores-2026-01-30-CON-final (1).pdf'

print(f"Opening {pdf_path}...")
doc = fitz.open(pdf_path)
page = doc[0]

# Predefined key stands if not found
coords = {
    "520": {"x": 0.38, "y": 0.42}, # Crucianelli (Manually guessed based on 'Center-West')
    "170": {"x": 0.15, "y": 0.25}, # Claas
    "300": {"x": 0.25, "y": 0.45}, # Cestari
    "620": {"x": 0.45, "y": 0.55}, # Banco Galicia
    "560": {"x": 0.4, "y": 0.55},  # Banco Santander
    "1000": {"x": 0.75, "y": 0.4}, # Banco Macro
    "1470": {"x": 0.9, "y": 0.6}, # Banco Credicoop
    "840": {"x": 0.65, "y": 0.45}, # Agrometal
    "710": {"x": 0.55, "y": 0.45}, # Akron
}

# Since text search failed, we at least have these.
# But let's try to search for the TEXT labels instead of numbers (Brahman, Hereford were found before)
labels = {
    "Brahman": {"x": 0.85, "y": 0.75},
    "Hereford": {"x": 0.85, "y": 0.8},
    "Senepol": {"x": 0.85, "y": 0.85},
    "NACIÓN": {"x": 0.5, "y": 0.1},
    "YPF": {"x": 0.4, "y": 0.1}
}

for label, pos in labels.items():
    rects = page.search_for(label)
    if rects:
        r = rects[0]
        # Overwrite with real position if found
        coords[label] = {
            "x": (r.x0 + r.x1) / 2 / page.rect.width,
            "y": (r.y0 + r.y1) / 2 / page.rect.height
        }

with open('map_coords.json', 'w') as f:
    json.dump(coords, f)

print(f"Saved {len(coords)} coordinates.")
doc.close()
