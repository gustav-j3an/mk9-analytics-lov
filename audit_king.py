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

# 1. All industries
industries = query("mk9_industries", "id,name")
print("Industries found:", industries)

