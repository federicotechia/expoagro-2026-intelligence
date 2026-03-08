import fitz
import os
import re

pdf_path = '../infoextra/EXPOAGRO-2026-Plano-Expositores-2026-01-30-CON-final (1).pdf'
if not os.path.exists(pdf_path):
    pdf_path = 'infoextra/EXPOAGRO-2026-Plano-Expositores-2026-01-30-CON-final (1).pdf'

print(f"Opening {pdf_path}...")
doc = fitz.open(pdf_path)
page = doc[0]

# Get all words
words = page.get_text("words")
print(f"Found {len(words)} words.")

# Print some numeric words
num_words = [w[4] for w in words if re.match(r'^\d{1,4}$', w[4])]
print(f"Found {len(num_words)} numeric words.")
print("Sample numeric words:", num_words[:50])

# Try to find specific stand numbers
for target in [520, 840, 710, 650]:
    matches = [w for w in words if w[4] == str(target)]
    if matches:
        print(f"Found {target} at {matches[0][:4]}")
    else:
        print(f"NOT Found {target}")

doc.close()
