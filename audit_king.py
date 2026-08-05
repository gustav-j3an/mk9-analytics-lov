import os
import requests
import json

API_URL = "https://yajjqiyjwyetiuakzokf.supabase.co/rest/v1"
API_KEY = "sb_publishable_15uFDursSffq9ULOc8sUvw_IGQNPmgO"

def query(table, select="*", filter=""):
    url = f"{API_URL}/{table}?select={select}{filter}"
    headers = {
        "apikey": API_KEY,
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    r = requests.get(url, headers=headers)
    return r.json()

# 1. KING
industries = query("mk9_industries", "id,name", "&name=ilike.*KING*")
if not industries:
    print("KING not found")
    exit(1)
king_id = industries[0]['id']

# 2. Last Import
imports = query("mk9_checklist_imports", "*", f"&industry_id=eq.{king_id}&order=started_at.desc&limit=1")
if not imports:
    print("No imports")
    exit(1)
last_imp = imports[0]

# 3. Visits
visits = query("mk9_actual_visits", "count", f"&source_import_id=eq.{last_imp['id']}")

# 4. Recon
recon = query("mk9_visit_reconciliations", "count", f"&source_import_id=eq.{last_imp['id']}")

# 5. Operational Current
current = query("mk9_checklist_imports", "id,status,is_operational_current", f"&industry_id=eq.{king_id}&is_operational_current=eq.true")

print(json.dumps({
    "lastImport": last_imp,
    "visits": visits,
    "recon": recon,
    "current": current
}, indent=2))
