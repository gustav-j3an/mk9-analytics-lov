import { createServerFn } from "@tanstack/react-start";

const GATEWAY = "https://connector-gateway.lovable.dev/github";

async function gh(path: string) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const ghKey = process.env.GITHUB_API_KEY;
  if (!lovableKey || !ghKey) {
    throw new Error("GitHub connector not configured");
  }
  const res = await fetch(`${GATEWAY}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": ghKey,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : null;
}

export type RepoSummary = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  default_branch: string;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
  html_url: string;
};

export const listMyRepos = createServerFn({ method: "GET" }).handler(
  async (): Promise<RepoSummary[]> => {
    const data = await gh(
      "/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member",
    );
    return (data as any[]).map((r) => ({
      id: r.id,
      name: r.name,
      full_name: r.full_name,
      private: r.private,
      description: r.description,
      default_branch: r.default_branch,
      language: r.language,
      stargazers_count: r.stargazers_count,
      updated_at: r.updated_at,
      html_url: r.html_url,
    }));
  },
);

export type DirEntry = {
  name: string;
  path: string;
  type: "file" | "dir" | "symlink" | "submodule";
  size: number;
  sha: string;
};

export const listRepoContents = createServerFn({ method: "GET" })
  .inputValidator((d: { owner: string; repo: string; path?: string; ref?: string }) => d)
  .handler(async ({ data }): Promise<DirEntry[]> => {
    const path = data.path ? `/${encodeURI(data.path)}` : "";
    const ref = data.ref ? `?ref=${encodeURIComponent(data.ref)}` : "";
    const result = await gh(`/repos/${data.owner}/${data.repo}/contents${path}${ref}`);
    const arr = Array.isArray(result) ? result : [result];
    return arr.map((e: any) => ({
      name: e.name,
      path: e.path,
      type: e.type,
      size: e.size,
      sha: e.sha,
    }));
  });

export type FileContent = {
  name: string;
  path: string;
  size: number;
  encoding: string;
  content: string; // decoded text (or notice for binary/too-large)
  isBinary: boolean;
  truncated: boolean;
  html_url: string;
};

const BINARY_EXT = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "ico",
  "bmp",
  "tiff",
  "pdf",
  "zip",
  "tar",
  "gz",
  "rar",
  "7z",
  "exe",
  "dll",
  "so",
  "dylib",
  "bin",
  "woff",
  "woff2",
  "ttf",
  "otf",
  "eot",
  "mp3",
  "mp4",
  "mov",
  "avi",
  "webm",
  "wasm",
  "psd",
  "ai",
  "sketch",
]);

export const getFileContent = createServerFn({ method: "GET" })
  .inputValidator((d: { owner: string; repo: string; path: string; ref?: string }) => d)
  .handler(async ({ data }): Promise<FileContent> => {
    const ref = data.ref ? `?ref=${encodeURIComponent(data.ref)}` : "";
    const result: any = await gh(
      `/repos/${data.owner}/${data.repo}/contents/${encodeURI(data.path)}${ref}`,
    );
    const ext = data.path.split(".").pop()?.toLowerCase() ?? "";
    const isBinary = BINARY_EXT.has(ext);
    const tooLarge = result.size > 500_000;

    let decoded = "";
    let truncated = false;

    if (isBinary) {
      decoded = `[Arquivo binário — ${result.size} bytes]\nVer no GitHub: ${result.html_url}`;
    } else if (tooLarge) {
      decoded = `[Arquivo muito grande — ${result.size} bytes]\nVer no GitHub: ${result.html_url}`;
      truncated = true;
    } else if (result.encoding === "base64" && typeof result.content === "string") {
      try {
        decoded = Buffer.from(result.content, "base64").toString("utf-8");
      } catch {
        decoded = "[Não foi possível decodificar o conteúdo]";
      }
    } else {
      decoded = result.content ?? "";
    }

    return {
      name: result.name,
      path: result.path,
      size: result.size,
      encoding: result.encoding,
      content: decoded,
      isBinary,
      truncated,
      html_url: result.html_url,
    };
  });
