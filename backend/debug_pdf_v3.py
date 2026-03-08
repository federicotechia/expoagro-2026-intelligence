import fitz
import os
import re

pdf_path = '../infoextra/EXPOAGRO-2026-Plano-Expositores-2026-01-30-CON-final (1).pdf'
if not os.path.exists(pdf_path):
    pdf_path = 'infoextra/EXPOAGRO-2026-Plano-Expositores-2026-01-30-CON-final (1).pdf'

print(f"Opening {pdf_path}...")
doc = fitz.open(pdf_path)
page = doc[0]

test_brands = ["CRUCIANELLI", "AGROMETAL", "APACHE", "OMBU", "AKRON"]
for b in test_brands:
    rects = page.search_for(b)
    if rects:
        print(f"Found {b} at {rects[0]}")
    else:
        print(f"NOT Found {b}")

doc.close()
