import { describe, expect, it } from 'vitest';
import { explainShellCommand } from '@/lib/shellCommandHelp';

describe('explainShellCommand', () => {
  it('explains navigation commands', () => {
    expect(explainShellCommand('cd ..')).toContain('parent folder');
    expect(explainShellCommand('cd .')).toContain('current folder');
    expect(explainShellCommand('cd -')).toContain('previous folder');
    expect(explainShellCommand('pwd')).toContain('working directory');
    expect(explainShellCommand('ls -la')).toContain('Lists files');
    expect(explainShellCommand('ls -lah src')).toContain('including hidden files');
  });

  it('customizes wc/find/grep explanations with command arguments', () => {
    expect(explainShellCommand('wc -m filename.txt')).toContain('number of characters in filename.txt');
    expect(explainShellCommand('wc -l README.md')).toContain('number of lines in README.md');
    expect(explainShellCommand('grep TODO src/App.tsx')).toContain("matching pattern 'TODO'");
    expect(explainShellCommand('find src -name *.tsx')).toContain('matching *.tsx');
  });

  it('customizes common file and network commands with targets/flags', () => {
    expect(explainShellCommand('mkdir -p src/utils/helpers')).toContain('creates missing parent folders');
    expect(explainShellCommand('rm -rf dist')).toContain('recursively');
    expect(explainShellCommand('cp -r src assets-copy')).toContain('to assets-copy recursively');
    expect(explainShellCommand('mv old.txt new.txt')).toContain('to new.txt');
    expect(explainShellCommand('cat README.md')).toContain('contents of README.md');
    expect(explainShellCommand('head -n 5 package.json')).toContain('first 5 line(s)');
    expect(explainShellCommand('tail -n 20 app.log')).toContain('last 20 line(s)');
    expect(explainShellCommand('curl -X POST https://api.example.com/items')).toContain('HTTP POST request');
    expect(explainShellCommand('ssh user@example.com')).toContain("remote host 'user@example.com'");
    expect(explainShellCommand('scp app.log server:/tmp/app.log')).toContain('to server:/tmp/app.log over SSH');
    expect(explainShellCommand('ping -c 4 example.com')).toContain('4 ICMP ping request(s)');
    expect(explainShellCommand('systemctl restart nginx')).toContain("systemctl restart");
    expect(explainShellCommand('docker run -it ubuntu bash')).toContain("image 'ubuntu'");
  });

  it('adds richer explanations for text, process, and disk usage commands', () => {
    expect(explainShellCommand('touch notes.txt')).toContain('updates timestamps');
    expect(explainShellCommand('ln -s ./target ./shortcut')).toContain('symbolic link');
    expect(explainShellCommand("sed -i 's/foo/bar/g' app.txt")).toContain('in-place');
    expect(explainShellCommand("awk '{print $1}' access.log")).toContain('awk program');
    expect(explainShellCommand("jq '.name' package.json")).toContain('jq filter');
    expect(explainShellCommand('ps -ef')).toContain('full-format');
    expect(explainShellCommand('kill -9 1234')).toContain('signal -9');
    expect(explainShellCommand('du -sh node_modules')).toContain('human-readable sizes');
    expect(explainShellCommand('df -h')).toContain('human-readable units');
    expect(explainShellCommand('git log --oneline')).toContain('one-line commit history');
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
    expect(explainShellCommand('yarn add react')).toContain('package purpose');
    expect(explainShellCommand('kubectl get pods')).toContain('Kubernetes resources');
  });

  it('explains docker and typo alias', () => {
    expect(explainShellCommand('docker run -it ubuntu bash')).toContain('Starts a new container');
    expect(explainShellCommand('docker compose up')).toContain('Docker Compose');
    expect(explainShellCommand('docket ps')).toContain('Docker command');
  });

  it('explains chained operators and each command', () => {
    const explanation = explainShellCommand('npm run build && npm run test');
    expect(explanation).toContain("Operator '&&'");
    expect(explanation).toContain("Command 1 ('npm run build')");
    expect(explanation).toContain("Command 2 ('npm run test')");
    expect(explanation).toContain('only if the previous command succeeds');
  });

  it('explains sudo wrapped commands', () => {
    const explanation = explainShellCommand('sudo apt install ffmpeg');
    expect(explanation).toContain('elevated privileges');
    expect(explanation).toContain('Installs system packages from APT repositories');
  });

  it('explains common git commands', () => {
    expect(explainShellCommand('git status')).toContain('working tree');
    expect(explainShellCommand('git add .')).toContain('Stages files');
    expect(explainShellCommand('git commit -m "x"')).toContain('Creates a commit');
    expect(explainShellCommand('git pull')).toContain('Fetches and merges');
  });

  it('falls back for unknown commands', () => {
    expect(explainShellCommand('customcmd --flag')).toContain("'customcmd'");
    expect(explainShellCommand('CUSTOM=1 customcmd > out.txt')).toContain("Uses '>'");
    expect(explainShellCommand('CUSTOM=1 customcmd > out.txt')).toContain('environment variable assignment');
  });
});
