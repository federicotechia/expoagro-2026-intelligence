import json

def generate_grid():
    coords = {}
    
    # We use a segmented interpolation because the fair is not a perfectly uniform grid 
    # but has sectors.
    
    # Sectors (Lot Range -> X Range)
    # Based on visual analysis of the map:
    # 0-399: X 0.08 to 0.25
    # 400-699: X 0.25 to 0.48
    # 700-999: X 0.48 to 0.78
    # 1000-1600: X 0.78 to 0.95
    
    # Rows (Last two digits -> Y Range)
    # The map has horizontal lanes. 
    # Let's say:
    # Lots xx0-xx30 -> Y 0.15 to 0.35 (Top half of blocks)
    # Lots xx31-xx60 -> Y 0.35 to 0.55 (Middle-top)
    # Lots xx61-xx99 -> Y 0.55 to 0.75 (Bottom half)
    # Note: This is an approximation. 
    
    for i in range(1, 1601):
        lot = i
        # X Interpolation
        if lot < 400:
            x = 0.08 + (lot / 400) * (0.25 - 0.08)
        elif lot < 700:
            x = 0.25 + ((lot - 400) / 300) * (0.48 - 0.25)
        elif lot < 1000:
            x = 0.48 + ((lot - 700) / 300) * (0.78 - 0.48)
        else:
            x = 0.78 + ((lot - 1000) / 600) * (0.95 - 0.78)
            
        # Y Interpolation (Row logic)
        # Usually row is last digits. But in some maps it's the other way.
        # Based on Agrometal 840 and Erca 740 being together:
        # 840 is likely at Y ~ 0.33. Let's see. 
        # Crucianelli 520 is at Y ~ 0.55.
        
        last_digits = lot % 100
        # If lot is 840, last_digits is 40.
        # If lot is 740, last_digits is 40. -> Same horizontal row!
        # If lot is 520, last_digits is 20. -> Different row!
        
        # So low digits = lower Y (physically higher on map)? 
        # Agrometal (40) is higher (Y=0.33) than Crucianelli (20) which is Y=0.55?
        # Wait, if Y=0 is TOP. Then Y=0.33 is above Y=0.55.
        # So 40 is TOP, 20 is BOTTOM?
        # Let's check Mainero 1020. X=0.85, Y=0.75. 
        # 20 -> 0.75.
        # 40 -> 0.33.
        # So Row Y is roughly: Y = 1.0 - (last_digits / 100) * 0.8 - 0.1?
        # Let's try: last_digits 40 -> Y 0.33. last_digits 20 -> Y 0.75.
        # last_digits 0 -> Y 0.9? last_digits 50 -> Y 0.2?
        
        # Linear: y = m*last_digits + b
        # 0.33 = m*40 + b
        # 0.75 = m*20 + b
    # Coordenadas calibradas visualmente (X, Y porcentual)
    # 0,0 es top-left, 100,100 es bottom-right de la IMAGEN
    overrides = {
        "100": {"x": 0.1211, "y": 0.4318},  # John Deere
        "170": {"x": 0.1187, "y": 0.2582},  # Claas
        "218": {"x": 0.1595, "y": 0.5894},  # Traxor
        "300": {"x": 0.2136, "y": 0.6795},  # Cestari
        "310": {"x": 0.2147, "y": 0.6138},  # Victor Juri
        "400": {"x": 0.2449, "y": 0.6718},  # Jacto
        "P30": {"x": 0.4882, "y": 0.6985},  # New Holland
        "510": {"x": 0.2783, "y": 0.6092},  # Pauny
        "514": {"x": 0.6303, "y": 0.3127},  # IFN Tecno / IFC (Carpa)
        "520": {"x": 0.2847, "y": 0.5528},  # Crucianelli
        "530": {"x": 0.2912, "y": 0.4963},  # Ombú
        "540": {"x": 0.2880, "y": 0.4352},  # Indecar
        "570": {"x": 0.3007, "y": 0.3131},  # Ternium
        "610": {"x": 0.3560, "y": 0.6062},  # Caimán
        "630": {"x": 0.3603, "y": 0.4398},  # Metalfor
        "650": {"x": 0.3571, "y": 0.3696},  # Apache
        "N60": {"x": 0.0626, "y": 0.3696},  # Ascanelli
        "710": {"x": 0.4067, "y": 0.6001},  # Akron
        "720": {"x": 0.4105, "y": 0.5467},  # Tekron
        "740": {"x": 0.4066, "y": 0.4367},  # Erca
        "830": {"x": 0.4456, "y": 0.4871},  # Montenegro
        "840": {"x": 0.4594, "y": 0.4383},  # Agrometal
        "910": {"x": 0.5199, "y": 0.6047},  # Valtra
        "920": {"x": 0.5156, "y": 0.5589},  # Yomel
        "1020": {"x": 0.5738, "y": 0.5528}, # Mainero
        "1030": {"x": 0.5664, "y": 0.4917}, # Piersanti
        "1044": {"x": 0.5858, "y": 0.4276}, # Pierobón
        "1058": {"x": 0.5880, "y": 0.3662}, # Amazone
        "1131": {"x": 0.6472, "y": 0.4902}, # Syra
        "1214": {"x": 0.6808, "y": 0.6153}, # Massey Ferguson
        "1220": {"x": 0.1403, "y": 0.1986}, # Pulqui
        "1231": {"x": 0.6982, "y": 0.4848}, # Rossmet
        "1249": {"x": 0.7034, "y": 0.4352}, # Omar Martin
        "1340": {"x": 0.1804, "y": 0.5989}, # BTI
        "1421A": {"x": 0.8318, "y": 0.5562}, # Therra
        "1450": {"x": 0.8089, "y": 0.3986}, # Iveco
        "1468": {"x": 0.7833, "y": 0.3039}, # Tedeschi
        "1470": {"x": 0.7733, "y": 0.3299}, # Credicoop
        "1914": {"x": 0.9520, "y": 0.4011}, # EURO TORQUE - FPT
        "1918": {"x": 0.9753, "y": 0.4077}, # Bernardin
        "C08": {"x": 0.5168, "y": 0.3123},  # Ingersoll Argentina (Carpa)
        "NO5": {"x": 0.1931, "y": 0.7313},  # Case IH
        "P91": {"x": 0.8639, "y": 0.6184},  # Distrimaq
        "1600": {"x": 0.910, "y": 0.340}    # Referencia lateral derecha
    }
    
    # Generar todos los stands
    grid = {}
    
    # Primero cargar todos los overrides (incluye los no numéricos y fuera de rango)
    for k, v in overrides.items():
        grid[k] = v

    # Generar el resto por interpolación
    for i in range(1, 1601):
        s = str(i)
        if s in grid:
            continue
            
        # Lógica de interpolación básica por sector
        # (Se puede refinar más, pero los overrides cubren lo principal)
        if i < 400: # Sector 100-300
            x = 0.16 + (i % 100) * 0.002
            y = 0.34 + (i // 100) * 0.1
        elif i < 700: # Sector 400-600
            x = 0.31 + (i % 100) * 0.002
            y = 0.45 + (i // 100 - 4) * 0.1
        elif i < 1000: # Sector 700-900
            x = 0.44 + (i % 100) * 0.002
            y = 0.41 + (i // 100 - 7) * 0.1
        else: # 1000+
            x = 0.65 + (i % 100) * 0.001
            y = 0.41 + (i // 100 - 10) * 0.05
            
        grid[s] = {"x": round(x, 4), "y": round(y, 4)}
        
    # Guardar
    with open('map_coords.json', 'w') as f:
        json.dump(grid, f, indent=2)
    print(f"✅ Generados {len(grid)} puntos de coordenadas.")

if __name__ == "__main__":
    generate_grid()
