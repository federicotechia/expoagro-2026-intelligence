import json
import re

def clean_brand(brand):
    # Eliminar S.A., SRL, S.A.I., etc.
    brand = re.sub(r'\s+(S\.A\.|SRL|S\.R\.L\.|S\.A\.I\.|S\.A\.|S\.A\.C\.|SA|SOCIEDAD ANONIMA)\s*$', '', brand, flags=re.IGNORECASE)
    brand = brand.strip().rstrip('.')
    # Eliminar números de página que se colaron
    brand = re.sub(r'^\d+\s+', '', brand)
    return brand

with open('expositores.txt', 'r', encoding='utf-8') as f:
    text = f.read()

lines = [l.strip() for l in text.split('\n')]
expositores = {}

location_pattern = r'(LOTE|STAND|ESPACIO|PLOT|SECTOR|ENTIDAD)'

current_brand_lines = []
for i, line in enumerate(lines):
    if not line:
        current_brand_lines = []
        continue
        
    if re.search(location_pattern, line, re.IGNORECASE):
        # La marca son las lineas acumuladas arriba
        brand_raw = " ".join(current_brand_lines).strip()
        # Limpieza de basura común en el PDF
        brand_raw = re.sub(r'(EXPOSITORES|EXHIBITORS|WWW\.EXPOAGRO).*', '', brand_raw, flags=re.IGNORECASE).strip()
        
        brand_name = clean_brand(brand_raw)
        if brand_name and len(brand_name) > 2:
            # Buscar rubros en las siguientes 5 lineas
            rubro = "Varios"
            for j in range(i+1, min(i+10, len(lines))):
                if "Rubros:" in lines[j]:
                    rubro = lines[j].replace("Rubros:", "").strip()
                    break
                if re.search(location_pattern, lines[j], re.IGNORECASE):
                    break # Pasamos a otra empresa
            
            expositores[brand_name] = {
                "ubicacion": line.strip(),
                "rubros": rubro
            }
        current_brand_lines = []
    else:
        # Acumulamos lineas que podrian ser el nombre
        if not line.isdigit() and len(line) > 1:
            current_brand_lines.append(line)

with open('ubicaciones.json', 'w', encoding='utf-8') as f:
    json.dump(expositores, f, ensure_ascii=False, indent=2)

print(f"✅ Inteligencia reconstruida: {len(expositores)} empresas mapeadas.")
