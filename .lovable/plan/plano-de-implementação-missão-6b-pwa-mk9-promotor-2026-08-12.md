# Plano de Implementação — Missão 6B: PWA MK9 Promotor

O objetivo é transformar o Portal do Promotor em um Aplicativo Web Progressivo (PWA) instalável, focado na role `PROMOTOR`.

## User-Facing Changes
- **Instalação no Android**: Ao acessar pelo Chrome, o usuário verá a opção "Instalar App".
- **Ícone na Tela Inicial**: O MK9 terá um ícone dedicado na tela inicial do celular.
- **Experiência "App-Like"**: O portal abrirá em tela cheia (standalone), sem a barra de endereços do navegador.
- **Identidade Preservada**: Cores e ícones seguindo a identidade MK9.

## Technical Details

### 1. Vite PWA Plugin
- Instalar `vite-plugin-pwa`.
- Configurar o plugin no `vite.config.ts`.
- Definir o `manifest` com:
  - `name`: MK9 Promotor
  - `short_name`: MK9
  - `start_url`: /mk9-portal
  - `display`: standalone
  - `theme_color`: #9b87f5 (primary purple atual)
  - `background_color`: #ffffff

### 2. Assets (Ícones)
- Gerar ícones 192x192 e 512x512 a partir do logotipo atual.
- Adicionar ao diretório `public/`.

### 3. Service Worker
- Estratégia `StaleWhileRevalidate` para assets estáticos essenciais.
- Proteção de cache: Garantir que dados sensíveis da API (fotos privadas, URLs assinadas) não sejam cacheados pelo Service Worker.
- Configuração de atualização automática (`registerType: 'autoUpdate'`).

### 4. Integração no Layout
- **`src/routes/__root.tsx`**: Injetar meta tags necessárias (`theme-color`, `apple-mobile-web-app-capable`, etc.).
- **`src/components/mk9-portal-dashboard.tsx`**: Ajustes de `safe-area-inset` via CSS para evitar que botões fiquem sob a barra de navegação do sistema.

### 5. Verificação e Segurança
- Confirmar redirecionamentos de role na PWA.
- Validar acesso à câmera e GPS no modo standalone.

## Plano de Trabalho

1. **Setup de Infraestrutura**:
   - Adicionar `vite-plugin-pwa` ao `vite.config.ts`.
   - Criar `public/manifest.webmanifest`.
2. **Assets e Metadados**:
   - Criar os ícones do app.
   - Atualizar `src/routes/__root.tsx` com as meta tags mobile.
3. **Refinamento Mobile (CSS)**:
   - Adicionar suporte a `env(safe-area-inset-bottom)` no footer do portal.
4. **Build e Teste**:
   - Executar build de produção.
   - Validar manifest via `lighthouse` ou ferramentas de inspeção se possível.
