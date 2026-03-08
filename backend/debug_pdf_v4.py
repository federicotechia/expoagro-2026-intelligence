import fitz
import os

pdf_path = '../infoextra/EXPOAGRO-2026-Plano-Expositores-2026-01-30-CON-final (1).pdf'
if not os.path.exists(pdf_path):
    pdf_path = 'infoextra/EXPOAGRO-2026-Plano-Expositores-2026-01-30-CON-final (1).pdf'

print(f"Opening {pdf_path}...")
doc = fitz.open(pdf_path)
print(f"Pages: {len(doc)}")
page = doc[0]
print(f"Page size: {page.rect.width}x{page.rect.height}")

# Get all text as a dict to see block structure
text_dict = page.get_text("dict")
print(f"Blocks found: {len(text_dict['blocks'])}")

# Analyze some blocks that might contain numbers
for b in text_dict['blocks']:
    if 'lines' in b:
        for l in b['lines']:
            for s in l['spans']:
                txt = s['text'].strip()
                if txt:
                    # Print everything to see what's hidden
                    # Printing all might be too much, let's filter for brands/numbers
                    if len(txt) < 30: 
                        print(f"Text: '{txt}' at {s['bbox']}")

doc.close()
