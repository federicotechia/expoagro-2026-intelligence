import json
import csv
import re
import os

def clean_brand(brand):
    brand = re.sub(r'\s+(S\.A\.|SRL|S\.R\.L\.|S\.A\.I\.|S\.A\.|S\.A\.C\.|SA|SOCIEDAD ANONIMA)\s*$', '', brand, flags=re.IGNORECASE)
    # Algunos nombres traen basura como "**" o "/"
    brand = re.sub(r'[*]+', '', brand)
    brand = brand.strip().rstrip('.')
    return brand

csv_path = r'c:\Users\ftrillini\IA CRUCIANELLI\expoagro 2026\infoextra\Listado Completo de Expositores Expoagro - Hoja 2.csv'
json_path = r'c:\Users\ftrillini\IA CRUCIANELLI\expoagro 2026\backend\ubicaciones.json'

expositores = {}

with open(csv_path, mode='r', encoding='utf-8') as f:
    # Saltar la primera línea (título del reporte)
    next(f)
    reader = csv.DictReader(f)
    for row in reader:
        raw_name = row.get('Empresa') or row.get('\ufeffEmpresa') # Handle BOM
        if not raw_name:
            continue
            
        brand_name = clean_brand(raw_name)
        if brand_name and len(brand_name) > 2:
            expositores[brand_name] = {
                "ubicacion": row.get('Ubicación', 'TBD').strip(),
                "rubros": row.get('Rubro(s)', 'Varios').strip()
            }

# Agregar casos especiales manuales que podrian no estar en el listado exacto pero son importantes
# O variantes de nombres comunes
expositores["Fendt"] = {"ubicacion": "Lote Aire Libre - 910", "rubros": "Tractores, Cosechadoras"}

with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(expositores, f, ensure_ascii=False, indent=2)

print(f"✅ Inteligencia actualizada desde CSV: {len(expositores)} empresas mapeadas.")
