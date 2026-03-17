import { describe, expect, it } from 'vitest';
import { explainShellCommand } from '@/lib/shellCommandHelp';

describe('explainShellCommand', () => {
  it('explains navigation commands', () => {
    expect(explainShellCommand('cd ..')).toContain('parent folder');
    expect(explainShellCommand('cd .')).toContain('current folder');
    expect(explainShellCommand('cd -')).toContain('previous folder');
    expect(explainShellCommand('pwd')).toContain('working directory');
    expect(explainShellCommand('ls -la')).toContain('Lists files');
  });

  it('explains install commands with package purpose details', () => {
    expect(explainShellCommand('npm install react zod')).toContain('react: A UI library');
    expect(explainShellCommand('pip install requests numpy')).toContain('requests: A popular Python HTTP client library');
    expect(explainShellCommand('brew install ripgrep')).toContain('ripgrep: Fast recursive text search tool');
    expect(explainShellCommand('pnpm add vitest')).toContain('vitest: A fast test runner');
    expect(explainShellCommand('bun add lodash')).toContain('lodash: A utility library');
  });

  it('explains package manager subcommands broadly', () => {
    expect(explainShellCommand('npm run build')).toContain('script: build');
    expect(explainShellCommand('pnpm run dev')).toContain('script: dev');
    expect(explainShellCommand('bun run test')).toContain('script: test');
    expect(explainShellCommand('pip uninstall requests')).toContain('Uninstalls');
    expect(explainShellCommand('apt install ffmpeg')).toContain('APT');
    expect(explainShellCommand('apt-get install node')).toContain('package purpose');
    expect(explainShellCommand('dnf install docker')).toContain('docker: Container runtime');
    expect(explainShellCommand('yum install git')).toContain('version control');
    expect(explainShellCommand('pacman -S docker')).toContain('Installs packages');
    expect(explainShellCommand('composer require laravel/framework')).toContain('third-party package/library');
    expect(explainShellCommand('gem install rails')).toContain('third-party package/library');
    expect(explainShellCommand('nuget install Newtonsoft.Json')).toContain('third-party package/library');
    expect(explainShellCommand('poetry add fastapi')).toContain('fastapi: A high-performance Python API framework');
    expect(explainShellCommand('cargo add serde')).toContain('cargo package purpose');
    expect(explainShellCommand('go get github.com/gin-gonic/gin')).toContain('go package purpose');
  });

  it('explains docker and typo alias', () => {
    expect(explainShellCommand('docker run -it ubuntu bash')).toContain('Starts a new container');
    expect(explainShellCommand('docker compose up')).toContain('Docker Compose');
    expect(explainShellCommand('docket ps')).toContain('Docker command');
  });

  it('explains common git commands', () => {
    expect(explainShellCommand('git status')).toContain('working tree');
    expect(explainShellCommand('git add .')).toContain('Stages files');
    expect(explainShellCommand('git commit -m "x"')).toContain('Creates a commit');
    expect(explainShellCommand('git pull')).toContain('Fetches and merges');
  });

  it('falls back for unknown commands', () => {
    expect(explainShellCommand('customcmd --flag')).toContain("'customcmd'");
  });
});
