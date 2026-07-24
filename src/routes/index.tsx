import { createFileRoute } from "@tanstack/react-router";
import { GithubExplorer } from "@/components/github-explorer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GitHub Explorer — Navegue seus repositórios" },
      {
        name: "description",
        content:
          "Selecione um repositório do GitHub e explore sua estrutura de pastas e arquivos diretamente na interface.",
      },
      { property: "og:title", content: "GitHub Explorer" },
      {
        property: "og:description",
        content: "Explore repositórios do GitHub direto no app.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            GitHub Explorer
          </h1>
          <p className="text-sm text-muted-foreground">
            Escolha um repositório à esquerda e navegue por sua estrutura.
          </p>
        </header>
        <GithubExplorer />
      </div>
    </main>
  );
}
