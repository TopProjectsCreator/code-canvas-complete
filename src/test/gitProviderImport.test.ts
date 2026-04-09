import { describe, expect, it } from 'vitest';
import { detectProvider } from '@/hooks/useGitProviderImport';

describe('detectProvider', () => {
  it('detects git providers and wrapped platform URLs', () => {
    expect(detectProvider('https://github.com/octocat/Hello-World')).toBe('github');
    expect(detectProvider('https://gitlab.com/gitlab-org/gitlab')).toBe('gitlab');
    expect(detectProvider('https://bitbucket.org/atlassian/python-bitbucket')).toBe('bitbucket');
    expect(detectProvider('https://replit.com/@replit/Python')).toBe('replit');
    expect(detectProvider('https://bolt.new/~/github.com/octocat/Spoon-Knife')).toBe('bolt');
    expect(detectProvider('https://studio.firebase.google.com/import?url=https://github.com/octocat/Spoon-Knife')).toBe('firebase');
  });
});

