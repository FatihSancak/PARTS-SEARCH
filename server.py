import os
import sys
import json
import re
import subprocess
import collections
from urllib.parse import urlparse, parse_qs
from http.server import SimpleHTTPRequestHandler, HTTPServer

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

def get_stems(table_name):
    name = table_name.lower()
    stems = {name}
    if name.endswith('en'):
        stems.add(name[:-2])
    if name.endswith('n'):
        stems.add(name[:-1])
    if name.endswith('e'):
        stems.add(name[:-1])
    if name.endswith('er'):
        stems.add(name[:-2])
    
    if 'gebrauchtteile' in name:
        stems.update(['gebrauchtteile', 'gebrauchtteil', 'teil', 'teile', 'gt'])
    if 'fahrzeughandel' in name or 'fahrzeug' in name:
        stems.update(['fahrzeug', 'fh'])
    if 'kunden' in name:
        stems.update(['kunde', 'kunden'])
    if 'lieferanten' in name:
        stems.update(['lieferant', 'lieferanten'])
    if 'personal' in name:
        stems.update(['personal', 'mitarbeiter', 'pers'])
    if 'auftrag' in name:
        stems.update(['auftrag', 'auftrags'])
    if 'rechnung' in name:
        stems.update(['rechnung', 'rechnungs'])
    
    return stems

def get_category(table_name):
    t = table_name.lower()
    if any(x in t for x in ['fahrzeug', 'fh_', 'kfz', 'demontage']):
        return 'Vehicles'
    if any(x in t for x in ['gebrauchtteile', 'teile', 'gt_']):
        return 'Parts'
    if any(x in t for x in ['reifen']):
        return 'Tires'
    if any(x in t for x in ['kunden', 'kundenart', 'lieferanten']):
        return 'Customers & Suppliers'
    if any(x in t for x in ['auftrag', 'rechnung', 'kassenbuch', 'kassenstand', 'zahlung', 'beleg', 'leistung']):
        return 'Invoices & Orders'
    if any(x in t for x in ['personal', 'user', 'mitarbeiter', 'login', 'berechtigungen', 'ausweis']):
        return 'Staff & Permissions'
    if any(x in t for x in ['settings', 'update', 'log_', 'protokoll', 'tse_', 'tabelle', 'schnittstellen']):
        return 'System & Logs'
    return 'Others'

def build_schema_in_memory():
    # 1. Fetch raw schema from SQL Server
    sql_query = (
        "SELECT t.name AS TableName, c.name AS ColumnName, ty.name AS DataType, "
        "c.max_length AS MaxLength, c.is_nullable AS IsNullable, "
        "ISNULL(i.is_primary_key, 0) AS IsPrimaryKey "
        "FROM sys.tables t "
        "INNER JOIN sys.columns c ON t.object_id = c.object_id "
        "INNER JOIN sys.types ty ON c.user_type_id = ty.user_type_id "
        "LEFT JOIN sys.index_columns ic ON ic.object_id = c.object_id AND ic.column_id = c.column_id "
        "LEFT JOIN sys.indexes i ON i.object_id = ic.object_id AND i.index_id = ic.index_id AND i.is_primary_key = 1 "
        "ORDER BY TableName, ColumnName "
        "FOR JSON PATH"
    )

    cmd = [
        "sqlcmd",
        "-S", ".\\SQLEXPRESS",
        "-E",
        "-d", "BaytemurII",
        "-y", "0",
        "-w", "65535",
        "-Q", sql_query
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, check=True, encoding='latin1')
    lines = result.stdout.splitlines()
    json_lines = []
    capture = False
    for line in lines:
        cleaned = line.strip()
        if not cleaned:
            continue
        if cleaned.startswith('[{"') or cleaned.startswith('[{ "') or cleaned.startswith('['):
            capture = True
        if capture:
            json_lines.append(cleaned)
        if cleaned.endswith('}]') or cleaned.endswith('} ]') or cleaned.endswith(']'):
            capture = False
    json_str = "".join(json_lines).strip()
    
    if not json_str:
        return {'tables': {}, 'relationships': []}

    raw_data = json.loads(json_str)

    # 2. Group columns under their tables
    tables = collections.defaultdict(list)
    pks = collections.defaultdict(set)
    for row in raw_data:
        t_name = row['TableName']
        col_info = {
            'name': row['ColumnName'],
            'type': row['DataType'],
            'max_len': row['MaxLength'],
            'nullable': row['IsNullable'],
            'pk': row['IsPrimaryKey']
        }
        tables[t_name].append(col_info)
        if row['IsPrimaryKey']:
            pks[t_name].add(row['ColumnName'].lower())

    # 3. Match relationships in memory
    key_suffixes = ['id', 'nummer', 'nr', 'code', 'key']
    generic_columns = {
        'id', 'status', 'name', 'datum', 'bemerkung', 'text', 'beschreibung', 'info', 'art', 'typ',
        'erstellt_am', 'erstelltam', 'geaendert_am', 'geaendertam', 'benutzer', 'user_id', 'userid',
        'aktiv', 'gesperrt', 'loeschdatum', 'bild', 'bilder', 'kommentar', 'preis', 'wert', 'farbe',
        'groesse', 'gewicht', 'laenge', 'breite', 'hoehe', 'anzahl', 'menge', 'code', 'nr', 'nummer'
    }

    flat_columns = []
    for t_name, cols in tables.items():
        for c in cols:
            flat_columns.append({'table': t_name, **c})

    col_to_tables = collections.defaultdict(list)
    for col in flat_columns:
        col_to_tables[col['name'].lower()].append(col)

    def are_types_compatible(t1, t2):
        numeric = {'int', 'bigint', 'smallint', 'tinyint', 'decimal', 'numeric', 'float', 'real', 'money', 'smallmoney'}
        strings = {'varchar', 'nvarchar', 'char', 'nchar', 'text', 'ntext'}
        if t1 in numeric and t2 in numeric:
            return True
        if t1 in strings and t2 in strings:
            return True
        if t1 == t2:
            return True
        return False

    relationships = []

    # Match by Exact Name
    for col_lower, cols in col_to_tables.items():
        if len(cols) < 2 or col_lower in generic_columns:
            continue
        is_key = any(col_lower.endswith(s) for s in key_suffixes)
        if not is_key:
            continue

        for i in range(len(cols)):
            for j in range(i + 1, len(cols)):
                c1, c2 = cols[i], cols[j]
                if c1['table'] == c2['table'] or not are_types_compatible(c1['type'], c2['type']):
                    continue
                
                c1_is_pk = c1['name'].lower() in pks[c1['table']]
                c2_is_pk = c2['name'].lower() in pks[c2['table']]

                if c1_is_pk and not c2_is_pk:
                    from_table, to_table = c2['table'], c1['table']
                    from_col, to_col = c2['name'], c1['name']
                elif c2_is_pk and not c1_is_pk:
                    from_table, to_table = c1['table'], c2['table']
                    from_col, to_col = c1['name'], c2['name']
                else:
                    from_table, to_table = c1['table'], c2['table']
                    from_col, to_col = c1['name'], c2['name']

                relationships.append({
                    'from_table': from_table,
                    'to_table': to_table,
                    'from_col': from_col,
                    'to_col': to_col,
                    'type': c1['type'],
                    'match_type': 'Exact Column Name Match',
                    'strength': 3 + (1 if (c1_is_pk or c2_is_pk) else 0)
                })

    # Match by Table Stems
    for table_name, cols in tables.items():
        stems = get_stems(table_name)
        for other_table, other_cols in tables.items():
            if table_name == other_table:
                continue
            for col in other_cols:
                col_name_lower = col['name'].lower()
                if len(col_name_lower) < 3 or col_name_lower in generic_columns:
                    continue

                matched_stem = None
                for stem in stems:
                    pattern = rf"(^|_)({stem})(_)?(id|nummer|nr|code|key|num)?$"
                    if re.search(pattern, col_name_lower) or col_name_lower == stem:
                        matched_stem = stem
                        break
                    for sfx in key_suffixes:
                        if col_name_lower == f"{stem}{sfx}":
                            matched_stem = stem
                            break
                
                if matched_stem:
                    t_pks = pks[table_name]
                    target_pk = 'ID'
                    if 'id' not in t_pks and t_pks:
                        target_pk = sorted(list(t_pks))[0]

                    exists = False
                    for r in relationships:
                        if ((r['from_table'] == other_table and r['to_table'] == table_name) or
                            (r['from_table'] == table_name and r['to_table'] == other_table)) and \
                           r['from_col'].lower() == col['name'].lower():
                            exists = True
                            break
                    
                    if not exists:
                        relationships.append({
                            'from_table': other_table,
                            'to_table': table_name,
                            'from_col': col['name'],
                            'to_col': target_pk,
                            'type': col['type'],
                            'match_type': f'Table Stem Match ({matched_stem})',
                            'strength': 2
                        })

    # 4. Form final schema structure
    schema_data = {
        'tables': {},
        'relationships': relationships
    }

    for t_name, cols in tables.items():
        schema_data['tables'][t_name] = {
            'name': t_name,
            'category': get_category(t_name),
            'columns': cols,
            'pks': list(pks[t_name])
        }

    return schema_data

class VisualizerHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        parsed_url = urlparse(self.path)
        
        # 1. API Endpoint for Real-time Schema & Relationships
        if parsed_url.path == '/api/schema':
            try:
                schema_data = build_schema_in_memory()
                self.send_response(200)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps(schema_data, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Failed to build schema in memory', 'details': str(e)}).encode('utf-8'))
            return
        
        # 2. API Endpoint for Articles List (top 50)
        if parsed_url.path == '/api/articles':
            sql_query = (
                "SELECT TOP 50 g.Artikelnummer, g.Bezeichnung, g.Marke, g.Modellcode, g.Typ, "
                "g.Verkaufspreis, g.Lagerort "
                "FROM dbo.Gebrauchtteile g "
                "ORDER BY g.Artikelnummer DESC "
                "FOR JSON PATH"
            )
            cmd = [
                "sqlcmd",
                "-S", ".\\SQLEXPRESS",
                "-E",
                "-d", "BaytemurII",
                "-y", "0",
                "-w", "65535",
                "-Q", sql_query
            ]
            try:
                result = subprocess.run(cmd, capture_output=True, text=True, check=True, encoding='latin1')
                lines = result.stdout.splitlines()
                json_lines = []
                capture = False
                for line in lines:
                    cleaned = line.strip()
                    if not cleaned:
                        continue
                    if cleaned.startswith('[{"') or cleaned.startswith('[{ "') or cleaned.startswith('['):
                        capture = True
                    if capture:
                        json_lines.append(cleaned)
                    if cleaned.endswith('}]') or cleaned.endswith('} ]') or cleaned.endswith(']'):
                        capture = False
                json_str = "".join(json_lines).strip()
                if not json_str:
                    json_str = "[]"
                self.send_response(200)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json_str.encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Failed to query database', 'details': str(e)}).encode('utf-8'))
            return

        # 3. API Endpoint for Article Query
        if parsed_url.path == '/api/article':
            query_params = parse_qs(parsed_url.query)
            article_number = query_params.get('number', [''])[0].strip()

            if not article_number or not re.match(r'^[a-zA-Z0-9\-_]+$', article_number):
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Invalid or missing article number'}).encode('utf-8'))
                return

            sql_query = (
                f"SELECT g.Artikelnummer, g.Bezeichnung, g.Marke, g.Modellcode, g.Typ, "
                f"g.Verkaufspreis, g.Zustand, f.Fahrgestellnummer AS VIN, "
                f"f.Fahrzeug_Nummer AS FahrzeugNummer, f.Marke AS FahrzeugMarke, "
                f"f.Modell AS FahrzeugModell, f.kmStand "
                f"FROM dbo.Gebrauchtteile g "
                f"LEFT JOIN dbo.Fahrzeughandel f ON f.Fahrzeug_Nummer = g.FahrzeugNummer "
                f"WHERE g.Artikelnummer = '{article_number}' "
                f"FOR JSON PATH"
            )

            cmd = [
                "sqlcmd",
                "-S", ".\\SQLEXPRESS",
                "-E",
                "-d", "BaytemurII",
                "-y", "0",
                "-w", "65535",
                "-Q", sql_query
            ]

            try:
                result = subprocess.run(cmd, capture_output=True, text=True, check=True, encoding='latin1')
                lines = result.stdout.splitlines()
                json_lines = []
                capture = False
                for line in lines:
                    cleaned = line.strip()
                    if not cleaned:
                        continue
                    if cleaned.startswith('[{"') or cleaned.startswith('[{ "') or cleaned.startswith('['):
                        capture = True
                    if capture:
                        json_lines.append(cleaned)
                    if cleaned.endswith('}]') or cleaned.endswith('} ]') or cleaned.endswith(']'):
                        capture = False

                json_str = "".join(json_lines).strip()
                
                if not json_str:
                    self.send_response(404)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'error': 'Article not found'}).encode('utf-8'))
                    return

                self.send_response(200)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json_str.encode('utf-8'))

            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Database query failed', 'details': str(e)}).encode('utf-8'))
            return

        super().do_GET()

def run_server():
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, VisualizerHandler)
    print(f"Visualizer Backend running at http://localhost:{PORT}/")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        httpd.server_close()

if __name__ == '__main__':
    run_server()
