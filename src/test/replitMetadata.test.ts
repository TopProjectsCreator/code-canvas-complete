import { describe, expect, it } from 'vitest';
import { parseReplitMetadata } from '../../supabase/functions/github-proxy/replitMetadata';

const buildNextDataHtml = (repl: Record<string, unknown>) => {
  const nextData = {
    props: {
      pageProps: {
        apolloState: {
          ROOT_QUERY: {
            '__typename': 'Query',
            'getRepl({"id":"abc"})': { __ref: 'Repl:abc' },
          },
          'Repl:abc': repl,
        },
      },
    },
  };

  return `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script></body></html>`;
};

describe('parseReplitMetadata', () => {
  it('extracts metadata and github mapping from source/origin fields', () => {
    const html = buildNextDataHtml({
      title: 'Demo Repl',
      description: 'A demo project',
      source: { repoUrl: 'https://github.com/octocat/Spoon-Knife.git' },
      origin: null,
    });

    const parsed = parseReplitMetadata(html);
    expect(parsed.exists).toBe(true);
    expect(parsed.title).toBe('Demo Repl');
    expect(parsed.description).toBe('A demo project');
    expect(parsed.githubOwner).toBe('octocat');
    expect(parsed.githubRepo).toBe('Spoon-Knife');
  });

  it('falls back to github link discovery in page html', () => {
    const html = `${buildNextDataHtml({
      title: 'No Source Repl',
      description: null,
      source: null,
      origin: null,
    })}<a href="https://github.com/vercel/next.js">Repo</a>`;

    const parsed = parseReplitMetadata(html);
    expect(parsed.githubOwner).toBe('vercel');
    expect(parsed.githubRepo).toBe('next.js');
  });

  it('returns exists=true with null fields when no metadata script exists', () => {
    const parsed = parseReplitMetadata('<html><body>No script here</body></html>');
    expect(parsed.exists).toBe(true);
    expect(parsed.title).toBeNull();
    expect(parsed.description).toBeNull();
    expect(parsed.githubOwner).toBeNull();
    expect(parsed.githubRepo).toBeNull();
  });
});

