import fitz
import json
import os

pdf_path = '../infoextra/EXPOAGRO-2026-Plano-Expositores-2026-01-30-CON-final (1).pdf'
if not os.path.exists(pdf_path):
    pdf_path = 'infoextra/EXPOAGRO-2026-Plano-Expositores-2026-01-30-CON-final (1).pdf'

doc = fitz.open(pdf_path)
page = doc[0]

# Generate map_coords.json with some manual defaults for sectors if nothing found
# And try to find SOME numbers.
default_coords = {
    # Sector guesses based on common expo layouts
    "520": {"x": 0.45, "y": 0.5}, # Crucianelli
    "840": {"x": 0.6, "y": 0.4},  # Agrometal
    "710": {"x": 0.55, "y": 0.6}, # Akron
    "650": {"x": 0.5, "y": 0.4},  # Apache
    "170": {"x": 0.2, "y": 0.3},  # Claas
    "1000": {"x": 0.8, "y": 0.5}  # Macro
}

# Try to find all numbers 1-1500 using a more aggressive search
found_count = 0
for i in range(1, 1600):
    s = str(i)
    rects = page.search_for(s)
    if rects:
        r = rects[0]
        default_coords[s] = {
            "x": (r.x0 + r.x1) / 2 / page.rect.width,
            "y": (r.y0 + r.y1) / 2 / page.rect.height
        }
        found_count += 1

with open('map_coords.json', 'w') as f:
    json.dump(default_coords, f)

print(f"Done. Found {found_count} coords via search + manual defaults.")
doc.close()
