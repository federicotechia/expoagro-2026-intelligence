import json
import re

with open('expositores.txt', 'r', encoding='utf-8') as f:
    lines = [line.strip() for line in f.readlines() if line.strip()]

expositores = {}
current_empresa = None

for i, line in enumerate(lines):
    # Detectamos ubicaciones como "LOTE AIRE LIBRE - M14", "STAND CUBIERTO CARPA 1 - B08", "ESPACIO PERSONAL AGTECH - AG20", "PLOT - N45"
    if re.search(r'(LOTE |STAND |ESPACIO |PLOT |SECTOR )', line, re.IGNORECASE):
        # La linea anterior es probablemente el nombre de la empresa
        if i > 0:
            nombre = lines[i-1]
            ubicacion = line
            # Evitar agarrar encabezados
            if nombre not in ["EXPOSITORES POR ORDEN ALFABÉTICO", "EXPOSITORES POR ORDEN ALFABÉTICO", "EXHIBITORS BY ALPHABETICAL ORDER"]:
                expositores[nombre] = ubicacion

with open('ubicaciones.json', 'w', encoding='utf-8') as f:
    json.dump(expositores, f, ensure_ascii=False, indent=2)

print(f"Extraidos {len(expositores)} expositores")
