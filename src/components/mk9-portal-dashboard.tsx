import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMk9Session } from "@/lib/mk9-auth/session";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyPromoterRoute, getMyPromoterProfile } from "@/lib/mk9-portal/portal.functions";
import { uploadVisitEvidence } from "@/lib/mk9-portal/evidence.functions";
import imageCompression from 'browser-image-compression';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { 
  ClipboardCheck, 
  MapPin, 
  Calendar, 
  LogOut, 
  User,
  LayoutDashboard,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Camera,
  Image as ImageIcon,
  Loader2,
  CheckCircle,
  XCircle,
  RotateCcw,
  Navigation,
  Check
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeSettings } from "@/lib/mk9-theme/ThemeToggle";
import { cn } from "@/lib/utils";

export function Mk9PortalDashboard() {
  const { session, loading, signOut } = useMk9Session();
  const navigate = useNavigate();
  const getRouteFn = useServerFn(getMyPromoterRoute);
  const getProfileFn = useServerFn(getMyPromoterProfile);
  const [authError, setAuthError] = useState<string | null>(null);
  const [uploadingRouteId, setUploadingRouteId] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState<string | null>(null);
  const [capturedLocation, setCapturedLocation] = useState<{
    lat: number;
    lon: number;
    accuracy: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const uploadEvidenceFn = useServerFn(uploadVisitEvidence);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>, routeId: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!capturedLocation) {
      toast.error("Localização não capturada. Tente novamente.");
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error("Formato de arquivo inválido. Use JPEG, PNG ou WEBP.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Limite de 5MB.");
      return;
    }

    try {
      setUploadingRouteId(routeId);
      
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
      };
      
      const compressedFile = await imageCompression(file, options);
      
      const promoterId = promoterProfile?.id;
      if (!promoterId) throw new Error("ID do promotor não encontrado");

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const fileName = `${crypto.randomUUID()}.jpg`;
      const filePath = `promoters/${promoterId}/${year}/${month}/${fileName}`;

      const { data: storageData, error: storageError } = await supabase.storage
        .from('visit-evidence')
        .upload(filePath, compressedFile);

      if (storageError) throw storageError;

      await uploadEvidenceFn({
        data: {
          plannedRouteId: routeId,
          photoPath: filePath,
          capturedAt: now.toISOString(),
          mimeType: compressedFile.type,
          latitude: capturedLocation.lat,
          longitude: capturedLocation.lon,
          accuracy: capturedLocation.accuracy
        }
      });

      toast.success("Evidência enviada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["mk9-portal-routes"] });
    } catch (err: any) {
      console.error("[UPLOAD] Erro:", err);
      toast.error("Falha ao enviar evidência. Tente novamente.");
    } finally {
      setUploadingRouteId(null);
      setCapturedLocation(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const captureGpsAndTriggerFile = async (routeId: string) => {
    if (!navigator.geolocation) {
      toast.error("Seu navegador não suporta geolocalização.");
      return;
    }

    setGpsLoading(routeId);
    
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCapturedLocation({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        });
        setGpsLoading(null);
        (window as any)._currentRouteId = routeId;
        fileInputRef.current?.click();
      },
      (err) => {
        setGpsLoading(null);
        console.error("[GPS] Erro:", err);
        if (err.code === 1) {
          toast.error("Permissão de localização negada. Precisamos do GPS para validar a visita.");
        } else if (err.code === 3) {
          toast.error("Tempo esgotado ao tentar obter localização.");
        } else {
          toast.error("Falha ao obter localização. Verifique o GPS.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/", replace: true });
  }, [loading, session, navigate]);

  const { data: promoterProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["mk9-portal-profile"],
    queryFn: () => getProfileFn(),
    enabled: !!session,
    retry: false,
    meta: {
      onError: (err: any) => {
        if (err.message === "PROMOTER_NOT_LINKED") {
          setAuthError("Seu acesso ainda não está vinculado a um cadastro de promotor. Entre em contato com seu supervisor.");
        }
      }
    }
  });

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const { data: routes, isLoading: isLoadingRoutes } = useQuery({
    queryKey: ["mk9-portal-routes", month, year],
    queryFn: () => getRouteFn({ data: { month, year } }),
    enabled: !!session && !!promoterProfile,
  });

  const today = now.getDay(); 
  
  // Agrupamento por loja
  const groupedTodayRoutes = useMemo(() => {
    const todayItems = (routes ?? []).filter(r => r.weekday === today);
    const stores: Record<string, { 
      storeName: string, 
      storeChain: string, 
      storeUf: string, 
      items: typeof todayItems 
    }> = {};

    todayItems.forEach(item => {
      const key = item.storeId;
      if (!stores[key]) {
        stores[key] = {
          storeName: item.storeName,
          storeChain: item.storeChain,
          storeUf: item.storeUf,
          items: []
        };
      }
      stores[key].items.push(item);
    });

    return Object.values(stores);
  }, [routes, today]);

  const stats = useMemo(() => {
    const todayItems = (routes ?? []).filter(r => r.weekday === today);
    const completed = todayItems.filter(r => r.evidenceStatus === 'APPROVED' || r.evidenceStatus === 'PENDING').length;
    return {
      total: routes?.length ?? 0,
      today: groupedTodayRoutes.length,
      completed
    };
  }, [routes, today, groupedTodayRoutes]);

  if (loading || isLoadingProfile) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans selection:bg-primary/30 pb-20 pt-[env(safe-area-inset-top)]">
      {/* Header Minimalista (Missão 6A) */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shadow-lg glow-primary">
            <CheckCircle2 className="text-foreground h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-black tracking-tighter text-sm uppercase leading-none">
              MK9 <span className="text-primary">PORTAL</span>
            </span>
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
              Minha Rota
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden xs:flex flex-col items-end">
            <span className="text-[10px] font-black uppercase tracking-tighter max-w-[80px] truncate">
              {promoterProfile?.name || 'Promotor'}
            </span>
          </div>
          <ThemeSettings />
          <Button variant="ghost" size="icon" onClick={() => signOut()} className="text-rose-500 h-9 w-9">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-6 max-w-md mx-auto w-full">
        {authError ? (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-6 text-center space-y-4 mt-8">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
            <h2 className="text-sm font-black uppercase tracking-widest text-destructive">Acesso Pendente</h2>
            <p className="text-xs font-bold text-muted-foreground leading-relaxed">
              {authError}
            </p>
            <Button variant="outline" className="w-full text-[10px] font-black uppercase tracking-widest h-11" onClick={() => signOut()}>
              Sair da conta
            </Button>
          </div>
        ) : (
          <>
            {/* Saudação e Data */}
            <section className="space-y-1">
              <h1 className="text-xl font-black tracking-tight text-foreground uppercase">
                HOJE
              </h1>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                {new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' }).format(now)}
              </p>
            </section>

            {/* Roteiro do Dia Agrupado por Loja (Missão 6A) */}
            <section className="space-y-4">
              {isLoadingRoutes ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : groupedTodayRoutes.length > 0 ? (
                <div className="space-y-4">
                  {groupedTodayRoutes.map((storeGroup) => (
                    <Card key={storeGroup.storeName + storeGroup.storeUf} className="bg-card border-border/50 shadow-sm overflow-hidden">
                      <div className="p-4 bg-muted/30 border-b border-border/50">
                         <div className="flex justify-between items-start">
                           <div className="space-y-0.5">
                             <h3 className="font-black text-sm uppercase leading-tight text-foreground">
                               {storeGroup.storeName}
                             </h3>
                             <p className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 uppercase tracking-tighter">
                               <MapPin className="w-3 h-3 shrink-0" />
                               {storeGroup.storeChain || 'Independente'} • {storeGroup.storeUf}
                             </p>
                           </div>
                         </div>
                      </div>
                      
                      <CardContent className="p-4 space-y-4">
                        {storeGroup.items.map((route) => (
                          <div key={route.id} className="space-y-3">
                            <div className="flex items-center justify-between gap-2">
                               <div className="flex flex-col">
                                 <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Indústria</span>
                                 <span className="text-xs font-bold uppercase">{route.industryName}</span>
                               </div>

                               {route.evidenceStatus === 'APPROVED' ? (
                                 <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[9px] font-black px-2 py-0.5">
                                   ✓ APROVADA
                                 </Badge>
                               ) : route.evidenceStatus === 'PENDING' ? (
                                 <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[9px] font-black px-2 py-0.5">
                                   PENDENTE
                                 </Badge>
                               ) : route.evidenceStatus === 'REJECTED' ? (
                                 <Badge className="bg-rose-500/10 text-rose-500 border-rose-500/20 text-[9px] font-black px-2 py-0.5">
                                   REJEITADA
                                 </Badge>
                               ) : (
                                 <Badge variant="outline" className="text-[9px] font-black px-2 py-0.5 opacity-50">
                                   SEM EVIDÊNCIA
                                 </Badge>
                               )}
                            </div>

                            {/* Detalhes de Rejeição */}
                            {route.evidenceStatus === 'REJECTED' && route.rejectionReason && (
                              <div className="p-2.5 bg-rose-500/5 rounded-lg border border-rose-500/20">
                                <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest mb-1">Motivo da Rejeição</p>
                                <p className="text-[10px] font-medium text-foreground leading-tight italic">
                                  "{route.rejectionReason}"
                                </p>
                              </div>
                            )}

                            {/* Status de GPS simplificado (Missão 6A) */}
                            {route.evidenceStatus && (
                               <div className="flex items-center gap-2 text-[9px] font-bold text-muted-foreground uppercase tracking-widest bg-muted/20 p-2 rounded-lg">
                                  {route.locationStatus === 'MATCH' ? (
                                    <><Check className="w-3 h-3 text-emerald-500" /> Localização compatível</>
                                  ) : route.locationStatus === 'REVIEW' ? (
                                    <><AlertTriangle className="w-3 h-3 text-amber-500" /> Localização requer revisão</>
                                  ) : route.locationStatus === 'OUTSIDE' ? (
                                    <><XCircle className="w-3 h-3 text-rose-500" /> Fora da área da loja</>
                                  ) : (
                                    <><Navigation className="w-3 h-3" /> GPS Indisponível</>
                                  )}
                               </div>
                            )}

                            {/* Ações (Grandes e fáceis de tocar) */}
                            <div className="pt-1">
                              {route.evidenceStatus === 'APPROVED' ? (
                                <div className="w-full h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center gap-2">
                                   <CheckCircle className="w-5 h-5 text-emerald-500" />
                                   <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">VISITA CONCLUÍDA</span>
                                </div>
                              ) : (
                                <Button 
                                  className={cn(
                                    "w-full h-12 rounded-xl font-black text-xs uppercase tracking-[0.1em] shadow-lg",
                                    route.evidenceStatus === 'REJECTED' ? "bg-rose-600 hover:bg-rose-700 shadow-rose-500/20" : "bg-primary hover:bg-primary/90 shadow-primary/20"
                                  )}
                                  disabled={uploadingRouteId === route.id || gpsLoading === route.id}
                                  onClick={() => captureGpsAndTriggerFile(route.id)}
                                >
                                  {uploadingRouteId === route.id ? (
                                    <><Loader2 className="w-5 h-5 animate-spin mr-2" /> ENVIANDO...</>
                                  ) : gpsLoading === route.id ? (
                                    <><Loader2 className="w-5 h-5 animate-spin mr-2" /> VALIDANDO GPS...</>
                                  ) : (
                                    <>
                                      <Camera className="w-5 h-5 mr-2" /> 
                                      {route.evidenceStatus === 'REJECTED' ? 'REENVIAR EVIDÊNCIA' : 'REALIZAR VISITA'}
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                            
                            {/* Separador entre indústrias da mesma loja */}
                            {storeGroup.items.indexOf(route) < storeGroup.items.length - 1 && (
                              <div className="border-t border-border/30 pt-4 mt-4" />
                            )}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="bg-card/20 border border-dashed border-border/50 rounded-xl p-12 text-center flex flex-col items-center gap-4">
                  <Calendar className="w-10 h-10 text-muted-foreground/20" />
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Nenhuma loja programada para hoje
                  </p>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* Footer Nav Minimalista */}
      <nav className="fixed bottom-0 w-full bg-background/80 backdrop-blur-lg border-t border-border px-8 h-18 pb-[env(safe-area-inset-bottom)] flex items-center justify-between z-50">
        <button className="flex flex-col items-center gap-1.5 text-primary group">
          <div className="p-1 rounded-lg bg-primary/10 group-active:scale-95 transition-transform">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest">Minha Rota</span>
        </button>
        <button 
          className="flex flex-col items-center gap-1.5 text-muted-foreground/40 group active:text-primary transition-colors"
          onClick={() => toast.info("Histórico em breve")}
        >
          <div className="p-1 group-active:scale-95 transition-transform">
            <Clock className="w-6 h-6" />
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest">Histórico</span>
        </button>
        <button 
          className="flex flex-col items-center gap-1.5 text-rose-500/70 group"
          onClick={() => signOut()}
        >
          <div className="p-1 group-active:scale-95 transition-transform">
            <LogOut className="w-6 h-6" />
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest">Sair</span>
        </button>
      </nav>

      <input 
        type="file" 
        accept="image/*" 
        capture="environment"
        ref={fileInputRef}
        className="hidden"
        onChange={(e) => {
          const rid = (window as any)._currentRouteId;
          if (rid) handleFileChange(e, rid);
        }}
      />
    </div>
  );
}
