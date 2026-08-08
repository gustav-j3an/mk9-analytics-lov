import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
import os
import json

SCREENSHOTS = Path("/tmp/browser/king_audit")
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        # Injetar sessão se disponível (embora aqui não precise para localhost sem auth wall, 
        # mas o projeto tem auth, então precisamos do token)
        storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
        session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
        
        await page.goto("http://localhost:8080")
        if storage_key and session_json:
            await page.evaluate(
                f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
            )
        
        # Navegar para o dashboard / indústrias para forçar o carregamento do PDF
        # O PDF geralmente é um link ou abre em nova aba. 
        # Como o objetivo é mostrar os números reais, vamos tirar print da UI que mostra esses números 
        # ou tentar capturar a tela do PDF se for gerado em blob/iframe.
        
        await page.goto("http://localhost:8080/dashboard")
        await page.wait_for_timeout(3000) # espera carregar os dados
        
        # Tirar print do dashboard que deve mostrar 134/496/146
        await page.screenshot(path=str(SCREENSHOTS / "dashboard_metrics.png"))
        print("Dashboard capturado")

        # Tentar ir para o relatório de indústrias
        # Ajustar conforme a rota real do projeto para PDF
        await page.goto("http://localhost:8080/relatorios/industrias")
        await page.wait_for_timeout(3000)
        await page.screenshot(path=str(SCREENSHOTS / "industry_report_ui.png"))
        print("Relatório capturado")

        await browser.close()

asyncio.run(main())
