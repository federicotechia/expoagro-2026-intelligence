import json
import csv
import re
import unicodedata
import os

def normalize_text(text):
    if not text: return ""
    text = "".join(
        c for c in unicodedata.normalize('NFD', text)
        if unicodedata.category(c) != 'Mn'
    )
    text = re.sub(r'[^A-Z0-9 ]', ' ', text.upper())
    return " ".join(text.split()).strip()

final_data = {}

def add_to_final(brand_key, display, location, rubros):
    key = normalize_text(brand_key)
    if not key: return
    
    # Priorizar stands con info de lote sobre TBD
    if key in final_data:
        curr_loc = final_data[key].get('ubicacion', 'TBD').upper()
        if "TBD" not in curr_loc and "TBD" in location.upper():
            return
            
    final_data[key] = {
        "display": display,
        "ubicacion": location.strip(),
        "rubros": rubros.strip()
    }

# 1. Cargar datos del CSV
csv_path = r'c:\Users\ftrillini\IA CRUCIANELLI\expoagro 2026\infoextra\Listado Completo de Expositores Expoagro - Hoja 2.csv'
if os.path.exists(csv_path):
    with open(csv_path, mode='r', encoding='utf-8', errors='ignore') as f:
        # Saltar cabeceras
        lines = f.readlines()
        i = 0
        while i < len(lines) and 'Empresa' not in lines[i]: i += 1
        f.seek(0)
        for _ in range(i): next(f)
        reader = csv.DictReader(f)
        for row in reader:
            emp = row.get('Empresa') or row.get('\ufeffEmpresa')
            if not emp: continue
            add_to_final(emp, emp, row.get('Ubicación', 'TBD'), row.get('Rubro(s)', 'Varios'))

# 3. Mapeos manuales (SOBRE EL FINAL para que manden)
manual_corrections = {
    "APACHE": ["Apache", "Lote Aire Libre - 650", "Sembradoras"],
    "ERCA": ["Industrias Erca", "Lote Aire Libre - 740", "Sembradoras"],
    "KUHN": ["Kuhn", "Lote Aire Libre - 218", "Maquinaria"],
    "BTI": ["Bti Agri", "Lote Aire Libre - 1340", "Sembradoras"],
    "INDECAR": ["Indecar", "Lote Aire Libre - 540", "Sembradoras"],
    "VAF": ["VAF", "Espacio AgTech - AG21", "Agricultura de Precisión"],
    "PULQUI": ["Pulqui", "Lote Aire Libre - 1220 (Carlos Casares)", "Pulverizadoras"],
    "TT": ["TT Global", "Lote Aire Libre - 951", "Maquinaria"],
    "NEXT": ["Next Siembra", "Hangar AgTech", "AgTech"],
    "TRAXOR": ["Traxor", "Lote Aire Libre - 218", "Tractores"],
    "AMAZONE": ["Amazone (Capei)", "Lote Aire Libre - 1058", "Maquinaria"],
    "ASCANELLI": ["Ascanelli", "Lote Aire Libre - N60", "Tolvas"],
    "SYRA": ["Syra", "Lote Aire Libre - 1131", "Incorporadoras"],
    "PIEROBON": ["Pierobon", "Lote Aire Libre - 1044", "Sembradoras"],
    "PLA": ["Pla by John Deere", "Lote Aire Libre - 130", "Pulverizadoras"],
    "JACTO": ["Jacto", "Lote Aire Libre - 400", "Pulverizadoras"],
    "AKRON": ["Akron", "Lote Aire Libre - 710", "Tolvas"],
    "YOMEL": ["Yomel", "Lote Aire Libre - 920", "Heno y Forraje"],
    "VALTRA": ["Valtra", "Lote Aire Libre - 910", "Tractores"],
    "PAUNY": ["Pauny", "Lote Aire Libre - 510", "Tractores"],
    "MONTENEGRO": ["Montenegro", "Lote Aire Libre - 830", "Rastras"],
    "OMBU": ["Maquinas Ombu", "Lote Aire Libre - 530", "Tolvas"],
    "CASE": ["Case IH", "Lote Aire Libre - NO5", "Tractores"],
    "HOLLAND": ["New Holland", "Lote Aire Libre - P30", "Cosechadoras"],
    "DEERE": ["John Deere", "Lotes 130 a 160", "Maquinaria"],
    "BERNARDIN": ["Bernardin", "Sector Ganadería - 1918", "Maquinaria"],
    "ARG METAL": ["Arg-Metal", "Lote Aire Libre (Varios)", "Tolvas"],
    "PINTURAS": ["MC Pinturas", "Loma Verde, Escobar", "Pinturas"]
}

for mc, info in manual_corrections.items():
    add_to_final(mc, info[0], info[1], info[2])

# Limpiar claves excesivamente largas o raras del CSV que ensucian
cleaned_data = {}
for k, v in final_data.items():
    # Solo tomamos el primer bloque de palabras si es muy largo, para que calce con titulos
    # Pero preferimos la clave original si es manual
    if k in manual_corrections:
        cleaned_data[k] = v
    else:
        # Para el resto, si tiene mas de 3 palabras, truncamos? 
        # No, mejor dejemoslo, pero limpiemos el S A y SRL del final
        name = re.sub(r'\s+(S A|S R L|SRL|SA|S A I C)\s*$', '', k)
        cleaned_data[name] = v

json_path = r'c:\Users\ftrillini\IA CRUCIANELLI\expoagro 2026\backend\ubicaciones.json'
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(cleaned_data, f, ensure_ascii=False, indent=2)

print(f"✅ Inteligencia total final: {len(cleaned_data)} marcas.")
if 'APACHE' in cleaned_data: print("DEBUG: APACHE IS PRESENT")
else: print("DEBUG: APACHE IS MISSING")
