import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

export const Route = createFileRoute('/api/public/sync/checklists')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // 1. Autenticação M2M
          const authHeader = request.headers.get('Authorization');
          const syncSecret = process.env['MK9_SYNC_SECRET'];
          
          if (!syncSecret || !authHeader?.startsWith('Bearer ')) {
            console.error('[SYNC] Falha de autenticação: Segredo não configurado ou header inválido.');
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
          }
          
          const providedToken = authHeader.substring(7);
          if (providedToken !== syncSecret) {
            console.error('[SYNC] Falha de autenticação: Token incorreto.');
            return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
          }

          // 2. Parse Multipart
          const formData = await request.formData();
          const file = formData.get('file') as File;
          const externalFileId = formData.get('externalFileId') as string;
          const fileName = formData.get('fileName') as string;
          const fileHash = formData.get('fileHash') as string;
          const modifiedTime = formData.get('modifiedTime') as string;

          if (!file || !externalFileId) {
            return new Response(JSON.stringify({ error: 'Missing file or externalFileId' }), { status: 400 });
          }

          console.log(`[SYNC] Recebido: ${fileName} (${externalFileId})`);

          // 3. Verificar Duplicidade
          const { data: existing } = await supabaseAdmin
            .from('mk9_checklist_sync_files' as any)
            .select('id, status, file_hash')
            .eq('external_file_id', externalFileId)
            .maybeSingle();

          if (existing && existing.file_hash === fileHash && (existing.status === 'IMPORTED' || existing.status === 'SKIPPED_UNCHANGED')) {
            return new Response(JSON.stringify({ status: 'SKIPPED_UNCHANGED', message: 'File already imported' }), { status: 200 });
          }

          // 4. Registrar Entrada
          const { data: syncEntry, error: syncError } = await supabaseAdmin
            .from('mk9_checklist_sync_files' as any)
            .insert({
              external_file_id: externalFileId,
              file_name: fileName,
              file_hash: fileHash,
              status: 'PROCESSING',
              provider: 'google_drive',
              provider_modified_at: modifiedTime,
              processing_started_at: new Date().toISOString()
            } as any)
            .select()
            .single();

          if (syncError) throw syncError;

          // 5. Executar Motor de Sincronização
          const { runChecklistSync } = await import('@/lib/mk9-sync-engine.server');
          
          const result = await runChecklistSync({
            syncId: (syncEntry as any).id,
            buffer: await file.arrayBuffer(),
            filename: fileName,
            externalFileId,
            expectedMonth: formData.get('expectedMonth') ? parseInt(formData.get('expectedMonth') as string) : undefined,
            expectedYear: formData.get('expectedYear') ? parseInt(formData.get('expectedYear') as string) : undefined,
          });

          return new Response(JSON.stringify({ 
            success: true, 
            syncId: (syncEntry as any).id,
            status: result.status 
          }), { status: result.status === 'FAILED' ? 500 : 200 });

        } catch (error: any) {
          console.error('[SYNC ERROR]', error);
          return new Response(JSON.stringify({ error: 'Internal Server Error', detail: error.message }), { status: 500 });
        }
      }
    }
  }
});
