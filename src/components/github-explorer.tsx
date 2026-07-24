import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight,
  File as FileIcon,
  Folder,
  FolderOpen,
  Github,
  Loader2,
  RefreshCw,
  Star,
} from "lucide-react";
import {
  listMyRepos,
  listRepoContents,
  getFileContent,
  type RepoSummary,
  type DirEntry,
} from "@/lib/github.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type Selected = { owner: string; repo: string; branch: string } | null;

export function GithubExplorer() {
  const [selected, setSelected] = useState<Selected>(null);
  const [filter, setFilter] = useState("");

  const reposQuery = useQuery({
    queryKey: ["gh", "repos"],
    queryFn: () => listMyRepos(),
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const repos = reposQuery.data ?? [];
    if (!filter.trim()) return repos;
    const q = filter.toLowerCase();
    return repos.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q),
    );
  }, [reposQuery.data, filter]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
      {/* Sidebar: repos */}
      <aside className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b p-3">
          <div className="flex items-center gap-2 font-medium">
            <Github className="h-4 w-4" />
            Repositórios
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => reposQuery.refetch()}
            aria-label="Atualizar"
          >
            <RefreshCw
              className={cn("h-4 w-4", reposQuery.isFetching && "animate-spin")}
            />
          </Button>
        </div>
        <div className="p-3">
          <Input
            placeholder="Filtrar…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <ScrollArea className="h-[560px]">
          <ul className="p-2">
            {reposQuery.isLoading && (
              <li className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
              </li>
            )}
            {reposQuery.isError && (
              <li className="p-3 text-sm text-destructive">
                {(reposQuery.error as Error).message}
              </li>
            )}
            {filtered.map((r) => (
              <RepoItem
                key={r.id}
                repo={r}
                active={
                  selected?.owner === r.full_name.split("/")[0] &&
                  selected?.repo === r.name
                }
                onSelect={() =>
                  setSelected({
                    owner: r.full_name.split("/")[0],
                    repo: r.name,
                    branch: r.default_branch,
                  })
                }
              />
            ))}
            {!reposQuery.isLoading && filtered.length === 0 && (
              <li className="p-3 text-sm text-muted-foreground">
                Nenhum repositório encontrado.
              </li>
            )}
          </ul>
        </ScrollArea>
      </aside>

      {/* Main: tree + viewer */}
      <section className="rounded-lg border bg-card">
        {selected ? (
          <RepoBrowser key={`${selected.owner}/${selected.repo}`} selected={selected} />
        ) : (
          <div className="flex h-[640px] flex-col items-center justify-center gap-2 text-muted-foreground">
            <Folder className="h-10 w-10" />
            <p>Selecione um repositório para começar.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function RepoItem({
  repo,
  active,
  onSelect,
}: {
  repo: RepoSummary;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        onClick={onSelect}
        className={cn(
          "w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-accent",
          active && "bg-accent",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{repo.name}</span>
          {repo.private && (
            <Badge variant="outline" className="text-xs">
              privado
            </Badge>
          )}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {repo.full_name}
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          {repo.language && <span>{repo.language}</span>}
          {repo.stargazers_count > 0 && (
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3" />
              {repo.stargazers_count}
            </span>
          )}
        </div>
      </button>
    </li>
  );
}

function RepoBrowser({ selected }: { selected: NonNullable<Selected> }) {
  const [currentPath, setCurrentPath] = useState("");
  const [filePath, setFilePath] = useState<string | null>(null);

  const contentsQuery = useQuery({
    queryKey: ["gh", "contents", selected.owner, selected.repo, currentPath],
    queryFn: () =>
      listRepoContents({
        data: {
          owner: selected.owner,
          repo: selected.repo,
          path: currentPath || undefined,
        },
      }),
  });

  const fileQuery = useQuery({
    queryKey: ["gh", "file", selected.owner, selected.repo, filePath],
    queryFn: () =>
      getFileContent({
        data: { owner: selected.owner, repo: selected.repo, path: filePath! },
      }),
    enabled: !!filePath,
  });

  const crumbs = currentPath ? currentPath.split("/") : [];

  const sorted = useMemo(() => {
    const data = contentsQuery.data ?? [];
    return [...data].sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [contentsQuery.data]);

  return (
    <div className="grid h-[640px] grid-cols-1 md:grid-cols-[280px_1fr]">
      {/* Tree */}
      <div className="border-b md:border-b-0 md:border-r">
        <div className="border-b p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FolderOpen className="h-4 w-4" />
            {selected.owner}/{selected.repo}
          </div>
          <Breadcrumbs
            crumbs={crumbs}
            onNavigate={(idx) => {
              setCurrentPath(idx < 0 ? "" : crumbs.slice(0, idx + 1).join("/"));
              setFilePath(null);
            }}
          />
        </div>
        <ScrollArea className="h-[560px]">
          <ul className="p-2">
            {contentsQuery.isLoading && (
              <li className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
              </li>
            )}
            {contentsQuery.isError && (
              <li className="p-3 text-sm text-destructive">
                {(contentsQuery.error as Error).message}
              </li>
            )}
            {sorted.map((entry) => (
              <EntryRow
                key={entry.sha}
                entry={entry}
                active={filePath === entry.path}
                onOpen={() => {
                  if (entry.type === "dir") {
                    setCurrentPath(entry.path);
                    setFilePath(null);
                  } else if (entry.type === "file") {
                    setFilePath(entry.path);
                  }
                }}
              />
            ))}
            {!contentsQuery.isLoading && sorted.length === 0 && (
              <li className="p-3 text-sm text-muted-foreground">
                Pasta vazia.
              </li>
            )}
          </ul>
        </ScrollArea>
      </div>

      {/* File viewer */}
      <div className="flex min-w-0 flex-col">
        {!filePath && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
            <FileIcon className="h-10 w-10" />
            <p>Selecione um arquivo para visualizar seu conteúdo.</p>
          </div>
        )}
        {filePath && fileQuery.isLoading && (
          <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando arquivo…
          </div>
        )}
        {filePath && fileQuery.isError && (
          <div className="p-4 text-sm text-destructive">
            {(fileQuery.error as Error).message}
          </div>
        )}
        {filePath && fileQuery.data && (
          <>
            <div className="flex items-center justify-between gap-2 border-b p-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {fileQuery.data.path}
                </div>
                <div className="text-xs text-muted-foreground">
                  {fileQuery.data.size.toLocaleString()} bytes
                </div>
              </div>
              <a
                href={fileQuery.data.html_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary underline"
              >
                Abrir no GitHub
              </a>
            </div>
            <ScrollArea className="flex-1">
              <pre className="whitespace-pre p-4 text-xs leading-relaxed font-mono">
                {fileQuery.data.content}
              </pre>
            </ScrollArea>
          </>
        )}
      </div>
    </div>
  );
}

function Breadcrumbs({
  crumbs,
  onNavigate,
}: {
  crumbs: string[];
  onNavigate: (index: number) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
      <button
        onClick={() => onNavigate(-1)}
        className="hover:text-foreground hover:underline"
      >
        root
      </button>
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3" />
          <button
            onClick={() => onNavigate(i)}
            className="hover:text-foreground hover:underline"
          >
            {c}
          </button>
        </span>
      ))}
    </div>
  );
}

function EntryRow({
  entry,
  active,
  onOpen,
}: {
  entry: DirEntry;
  active: boolean;
  onOpen: () => void;
}) {
  const Icon = entry.type === "dir" ? Folder : FileIcon;
  return (
    <li>
      <button
        onClick={onOpen}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
          active && "bg-accent",
        )}
      >
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            entry.type === "dir" ? "text-primary" : "text-muted-foreground",
          )}
        />
        <span className="truncate">{entry.name}</span>
      </button>
    </li>
  );
}
