import fitz
import os

pdf_path = '../infoextra/EXPOAGRO-2026-Plano-Expositores-2026-01-30-CON-final (1).pdf'
if not os.path.exists(pdf_path):
    pdf_path = 'infoextra/EXPOAGRO-2026-Plano-Expositores-2026-01-30-CON-final (1).pdf'

print(f"Opening {pdf_path}...")
doc = fitz.open(pdf_path)
page = doc[0]

# Check if text exists
text_blocks = page.get_text("blocks")
print(f"Found {len(text_blocks)} text blocks.")
for i, b in enumerate(text_blocks[:20]): # Show first 20
    print(f"Block {i}: {b[4]}")

doc.close()
