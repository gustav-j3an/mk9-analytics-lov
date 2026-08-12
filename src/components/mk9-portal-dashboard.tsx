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
  RotateCcw
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeSettings } from "@/lib/mk9-theme/ThemeToggle";

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
      
      // Compressão
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
      };
      
      const compressedFile = await imageCompression(file, options);
      
      // Upload para o Storage
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

      // Registro no Banco via Server Function
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


  const today = now.getDay(); // 0-6 (Sun-Sat)
  // Ajuste se o banco usar 1-7 ou 0-6
  const todayRoutes = useMemo(() => {
    return (routes ?? []).filter(r => r.weekday === today);
  }, [routes, today]);

  const stats = useMemo(() => {
    return {
      total: routes?.length ?? 0,
      today: todayRoutes.length,
      // Mocked for now until we have actual_visits integration in the portal
      completed: 0 
    };
  }, [routes, todayRoutes]);

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans selection:bg-primary/30">
      {/* Header Mobile-First */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shadow-lg glow-primary">
            <ClipboardCheck className="text-foreground h-5 w-5" />
          </div>
          <span className="font-black tracking-tighter text-lg uppercase">
            MK9 <span className="text-primary">PORTAL</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeSettings />
          <Button variant="ghost" size="icon" onClick={() => signOut()} className="text-rose-500">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-6 max-w-md mx-auto w-full">
        {authError ? (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-6 text-center space-y-4">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
            <h2 className="text-sm font-black uppercase tracking-widest text-destructive">Acesso Pendente</h2>
            <p className="text-xs font-bold text-muted-foreground leading-relaxed">
              {authError}
            </p>
            <Button variant="outline" className="w-full text-[10px] font-black uppercase tracking-widest" onClick={() => signOut()}>
              Sair da conta
            </Button>
          </div>
        ) : (
          <>
            {/* Saudação */}
            <section className="space-y-1">
              <h1 className="text-2xl font-black tracking-tight text-foreground uppercase">
                Olá, {promoterProfile?.name?.split(' ')[0] || 'Promotor'}
              </h1>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                {new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(now)}
              </p>
            </section>


        {/* KPIs Rápidos */}
        <section className="grid grid-cols-2 gap-3">
          <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-black text-primary">{stats.today}</span>
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter mt-1">
                Lojas Hoje
              </span>
            </CardContent>
          </Card>
          <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-black text-primary">{stats.total}</span>
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter mt-1">
                Total Mês
              </span>
            </CardContent>
          </Card>
        </section>

        {/* Roteiro do Dia */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Roteiro de Hoje
            </h2>
            <Badge variant="outline" className="text-[10px] font-bold border-primary/30 text-primary">
              {todayRoutes.length} LOJAS
            </Badge>
          </div>

          {isLoadingRoutes || isLoadingProfile ? (
            <div className="flex justify-center py-12">
              <Clock className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : todayRoutes.length > 0 ? (
            <div className="space-y-3">
              {todayRoutes.map((route) => (
                <Card key={route.id} className="bg-card/40 border-border/50 hover:border-primary/50 transition-colors overflow-hidden group">
                  <CardContent className="p-0">
                    <div className="p-4 flex flex-col gap-3">
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1">
                          <h3 className="font-black text-sm uppercase leading-none text-foreground group-hover:text-primary transition-colors">
                            {route.storeName}
                          </h3>
                          <p className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 uppercase tracking-tighter">
                            <MapPin className="w-3 h-3 shrink-0" />
                            {route.storeChain || 'Independente'} • {route.storeUf}
                          </p>
                        </div>
                        <Badge className="bg-primary/20 text-primary border-primary/30 shrink-0 text-[9px] font-black uppercase tracking-tighter">
                          {route.industryName}
                        </Badge>
                      </div>
                      
                      <div className="flex flex-col gap-2 mt-1">
                        {route.evidenceStatus ? (
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between bg-secondary/20 rounded-lg p-2 border border-border/30">
                              <div className="flex items-center gap-2">
                                {route.evidenceStatus === 'PENDING' && <Clock className="w-4 h-4 text-amber-500" />}
                                {route.evidenceStatus === 'APPROVED' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                                {route.evidenceStatus === 'REJECTED' && <XCircle className="w-4 h-4 text-rose-500" />}
                                <span className="text-[9px] font-black uppercase tracking-widest">
                                  {route.evidenceStatus === 'PENDING' && 'Pendente'}
                                  {route.evidenceStatus === 'APPROVED' && 'Aprovada'}
                                  {route.evidenceStatus === 'REJECTED' && 'Rejeitada'}
                                </span>
                              </div>
                              
                              {route.evidenceStatus === 'PENDING' && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-6 text-[8px] font-black uppercase tracking-tighter"
                                  onClick={() => captureGpsAndTriggerFile(route.id)}
                                  disabled={uploadingRouteId === route.id || gpsLoading === route.id}
                                >
                                  {gpsLoading === route.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                  ) : (
                                    <RotateCcw className="w-3 h-3 mr-1" />
                                  )}
                                  Substituir
                                </Button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Button 
                              className="flex-1 h-9 font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20"
                              disabled={uploadingRouteId === route.id || gpsLoading === route.id}
                              onClick={() => captureGpsAndTriggerFile(route.id)}
                            >
                              {uploadingRouteId === route.id ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              ) : gpsLoading === route.id ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              ) : (
                                <Camera className="w-4 h-4 mr-2" />
                              )}
                              {gpsLoading === route.id ? "GPS..." : "Realizar Visita"}
                            </Button>
                            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 border-border/50">
                              <MapPin className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="bg-card/20 border border-dashed border-border/50 rounded-xl p-8 text-center flex flex-col items-center gap-3">
              <Calendar className="w-8 h-8 text-muted-foreground/30" />
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Nenhuma loja programada para hoje
              </p>
            </div>
          )}
        </section>

        {/* Roteiro Completo do Mês (Opcional ou link) */}
        <section className="pt-4 border-t border-border/30">
           <Button variant="ghost" className="w-full text-xs font-bold text-muted-foreground uppercase tracking-widest hover:text-primary">
             Ver roteiro completo do mês
           </Button>
        </section>
      </>
    )}
</main>



      {/* Footer / Navbar Mobile */}
      <nav className="sticky bottom-0 w-full bg-background/80 backdrop-blur-md border-t border-border px-6 h-16 flex items-center justify-around md:hidden">
        <button className="flex flex-col items-center gap-1 text-primary">
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[9px] font-black uppercase tracking-tighter">Início</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-muted-foreground opacity-50">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-[9px] font-black uppercase tracking-tighter">Checkins</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-muted-foreground opacity-50">
          <User className="w-5 h-5" />
          <span className="text-[9px] font-black uppercase tracking-tighter">Perfil</span>
        </button>
      </nav>

      {/* Input de arquivo invisível para captura de evidência */}
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
