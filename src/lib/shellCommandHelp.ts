const EXACT_COMMAND_HELP: Record<string, string> = {
  clear: 'Clears the terminal output screen.',
  help: 'Shows available shell commands and usage information.',
  pwd: 'Prints the current working directory path.',
  whoami: 'Prints the current user name.',
  date: 'Prints the current date and time.',
  env: 'Prints environment variables.',
  exit: 'Ends the current shell session.',
};

const COMMAND_HELP: Record<string, string> = {
  cd: 'Changes the current folder.',
  ls: 'Lists files and folders in the current directory.',
  cat: 'Prints file contents to the terminal.',
  less: 'Opens file content in a scrollable viewer.',
  head: 'Shows the first lines of a file.',
  tail: 'Shows the last lines of a file.',
  touch: 'Creates an empty file or updates file timestamps.',
  mkdir: 'Creates a new directory.',
  rmdir: 'Removes an empty directory.',
  rm: 'Removes files or directories.',
  cp: 'Copies files or directories.',
  mv: 'Moves or renames files/directories.',
  ln: 'Creates links between files.',
  find: 'Searches for files/directories by name or pattern.',
  grep: 'Searches text for matching patterns.',
  sed: 'Applies text transformations to input.',
  awk: 'Processes and extracts structured text data.',
  sort: 'Sorts lines of text.',
  uniq: 'Removes or counts duplicate adjacent lines.',
  wc: 'Counts lines, words, and bytes.',
  cut: 'Extracts columns/sections from text.',
  xargs: 'Builds and runs commands from input items.',
  chmod: 'Changes file permissions.',
  chown: 'Changes file owner/group.',
  ps: 'Lists running processes.',
  top: 'Shows live process/resource usage.',
  kill: 'Stops a process by PID.',
  curl: 'Makes HTTP requests from the terminal.',
  wget: 'Downloads files from URLs.',
  tar: 'Creates/extracts tar archives.',
  zip: 'Creates zip archives.',
  unzip: 'Extracts zip archives.',
  ssh: 'Connects to a remote machine over SSH.',
  scp: 'Copies files over SSH.',
  rsync: 'Syncs files/directories efficiently.',
  docker: 'Runs Docker container commands.',
  kubectl: 'Runs Kubernetes cluster commands.',
  node: 'Runs Node.js scripts.',
  bun: 'Runs Bun runtime and package commands.',
  deno: 'Runs Deno runtime commands.',
  python: 'Runs Python scripts/interpreter.',
  python3: 'Runs Python 3 scripts/interpreter.',
  pip: 'Installs/manages Python packages.',
  pip3: 'Installs/manages Python 3 packages.',
  pipx: 'Installs and runs isolated Python CLI applications.',
  uv: 'Runs fast Python package/environment commands.',
  npm: 'Runs npm package manager commands.',
  npx: 'Runs package binaries without global install.',
  pnpm: 'Runs pnpm package manager commands.',
  yarn: 'Runs Yarn package manager commands.',
  brew: 'Runs Homebrew package manager commands.',
  apt: 'Runs APT package manager commands.',
  'apt-get': 'Runs APT package manager commands.',
  dnf: 'Runs DNF package manager commands.',
  yum: 'Runs YUM package manager commands.',
  pacman: 'Runs Pacman package manager commands.',
  choco: 'Runs Chocolatey package manager commands.',
  winget: 'Runs Windows Package Manager commands.',
  git: 'Runs Git version control commands.',
  make: 'Runs targets from a Makefile.',
  cmake: 'Configures/builds C/C++ projects.',
  cargo: 'Runs Rust package/build commands.',
  go: 'Runs Go build/test/module commands.',
  composer: 'Runs PHP Composer package commands.',
  gem: 'Runs RubyGems package commands.',
  nuget: 'Runs .NET NuGet package commands.',
  poetry: 'Runs Poetry Python packaging commands.',
  java: 'Runs Java programs.',
  javac: 'Compiles Java source files.',
  pytest: 'Runs Python test suites with pytest.',
};

const LIBRARY_PURPOSES: Record<string, string> = {
  react: 'A UI library for building component-based web interfaces.',
  'react-dom': 'DOM renderer for React applications.',
  vite: 'A fast frontend dev server and build tool.',
  typescript: 'A typed superset of JavaScript for safer large codebases.',
  eslint: 'A linter for finding and fixing JavaScript/TypeScript issues.',
  prettier: 'An opinionated code formatter.',
  zod: 'A TypeScript-first schema validation library.',
  axios: 'A promise-based HTTP client for browser and Node.js.',
  express: 'A minimal Node.js web server framework.',
  next: 'A React framework for server rendering and routing.',
  tailwindcss: 'A utility-first CSS framework.',
  lodash: 'A utility library for common JavaScript operations.',
  vitest: 'A fast test runner built for Vite projects.',
  jest: 'A JavaScript testing framework.',
  'framer-motion': 'An animation library for React.',
  requests: 'A popular Python HTTP client library.',
  numpy: 'Core numerical computing library for Python arrays.',
  pandas: 'Data analysis and tabular data library for Python.',
  fastapi: 'A high-performance Python API framework.',
  flask: 'A lightweight Python web framework.',
  django: 'A batteries-included Python web framework.',
  pytest: 'A Python testing framework.',
  pillow: 'Python image processing library (PIL fork).',
  transformers: 'Hugging Face library for ML transformer models.',
  torch: 'PyTorch deep learning framework.',
  tensorflow: 'TensorFlow machine learning framework.',
  uvicorn: 'ASGI server commonly used with FastAPI.',
  postgresql: 'Open-source relational database server.',
  mysql: 'Popular open-source relational database server.',
  redis: 'In-memory key-value data store and cache.',
  docker: 'Container runtime and tooling platform.',
  kubernetes: 'Container orchestration platform.',
  git: 'Distributed version control system.',
  node: 'JavaScript runtime built on Chrome V8.',
  bun: 'Fast JavaScript runtime, bundler, and package manager.',
  pnpm: 'Efficient Node.js package manager with content-addressable storage.',
  ripgrep: 'Fast recursive text search tool (`rg`).',
  ffmpeg: 'Multimedia framework for audio/video conversion and processing.',
};

const NPM_SUBCOMMAND_HELP: Record<string, string> = {
  install: 'Installs project dependencies listed in package.json.',
  i: 'Installs project dependencies listed in package.json.',
  ci: 'Performs a clean, lockfile-based dependency install.',
  run: 'Runs an npm script from package.json.',
  test: 'Runs the project test script.',
  t: 'Runs the project test script.',
  start: 'Runs the project start script.',
  dev: 'Runs the project development script.',
  build: 'Runs the project build script.',
  lint: 'Runs configured lint checks.',
  audit: 'Checks dependencies for known vulnerabilities.',
  update: 'Updates installed dependencies.',
  outdated: 'Lists outdated dependencies.',
  publish: 'Publishes a package to the npm registry.',
  uninstall: 'Removes dependencies from package.json.',
  remove: 'Removes dependencies from package.json.',
};

const PNPM_SUBCOMMAND_HELP: Record<string, string> = {
  install: 'Installs project dependencies with pnpm.',
  i: 'Installs project dependencies with pnpm.',
  add: 'Adds one or more dependencies to package.json using pnpm.',
  remove: 'Removes dependencies from package.json using pnpm.',
  uninstall: 'Removes dependencies from package.json using pnpm.',
  update: 'Updates dependencies managed by pnpm.',
  up: 'Updates dependencies managed by pnpm.',
  run: 'Runs a pnpm script from package.json.',
  test: 'Runs the project test script via pnpm.',
  dev: 'Runs the project development script via pnpm.',
  build: 'Runs the project build script via pnpm.',
  dlx: 'Runs a package binary temporarily via pnpm.',
};

const BUN_SUBCOMMAND_HELP: Record<string, string> = {
  install: 'Installs dependencies using Bun.',
  i: 'Installs dependencies using Bun.',
  add: 'Adds dependencies to package.json using Bun.',
  remove: 'Removes dependencies from package.json using Bun.',
  run: 'Runs a script with Bun.',
  test: 'Runs tests using Bun test runner.',
  dev: 'Runs the development script using Bun.',
  build: 'Runs Bun build command or build script.',
  x: 'Executes package binaries with Bun without global install.',
};

const PIP_SUBCOMMAND_HELP: Record<string, string> = {
  install: 'Installs Python packages.',
  uninstall: 'Uninstalls Python packages.',
  list: 'Lists installed Python packages.',
  show: 'Shows metadata for installed Python packages.',
  freeze: 'Prints installed packages in requirements format.',
  wheel: 'Builds wheel distributions for Python packages.',
  download: 'Downloads package files without installing.',
  check: 'Checks installed packages for dependency conflicts.',
};

const BREW_SUBCOMMAND_HELP: Record<string, string> = {
  install: 'Installs a Homebrew formula/cask.',
  uninstall: 'Removes a Homebrew formula/cask.',
  remove: 'Removes a Homebrew formula/cask.',
  update: 'Updates Homebrew metadata.',
  upgrade: 'Upgrades installed Homebrew packages.',
  list: 'Lists installed Homebrew packages.',
  search: 'Searches available Homebrew packages.',
  doctor: 'Checks Homebrew installation health.',
  services: 'Manages background services via Homebrew.',
};

const APT_SUBCOMMAND_HELP: Record<string, string> = {
  install: 'Installs system packages from APT repositories.',
  remove: 'Removes system packages.',
  purge: 'Removes packages including configuration files.',
  update: 'Refreshes package index metadata.',
  upgrade: 'Upgrades installed packages to latest versions.',
  search: 'Searches package names/descriptions.',
  autoremove: 'Removes unused dependency packages.',
};

const DNF_SUBCOMMAND_HELP: Record<string, string> = {
  install: 'Installs system packages via DNF.',
  remove: 'Removes packages via DNF.',
  update: 'Updates installed packages via DNF.',
  upgrade: 'Upgrades installed packages via DNF.',
  search: 'Searches packages via DNF.',
  info: 'Shows package details via DNF.',
};

const PACMAN_SUBCOMMAND_HELP: Record<string, string> = {
  '-S': 'Installs packages using pacman sync operation.',
  '-R': 'Removes packages using pacman.',
  '-Ss': 'Searches packages in sync databases.',
  '-Sy': 'Refreshes package databases.',
  '-Syu': 'Refreshes package databases and upgrades packages.',
};

const COMPOSER_SUBCOMMAND_HELP: Record<string, string> = {
  require: 'Adds PHP package dependencies to composer.json.',
  install: 'Installs dependencies from composer.lock.',
  update: 'Updates Composer dependencies.',
  remove: 'Removes Composer dependencies.',
  dumpautoload: 'Regenerates Composer autoload files.',
};

const GEM_SUBCOMMAND_HELP: Record<string, string> = {
  install: 'Installs Ruby gems.',
  uninstall: 'Uninstalls Ruby gems.',
  update: 'Updates installed Ruby gems.',
  list: 'Lists installed Ruby gems.',
  search: 'Searches RubyGems.org.',
};

const NUGET_SUBCOMMAND_HELP: Record<string, string> = {
  install: 'Installs NuGet packages.',
  restore: 'Restores NuGet packages for a solution/project.',
  update: 'Updates NuGet packages.',
  list: 'Lists NuGet packages.',
};

const POETRY_SUBCOMMAND_HELP: Record<string, string> = {
  add: 'Adds Python dependencies to pyproject.toml via Poetry.',
  remove: 'Removes Python dependencies via Poetry.',
  install: 'Installs dependencies via Poetry.',
  update: 'Updates dependencies via Poetry.',
  run: 'Runs a command inside Poetry virtual environment.',
  shell: 'Spawns a Poetry-managed shell environment.',
};

const DOCKER_SUBCOMMAND_HELP: Record<string, string> = {
  build: 'Builds a Docker image from a Dockerfile.',
  run: 'Starts a new container from an image.',
  ps: 'Lists running Docker containers.',
  images: 'Lists local Docker images.',
  pull: 'Downloads an image from a registry.',
  push: 'Uploads an image to a registry.',
  exec: 'Runs a command inside a running container.',
  logs: 'Shows logs for a container.',
  stop: 'Stops running containers.',
  rm: 'Removes containers.',
  rmi: 'Removes Docker images.',
  compose: 'Runs Docker Compose subcommands for multi-container apps.',
};

const GIT_SUBCOMMAND_HELP: Record<string, string> = {
  status: 'Shows changed files and git working tree state.',
  add: 'Stages files for the next commit.',
  commit: 'Creates a commit with staged changes.',
  push: 'Uploads local commits to a remote repository.',
  pull: 'Fetches and merges remote changes.',
  fetch: 'Downloads remote history without merging.',
  clone: 'Copies a remote repository locally.',
  checkout: 'Switches branches or restores files.',
  switch: 'Switches branches.',
  branch: 'Lists, creates, or deletes branches.',
  merge: 'Merges another branch into current branch.',
  rebase: 'Reapplies commits on top of another base.',
  reset: 'Moves branch pointer and optionally unstages changes.',
  restore: 'Restores files from a commit or index.',
  stash: 'Temporarily saves uncommitted changes.',
  log: 'Shows commit history.',
  diff: 'Shows code differences between states.',
  tag: 'Lists or creates version tags.',
  remote: 'Manages remote repository aliases.',
};

function cleanPackageName(value: string): string {
  return value.replace(/^['"]|['"]$/g, '').trim();
}

function extractPackageArgs(rest: string[]): string[] {
  const names: string[] = [];
  for (const token of rest) {
    if (!token || token.startsWith('-')) continue;
    names.push(cleanPackageName(token));
  }
  return names;
}

function packagePurposeText(pkg: string): string {
  const normalized = pkg.toLowerCase();
  const purpose = LIBRARY_PURPOSES[normalized];
  if (purpose) return `${pkg}: ${purpose}`;
  return `${pkg}: third-party package/library (purpose depends on the package).`;
}

function explainInstallLike(
  ecosystemLabel: string,
  baseText: string,
  packageNames: string[],
): string {
  if (packageNames.length === 0) return baseText;
  const top = packageNames.slice(0, 2);
  const packageDetails = top.map(packagePurposeText).join(' | ');
  const more = packageNames.length > top.length ? ` (+${packageNames.length - top.length} more)` : '';
  return `${baseText} ${ecosystemLabel} package purpose: ${packageDetails}${more}`;
}

function explainPackageManagerCommand(
  binary: string,
  rest: string[],
  subcommandHelp: Record<string, string>,
  defaultHelp: string,
  options?: { runMeansScript?: boolean; installSubcommands?: string[] },
): string {
  const sub = rest[0];
  if (!sub) return defaultHelp;
  const mapped = subcommandHelp[sub];
  if (mapped) {
    if (options?.runMeansScript && sub === 'run' && rest[1]) return `Runs ${binary} script: ${rest[1]}.`;
    if (options?.installSubcommands?.includes(sub)) {
      return explainInstallLike(binary, mapped, extractPackageArgs(rest.slice(1)));
    }
    return mapped;
  }
  return defaultHelp;
}

export function explainShellCommand(command: string): string {
  const trimmed = command.trim();
  if (!trimmed) return 'Runs a shell command in the current project environment.';

  if (EXACT_COMMAND_HELP[trimmed]) return EXACT_COMMAND_HELP[trimmed];

  const [rawBin, ...rest] = trimmed.split(/\s+/);
  const bin = rawBin === 'docket' ? 'docker' : rawBin;
  const args = rest.join(' ').trim();

  if (rawBin === 'docket') {
    return 'Likely Docker command (docket typo). Runs Docker container commands.';
  }

  if (bin === 'cd') {
    if (args === '..') return 'Switches to the parent folder.';
    if (args === '.') return 'Stays in the current folder (no directory change).';
    if (!args || args === '~') return 'Changes directory to your home/default folder.';
    if (args === '-') return 'Switches back to the previous folder.';
    return `Switches to folder: ${args}`;
  }

  if (bin === 'npm') {
    return explainPackageManagerCommand('npm', rest, NPM_SUBCOMMAND_HELP, COMMAND_HELP.npm, {
      runMeansScript: true,
      installSubcommands: ['install', 'i'],
    });
  }

  if (bin === 'pnpm') {
    return explainPackageManagerCommand('pnpm', rest, PNPM_SUBCOMMAND_HELP, COMMAND_HELP.pnpm, {
      runMeansScript: true,
      installSubcommands: ['add', 'install', 'i'],
    });
  }

  if (bin === 'bun') {
    return explainPackageManagerCommand('bun', rest, BUN_SUBCOMMAND_HELP, COMMAND_HELP.bun, {
      runMeansScript: true,
      installSubcommands: ['add', 'install', 'i'],
    });
  }

  if (bin === 'pip' || bin === 'pip3') {
    return explainPackageManagerCommand(bin, rest, PIP_SUBCOMMAND_HELP, COMMAND_HELP[bin], {
      installSubcommands: ['install'],
    });
  }

  if (bin === 'brew') {
    return explainPackageManagerCommand('brew', rest, BREW_SUBCOMMAND_HELP, COMMAND_HELP.brew, {
      installSubcommands: ['install'],
    });
  }

  if (bin === 'apt' || bin === 'apt-get') {
    return explainPackageManagerCommand(bin, rest, APT_SUBCOMMAND_HELP, COMMAND_HELP[bin], {
      installSubcommands: ['install'],
    });
  }

  if (bin === 'dnf' || bin === 'yum') {
    return explainPackageManagerCommand(bin, rest, DNF_SUBCOMMAND_HELP, COMMAND_HELP[bin], {
      installSubcommands: ['install'],
    });
  }

  if (bin === 'pacman') {
    return explainPackageManagerCommand('pacman', rest, PACMAN_SUBCOMMAND_HELP, COMMAND_HELP.pacman, {
      installSubcommands: ['-S', '-Syu'],
    });
  }

  if (bin === 'composer') {
    return explainPackageManagerCommand('composer', rest, COMPOSER_SUBCOMMAND_HELP, COMMAND_HELP.composer, {
      installSubcommands: ['require'],
    });
  }

  if (bin === 'gem') {
    return explainPackageManagerCommand('gem', rest, GEM_SUBCOMMAND_HELP, COMMAND_HELP.gem, {
      installSubcommands: ['install'],
    });
  }

  if (bin === 'nuget') {
    return explainPackageManagerCommand('nuget', rest, NUGET_SUBCOMMAND_HELP, COMMAND_HELP.nuget, {
      installSubcommands: ['install'],
    });
  }

  if (bin === 'poetry') {
    return explainPackageManagerCommand('poetry', rest, POETRY_SUBCOMMAND_HELP, COMMAND_HELP.poetry, {
      runMeansScript: true,
      installSubcommands: ['add', 'install'],
    });
  }

  if (bin === 'docker') {
    return explainPackageManagerCommand('docker', rest, DOCKER_SUBCOMMAND_HELP, COMMAND_HELP.docker);
  }

  if (bin === 'git') {
    const sub = rest[0];
    if (sub && GIT_SUBCOMMAND_HELP[sub]) return GIT_SUBCOMMAND_HELP[sub];
    return COMMAND_HELP.git;
  }

  if (bin === 'cargo') {
    const sub = rest[0];
    if (sub === 'add') return explainInstallLike('cargo', 'Adds Rust crate dependencies to Cargo.toml.', extractPackageArgs(rest.slice(1)));
    if (sub === 'install') return explainInstallLike('cargo', 'Installs Rust binaries from crates.io or local sources.', extractPackageArgs(rest.slice(1)));
  }

  if (bin === 'go') {
    const sub = rest[0];
    if (sub === 'get' || sub === 'install') {
      return explainInstallLike('go', `Fetches/installs Go modules via 'go ${sub}'.`, extractPackageArgs(rest.slice(1)));
    }
  }

  if (COMMAND_HELP[bin]) return COMMAND_HELP[bin];

  return `Runs the '${bin}' command in the project shell.`;
}
