
import json
import math

def distance(p1, p2):
    return math.sqrt((p1['x'] - p2['x'])**2 + (p1['y'] - p2['y'])**2)

with open('c:/Users/ftrillini/IA CRUCIANELLI/expoagro 2026/backend/agroactiva_coords.json', 'r', encoding='utf-8') as f:
    coords = json.load(f)

# Separar marcas (texto largo) de lotes (números)
marcas = {}
lotes = {}

for k, v in coords.items():
    if k.isdigit():
        lotes[k] = v
    else:
        marcas[k] = v

mapping = {}
for m, pos_m in marcas.items():
    best_lote = None
    min_dist = 0.05 # Umbral de cercanía (5% del mapa)
    
    for l, pos_l in lotes.items():
        d = distance(pos_m, pos_l)
        if d < min_dist:
            min_dist = d
            best_lote = l
    
    if best_lote:
        mapping[m] = best_lote
    else:
        mapping[m] = "Detectado" # Al menos sabemos que está en el mapa

with open('c:/Users/ftrillini/IA CRUCIANELLI/expoagro 2026/backend/agroactiva_brands_to_lots.json', 'w', encoding='utf-8') as f:
    json.dump(mapping, f, indent=2, ensure_ascii=False)

print(f"Mapeo generado para {len(mapping)} marcas.")
print(f"Ejemplo Crucianelli: {mapping.get('CRUCIANELLI')}")
