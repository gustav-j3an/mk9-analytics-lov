-- Corrigindo as permissões do storage.objects para o bucket visit-evidence
-- Permitir que promotores façam upload apenas em seu próprio path

-- Primeiro, limpar qualquer política anterior se necessário (opcional, mas bom para garantir)
-- DROP POLICY IF EXISTS "Promoters can upload own evidence" ON storage.objects;

-- Política de INSERT (Upload)
CREATE POLICY "Promoters can upload own evidence"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'visit-evidence' AND
    (storage.foldername(name))[1] = 'promoters' AND
    (storage.foldername(name))[2] = (
        SELECT id::text FROM public.mk9_promoters WHERE user_id = auth.uid()
    )
);

-- Política de SELECT (Download/Read)
-- Promotores podem ler seus próprios arquivos
CREATE POLICY "Promoters can read own evidence photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'visit-evidence' AND
    (storage.foldername(name))[1] = 'promoters' AND
    (storage.foldername(name))[2] = (
        SELECT id::text FROM public.mk9_promoters WHERE user_id = auth.uid()
    )
);

-- Admins podem ler tudo no bucket
CREATE POLICY "Admins can read all evidence photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'visit-evidence' AND
    (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
);

-- DELETE (Cleanup/Substituição)
CREATE POLICY "Promoters can delete own pending evidence photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'visit-evidence' AND
    (storage.foldername(name))[1] = 'promoters' AND
    (storage.foldername(name))[2] = (
        SELECT id::text FROM public.mk9_promoters WHERE user_id = auth.uid()
    )
);
