import json
import re
import os

def normalize_text(text):
    if not text: return ""
    import unicodedata
    text = "".join(
        c for c in unicodedata.normalize('NFD', text)
        if unicodedata.category(c) != 'Mn'
    )
    return text.upper().strip()

def clean_brand(name):
    # Ya lo tenemos en build_ubicaciones.py, trataremos de usar algo similar
    core = name.upper()
    core = core.rstrip('.')
    core = re.sub(r'\s+(S\.A\.|SRL|S\.R\.L\.|S\.A\.I\.|S\.A\.|S\.A\.C\.|SA|SOCIEDAD ANONIMA|S\.R\.L)\s*$', '', core, flags=re.IGNORECASE)
    prefixes = ['INDUSTRIAS', 'MAQUINAS AGRICOLAS', 'MAQUINARIA', 'AGRO', 'METALURGICA', 'IMPLEMENTOS']
    for p in prefixes:
        if core.startswith(p + ' '):
            core = core[len(p)+1:].strip()
            break
    ind_suffixes = ['MAQUINARIAS', 'MAQUINARIA', 'IMPLEMENTOS AGRICOLAS', 'IMPLEMENTOS', 'MAQUINAS AGRICOLAS', 'MAQUINARIA AGRICOLA', 'METALURGICA', 'IMPLEMENTOS AGRIC.' , 'ARGENTINA', 'SAU']
    for s in ind_suffixes:
        if core.endswith(' ' + s):
            core = core[:-len(s)-1].strip()
    return core.strip()

txt_path = 'expositores.txt'
data = {}

if os.path.exists(txt_path):
    with open(txt_path, 'r', encoding='utf-8') as f:
        lines = [l.strip() for l in f.readlines() if l.strip()]
    
    current_brand = None
    for i in range(len(lines)):
        line = lines[i]
        
        # Un posible nombre de marca suele ser una linea corta seguida de una linea que dice LOTE AIRE LIBRE o similar
        if i + 1 < len(lines) and ("LOTE AIRE LIBRE" in lines[i+1].upper() or "LOTE AL AIRE LIBRE" in lines[i+1].upper() or "CARPA" in lines[i+1].upper() or "ESPACIO" in lines[i+1].upper() or "SECTOR" in lines[i+1].upper()):
            current_brand = line
            location = lines[i+1]
            
            # Buscar el rubro en las proximas lineas
            rubro = "Varios"
            for j in range(i+2, min(i+10, len(lines))):
                if "Rubros:" in lines[j] or "Rubro:" in lines[j]:
                    rubro = lines[j].replace("Rubros:", "").replace("Rubro:", "").strip()
                    break
            
            core = clean_brand(current_brand)
            norm_core = normalize_text(core)
            if norm_core not in data:
                data[norm_core] = {
                    "display": current_brand,
                    "ubicacion": location,
                    "rubros": rubro
                }

# Cargar el JSON actual y mezclar
json_path = 'ubicaciones.json'
if os.path.exists(json_path):
    with open(json_path, 'r', encoding='utf-8') as f:
        current_data = json.load(f)
    
    # Prioridad: CSV (current_data) que es mas limpio, pero si falta, usar el del TXT
    for k, v in data.items():
        if k not in current_data:
            current_data[k] = v
            print(f"Adding from PDF TXT: {k}")
        elif "TBD" in current_data[k]['ubicacion'] and "TBD" not in v['ubicacion']:
            current_data[k]['ubicacion'] = v['ubicacion']
            print(f"Updating stand from PDF TXT for: {k}")

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(current_data, f, ensure_ascii=False, indent=2)

print(f"✅ Inteligencia mezclada con PDF text. Marcas totales: {len(current_data)}")
