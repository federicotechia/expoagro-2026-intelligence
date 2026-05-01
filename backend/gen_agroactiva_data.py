import fitz
import json
import os

pdf_path = 'infoextra/Agroactiva-2026-PLANO-ABRIL.pdf'
doc = fitz.open(pdf_path)
page = doc[0]

# 1. Renderizar el PDF a una imagen de alta resolución para el mapa
# Usamos un zoom de 3 para que se vea bien (aprox 2100x3000px o similar)
zoom = 3
mat = fitz.Matrix(zoom, zoom)
pix = page.get_pixmap(matrix=mat)
img_path = 'backend/mapa_agroactiva.jpg'
pix.save(img_path)
print(f"Imagen del mapa guardada en {img_path}")

# 2. Extraer texto y coordenadas
text_instances = page.get_text("dict")["blocks"]
map_data = {} # Marca -> {x, y, stand}
all_spans = []

# Guardar dimensiones de la página para normalizar
p_width = page.rect.width
p_height = page.rect.height

for block in text_instances:
    if "lines" in block:
        for line in block["lines"]:
            for span in line["spans"]:
                text = span["text"].strip()
                if not text: continue
                
                # Normalizar coordenadas
                bbox = span["bbox"]
                center_x = (bbox[0] + bbox[2]) / 2 / p_width
                center_y = (bbox[1] + bbox[3]) / 2 / p_height
                
                all_spans.append({
                    "text": text,
                    "x": center_x,
                    "y": center_y,
                    "size": span["size"]
                })

# Guardar todo el texto extraído para depuración
with open('backend/agroactiva_raw_text.json', 'w', encoding='utf-8') as f:
    json.dump(all_spans, f, ensure_ascii=False, indent=2)

# Intentar identificar marcas (texto con tamaño > 6 o que no sea solo números)
# Y números de stand (texto corto numérico)
# Por ahora, simplemente mapearemos TODO el texto que parezca marca.
# El sistema actual usa Stand ID como clave en map_coords.json y Marca -> Stand ID en ubicaciones.json
# Para Agroactiva, simplificaremos: Marca -> {x, y} directamente si es posible.

processed_coords = {}
for s in all_spans:
    txt = s["text"]
    # Ignorar textos muy genéricos o pequeños
    if len(txt) < 2 or txt in ["Calle", "Stands", "m2", "G", "A", "B", "C", "D"]:
        continue
    
    # Si es un número, lo guardamos como stand_ID
    # Si es texto, lo guardamos como marca
    # Para el mapa interactivo, queremos que al buscar "Crucianelli" se centre.
    # Así que usaremos el texto como clave.
    processed_coords[txt.upper()] = {
        "x": s["x"],
        "y": s["y"]
    }

with open('backend/agroactiva_coords.json', 'w', encoding='utf-8') as f:
    json.dump(processed_coords, f, ensure_ascii=False, indent=2)

print(f"Procesadas {len(processed_coords)} entradas de texto para Agroactiva.")
doc.close()
