import fitz
import os

pdf_path = '../infoextra/EXPOAGRO-2026-Plano-Expositores-2026-01-30-CON-final (1).pdf'
if not os.path.exists(pdf_path):
    pdf_path = 'infoextra/EXPOAGRO-2026-Plano-Expositores-2026-01-30-CON-final (1).pdf'

doc = fitz.open(pdf_path)
print(f"Total pages: {len(doc)}")
for i, page in enumerate(doc):
    words = page.get_text("words")
    print(f"Page {i}: {len(words)} words.")
    if len(words) > 0:
        for w in words[:10]:
            print(f"  {w[4]}")
doc.close()
