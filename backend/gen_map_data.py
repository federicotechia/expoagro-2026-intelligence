import fitz  # PyMuPDF
import json
import os
import re

pdf_path = '../infoextra/EXPOAGRO-2026-Plano-Expositores-2026-01-30-CON-final (1).pdf'
if not os.path.exists(pdf_path):
    # Fallback path if run from backend subdir
    pdf_path = 'infoextra/EXPOAGRO-2026-Plano-Expositores-2026-01-30-CON-final (1).pdf'

print(f"Opening {pdf_path}...")
doc = fitz.open(pdf_path)
page = doc[0]

# Render to image for frontend
print("Saving image...")
pix = page.get_pixmap(dpi=150)
output_img = 'mapa_expoagro.jpg'
pix.save(output_img)

print("Scanning for lot numbers...")
coords = {}

# Get all words on the page
words = page.get_text("words") # (x0, y0, x1, y1, "word", block_no, line_no, word_no)

for w in words:
    text = w[4]
    # Check if word is a number (up to 4 digits)
    if re.match(r'^\d{1,4}$', text):
        num = int(text)
        if num not in coords: # Keep the first one found
            coords[num] = {
                "x": (w[0] + w[2]) / 2 / page.rect.width,
                "y": (w[1] + w[3]) / 2 / page.rect.height
            }

with open('map_coords.json', 'w') as f:
    json.dump(coords, f)

print(f"Mapa guardado y {len(coords)} lotes mapeados.")
doc.close()
