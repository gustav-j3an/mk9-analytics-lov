import { cn } from "@/lib/utils";

interface RankingItem {
  position: number;
  name: string;
  id: string;
  visits: number;
  score: number;
}

interface RankingCardProps {
  items: RankingItem[];
}

export function RankingCard({ items }: RankingCardProps) {
  return (
    <div className="glass-command p-6 rounded-2xl shadow-xl">
      <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6">Ranking de Promotores</h3>
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-4 group">
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs",
              item.position === 1 ? "bg-amber-500/20 text-amber-500" :
              item.position === 2 ? "bg-slate-300/20 text-slate-300" :
              item.position === 3 ? "bg-orange-400/20 text-orange-400" :
              "bg-white/5 text-muted-foreground"
            )}>
              {item.position}
            </div>
            <div className="flex-1">
              <p className="text-white text-sm font-medium group-hover:text-primary transition-colors">{item.name}</p>
              <p className="text-[10px] text-muted-foreground">{item.id}</p>
            </div>
            <div className="text-right">
              <p className="text-white text-sm font-bold">{item.score}%</p>
              <p className="text-[10px] text-muted-foreground">{item.visits} visitas</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
