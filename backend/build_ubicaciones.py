import json
import csv
import re
import unicodedata

def normalize_text(text):
    if not text: return ""
    # Quitar acentos y pasar a minúsculas
    text = "".join(
        c for c in unicodedata.normalize('NFD', text)
        if unicodedata.category(c) != 'Mn'
    )
    return text.lower().strip()

def extract_core_brand(name):
    core = name.upper()
    # Eliminar puntuación al final
    core = core.rstrip('.')
    # Eliminar sufijos legales comunes
    core = re.sub(r'\s+(S\.A\.|SRL|S\.R\.L\.|S\.A\.I\.|S\.A\.|S\.A\.C\.|SA|SOCIEDAD ANONIMA|S\.R\.L)\s*$', '', core, flags=re.IGNORECASE)
    core = core.rstrip('.')
    
    # Prefijos comunes a ignorar
    prefixes = ['INDUSTRIAS', 'MAQUINAS AGRICOLAS', 'MAQUINARIA', 'AGRO', 'METALURGICA', 'IMPLEMENTOS']
    for p in prefixes:
        if core.startswith(p + ' '):
            core = core[len(p)+1:].strip()
            break
            
    # Casos muy específicos de limpieza
    core = re.sub(r'\s+S\.A$', '', core)
    
    # Limpiar asteriscos y basura
    core = re.sub(r'[*]+', '', core)
    return core.strip()

csv_path = r'c:\Users\ftrillini\IA CRUCIANELLI\expoagro 2026\infoextra\Listado Completo de Expositores Expoagro - Hoja 2.csv'
json_path = r'c:\Users\ftrillini\IA CRUCIANELLI\expoagro 2026\backend\ubicaciones.json'

expositores = {}

with open(csv_path, mode='r', encoding='utf-8') as f:
    next(f)
    reader = csv.DictReader(f)
    for row in reader:
        raw_name = row.get('Empresa') or row.get('\ufeffEmpresa')
        if not raw_name: continue
        
        display_name = raw_name.strip()
        core_name = extract_core_brand(display_name)
        
        # Guardamos con la clave CORE para facilitar el match
        expositores[core_name] = {
            "display": display_name,
            "ubicacion": row.get('Ubicación', 'TBD').strip(),
            "rubros": row.get('Rubro(s)', 'Varios').strip()
        }

# Forzar algunas marcas importantes con nombres cortos si no quedaron bien
manual_fixes = {
    "APACHE": "Apache S.A",
    "FENDT": "Fendt",
    "MONTECOR": "Industrias Montecor",
    "PIEROBON": "Pierobon S.A.",
    "CASE IH": "Case IH",
    "NEW HOLLAND": "New Holland",
    "JOHN DEERE": "John Deere",
    "BERNARDIN": "Bernardin",
    "SYRA": "Syra",
    "AMAZONE": "Amazone",
    "ASCANELLI": "Ascanelli S.A.",
    "THERRA": "Therra"
}

for core, display in manual_fixes.items():
    if core not in expositores:
        expositores[core] = {"display": display, "ubicacion": "TBD", "rubros": "Varios"}

with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(expositores, f, ensure_ascii=False, indent=2)

print(f"✅ Inteligencia CORE actualizada: {len(expositores)} marcas base mapeadas.")
