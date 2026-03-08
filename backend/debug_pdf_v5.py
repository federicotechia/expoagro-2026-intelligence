import fitz
import os

pdf_path = '../infoextra/EXPOAGRO-2026-Plano-Expositores-2026-01-30-CON-final (1).pdf'
if not os.path.exists(pdf_path):
    pdf_path = 'infoextra/EXPOAGRO-2026-Plano-Expositores-2026-01-30-CON-final (1).pdf'

print(f"Opening {pdf_path}...")
doc = fitz.open(pdf_path)
page = doc[0]
print(f"Page size: {page.rect.width}x{page.rect.height}")

# Find words again but focusing on the large block of coordinates 
words = page.get_text("words")
print(f"Found {len(words)} words.")

# Collect some words that look like stand numbers or brand names
matches = []
for w in words:
    # (x0, y0, x1, y1, "word", block_no, line_no, word_no)
    txt = w[4].strip()
    if txt in ["ERCA", "AGROMETAL", "CRUCIANELLI", "740", "840", "520"]:
        matches.append(w)

if matches:
    print(f"Found matches: {matches}")
else:
    print("No matches for ERCA, AGROMETAL, 740, 840, 520")

# If no matches, maybe the words are concatenated?
all_text = page.get_text("text")
if "ERCA" in all_text:
    print("ERCA found in raw text stream.")
if "740" in all_text:
    print("740 found in raw text stream.")

doc.close()
