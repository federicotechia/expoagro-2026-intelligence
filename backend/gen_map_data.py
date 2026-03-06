import fitz  # PyMuPDF
import json
import os

pdf_path = '../infoextra/EXPOAGRO-2026-Plano-Expositores-2026-01-30-CON-final (1).pdf'
# Usually the map is on the first page
doc = fitz.open(pdf_path)
page = doc[0]

# Render to image for frontend
pix = page.get_pixmap(dpi=150)
output_img = 'mapa_expoagro.jpg'
pix.save(output_img)

# Search for lot numbers (from 1 to 2000 just in case)
coords = {}
for i in range(1, 1500):
    text = str(i)
    # Find position of this number text
    rects = page.search_for(text)
    if rects:
        # Save center of the first match as representant
        r = rects[0]
        # x, y normalized to 0..1 (standard for responsive overlays)
        coords[i] = {
            "x": (r.x0 + r.x1) / 2 / page.rect.width,
            "y": (r.y0 + r.y1) / 2 / page.rect.height
        }

with open('map_coords.json', 'w') as f:
    json.dump(coords, f)

print(f"Mapa guardado y {len(coords)} lotes mapeados.")
doc.close()
