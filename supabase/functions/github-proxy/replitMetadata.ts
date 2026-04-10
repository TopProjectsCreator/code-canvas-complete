export interface ReplitMetadata {
  exists: boolean;
  title: string | null;
  description: string | null;
  githubOwner: string | null;
  githubRepo: string | null;
}

const NEXT_DATA_REGEX = /<script id="__NEXT_DATA__" type="application\/json"[^>]*>([\s\S]*?)<\/script>/;
const GITHUB_SOURCE_REGEX = /github\.com\/([^/\s"']+)\/([^/\s"'.]+)/i;
const GITHUB_HTML_REGEX = /https?:\/\/github\.com\/([^/\s"']+)\/([^/\s"'#?]+)/i;
const GITHUB_HTML_LOOSE_REGEX = /github\.com\/([^/\s"']+)\/([^/\s"'#?]+)/i;

export const parseReplitMetadata = (html: string): ReplitMetadata => {
  const nextDataMatch = html.match(NEXT_DATA_REGEX);
  if (!nextDataMatch?.[1]) {
    const githubMatch = html.match(GITHUB_HTML_REGEX) || html.match(GITHUB_HTML_LOOSE_REGEX);
    return {
      exists: true,
      title: null,
      description: null,
      githubOwner: githubMatch?.[1] ?? null,
      githubRepo: githubMatch?.[2]?.replace(/\.git$/, "") ?? null,
    };
  }

  let nextData: any = null;
  try {
    nextData = JSON.parse(nextDataMatch[1]);
  } catch {
    nextData = null;
  }

  const apolloState = nextData?.props?.pageProps?.apolloState ?? {};
  const rootQuery = apolloState?.ROOT_QUERY ?? {};
  const getReplKey = Object.keys(rootQuery).find((k) => k.startsWith("getRepl("));
  const replRef = getReplKey ? rootQuery[getReplKey]?.__ref : null;
  const replData = replRef ? apolloState?.[replRef] : null;

  const sourceCandidates = [
    replData?.source,
    replData?.origin,
    JSON.stringify(replData?.source ?? ""),
    JSON.stringify(replData?.origin ?? ""),
  ].filter(Boolean).join(" ");

  const githubMatch = sourceCandidates.match(GITHUB_SOURCE_REGEX)
    || html.match(GITHUB_HTML_REGEX)
    || html.match(GITHUB_HTML_LOOSE_REGEX);

  return {
    exists: true,
    title: replData?.title ?? null,
    description: replData?.description ?? null,
    githubOwner: githubMatch?.[1] ?? null,
    githubRepo: githubMatch?.[2]?.replace(/\.git$/, "") ?? null,
  };
};

