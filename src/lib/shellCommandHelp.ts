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
  bash: 'Runs Bash shell scripts/commands.',
  sh: 'Runs POSIX shell scripts/commands.',
  zsh: 'Runs Z shell scripts/commands.',
  fish: 'Runs Fish shell scripts/commands.',
  source: 'Loads shell commands from a file into the current shell.',
  '.': 'Loads shell commands from a file into the current shell.',
  echo: 'Prints text or variable values.',
  printf: 'Prints formatted text.',
  tee: 'Writes input to both stdout and one or more files.',
  tr: 'Translates or deletes characters from text streams.',
  realpath: 'Prints the absolute canonical path.',
  readlink: 'Prints or resolves symbolic link targets.',
  stat: 'Shows file or filesystem metadata.',
  file: 'Detects file type information.',
  du: 'Estimates file/directory disk usage.',
  df: 'Shows filesystem disk space usage.',
  free: 'Shows memory usage.',
  uname: 'Prints system/kernel information.',
  hostname: 'Shows or sets the system host name.',
  ping: 'Sends ICMP echo packets to test connectivity.',
  traceroute: 'Shows network route hops to a destination.',
  dig: 'Queries DNS records.',
  nslookup: 'Queries DNS records.',
  netstat: 'Shows network sockets/routes (legacy).',
  ss: 'Shows socket and network connection information.',
  lsof: 'Lists open files and the processes using them.',
  crontab: 'Manages scheduled cron jobs.',
  systemctl: 'Manages systemd services and system state.',
  service: 'Controls background services (init/systemd wrapper).',
  journalctl: 'Views logs collected by systemd-journald.',
  history: 'Shows shell command history.',
  alias: 'Creates command aliases in the shell.',
  unalias: 'Removes shell command aliases.',
  export: 'Sets environment variables for child processes.',
  which: 'Shows the executable path for a command.',
  whereis: 'Locates command binaries/source/man pages.',
  man: 'Opens manual pages for commands.',
  chgrp: 'Changes file group ownership.',
  mount: 'Mounts filesystems/devices.',
  umount: 'Unmounts filesystems/devices.',
  dd: 'Copies/converts raw data at block level.',
  screen: 'Runs detachable terminal sessions.',
  tmux: 'Runs detachable terminal multiplexer sessions.',
  openssl: 'Runs cryptography/TLS operations.',
  ffmpeg: 'Converts and processes audio/video media.',
  sqlite3: 'Opens and queries SQLite databases.',
  psql: 'Runs PostgreSQL interactive terminal commands.',
  mysql: 'Runs MySQL/MariaDB interactive terminal commands.',
  'redis-cli': 'Runs Redis interactive commands.',
  watch: 'Runs a command repeatedly and shows live-updating output.',
  time: 'Measures how long a command takes to run.',
  sleep: 'Pauses execution for a duration.',
  yes: 'Repeatedly outputs a string until stopped.',
  seq: 'Prints a numeric sequence.',
  paste: 'Merges lines from files side-by-side.',
  join: 'Joins lines from two files using a common field.',
  split: 'Splits a file into smaller pieces.',
  fold: 'Wraps long lines to a given width.',
  nl: 'Prints file lines with line numbers.',
  expand: 'Converts tabs to spaces.',
  unexpand: 'Converts spaces to tabs when possible.',
  rev: 'Reverses characters in each input line.',
  od: 'Dumps file contents in octal/hex formats.',
  hexdump: 'Prints file contents in hexadecimal view.',
  strings: 'Extracts printable strings from binary files.',
  md5sum: 'Computes/verifies MD5 checksums.',
  sha1sum: 'Computes/verifies SHA-1 checksums.',
  sha256sum: 'Computes/verifies SHA-256 checksums.',
  sha512sum: 'Computes/verifies SHA-512 checksums.',
  cksum: 'Computes CRC checksum and byte counts.',
  base64: 'Encodes or decodes Base64 data.',
  basename: 'Strips directory and suffix from file paths.',
  dirname: 'Extracts directory part of file paths.',
  mktemp: 'Creates a unique temporary file or directory.',
  install: 'Copies files and sets attributes/permissions.',
  truncate: 'Shrinks or extends files to a specific size.',
  sync: 'Flushes filesystem buffers to disk.',
  lsblk: 'Lists block storage devices.',
  blkid: 'Prints block device UUID/label information.',
  fdisk: 'Creates and manages disk partitions.',
  parted: 'Manipulates disk partition tables.',
  mkfs: 'Creates filesystems on devices/partitions.',
  fsck: 'Checks and repairs filesystem issues.',
  tune2fs: 'Adjusts ext filesystem parameters.',
  useradd: 'Creates a new user account.',
  usermod: 'Modifies a user account.',
  userdel: 'Deletes a user account.',
  groupadd: 'Creates a new user group.',
  groupmod: 'Modifies a user group.',
  groupdel: 'Deletes a user group.',
  passwd: 'Changes a user password.',
  su: 'Switches to another user account.',
  id: 'Prints user and group identity info.',
  groups: 'Lists group memberships for users.',
  last: 'Shows recent login history.',
  w: 'Shows who is logged in and system load.',
  uptime: 'Shows system uptime and load averages.',
  dmesg: 'Displays kernel ring buffer messages.',
  'ip': 'Configures/shows network interfaces, routes, addresses.',
  ifconfig: 'Shows/configures network interfaces (legacy).',
  route: 'Shows/edits IP routing table (legacy).',
  iptables: 'Configures IPv4 firewall rules.',
  nft: 'Configures nftables firewall rules.',
  ufw: 'Manages uncomplicated firewall rules.',
  tcpdump: 'Captures and inspects network packets.',
  nmap: 'Scans network hosts and ports.',
  nc: 'Reads/writes data across network connections.',
  telnet: 'Connects to remote services over Telnet.',
  'ssh-keygen': 'Creates and manages SSH key pairs.',
  'ssh-copy-id': 'Installs local SSH public key on remote host.',
  sftp: 'Transfers files over SSH in interactive mode.',
  aria2c: 'Downloads files via HTTP/FTP/BitTorrent.',
  lynx: 'Text-based web browser.',
  jq: 'Filters/transforms JSON from stdin or files.',
  yq: 'Filters/transforms YAML/JSON data.',
  xmllint: 'Validates and formats XML documents.',
  xmlstarlet: 'Queries/transforms XML documents.',
  csvkit: 'CLI toolkit for working with CSV files.',
  pandoc: 'Converts documents between markup formats.',
  iconv: 'Converts text between character encodings.',
  locale: 'Prints or sets locale information.',
  localectl: 'Queries/changes system locale settings.',
  parallel: 'Runs shell jobs in parallel from input lists.',
  timeout: 'Runs a command with a time limit.',
  nohup: 'Runs a command immune to hangups.',
  disown: 'Removes a job from shell job control.',
  jobs: 'Lists shell background jobs.',
  bg: 'Resumes a stopped job in the background.',
  fg: 'Brings a background/stopped job to the foreground.',
  'set': 'Sets shell options/variables.',
  unset: 'Removes shell variables/functions.',
  envsubst: 'Substitutes environment variables in text.',
  printenv: 'Prints environment variables.',
  hostnamectl: 'Shows/sets system hostname metadata.',
  timedatectl: 'Shows/sets system time and timezone.',
  loginctl: 'Manages user login sessions via systemd.',
  nmcli: 'Controls NetworkManager from the command line.',
  ethtool: 'Displays/modifies NIC settings.',
  iw: 'Configures wireless interfaces.',
  at: 'Schedules one-time command execution.',
  'atq': 'Lists pending at jobs.',
  atrm: 'Removes pending at jobs.',
  rsnapshot: 'Runs filesystem snapshots via rsync.',
  borg: 'Deduplicating backup tool commands.',
  restic: 'Backup program with snapshots and encryption.',
  ansible: 'Runs Ansible automation commands.',
  terraform: 'Runs Terraform infrastructure-as-code commands.',
  pulumi: 'Runs Pulumi infrastructure-as-code commands.',
  aws: 'Runs AWS CLI cloud management commands.',
  az: 'Runs Azure CLI cloud management commands.',
  gcloud: 'Runs Google Cloud CLI commands.',
  heroku: 'Runs Heroku platform CLI commands.',
  vercel: 'Runs Vercel deployment CLI commands.',
  netlify: 'Runs Netlify CLI commands.',
  kubens: 'Switches current Kubernetes namespace quickly.',
  kubectx: 'Switches current Kubernetes context quickly.',
  helm: 'Runs Helm Kubernetes package manager commands.',
  kustomize: 'Builds Kubernetes manifests from overlays.',
  minikube: 'Runs local Kubernetes cluster commands.',
  kind: 'Runs Kubernetes-in-Docker cluster commands.',
  podman: 'Runs Podman container commands.',
  buildah: 'Builds OCI container images.',
  skopeo: 'Copies/inspects container images and registries.',
  'docker-compose': 'Runs Docker Compose multi-container commands.',
  php: 'Runs PHP scripts/interpreter.',
  ruby: 'Runs Ruby scripts/interpreter.',
  perl: 'Runs Perl scripts/interpreter.',
  lua: 'Runs Lua scripts/interpreter.',
  rustc: 'Compiles Rust source files.',
  clang: 'Compiles C/C++ source with LLVM Clang.',
  gcc: 'Compiles C/C++ source with GCC.',
  gdb: 'Runs GNU debugger sessions.',
  lldb: 'Runs LLDB debugger sessions.',
  valgrind: 'Analyzes memory/performance issues in binaries.',
  strace: 'Traces system calls and signals for a process.',
  ltrace: 'Traces library calls made by a process.',
  objdump: 'Displays information from object files.',
  nm: 'Lists symbols from object files.',
  readelf: 'Displays ELF binary metadata.',
  makepkg: 'Builds Arch Linux packages from PKGBUILD.',
  dpkg: 'Installs/manages Debian package files.',
  rpm: 'Installs/manages RPM package files.',
  apk: 'Runs Alpine Linux package manager commands.',
  zypper: 'Runs openSUSE package manager commands.',
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

const YARN_SUBCOMMAND_HELP: Record<string, string> = {
  install: 'Installs dependencies from package.json/yarn.lock.',
  add: 'Adds dependencies to package.json.',
  remove: 'Removes dependencies from package.json.',
  up: 'Upgrades dependencies.',
  run: 'Runs a script from package.json.',
  test: 'Runs the project test script.',
  dev: 'Runs the project development script.',
  build: 'Runs the project build script.',
  dlx: 'Runs a package binary without permanently installing it.',
};

const KUBECTL_SUBCOMMAND_HELP: Record<string, string> = {
  get: 'Reads Kubernetes resources (pods, deployments, services, etc.).',
  describe: 'Shows detailed information for Kubernetes resources.',
  apply: 'Creates/updates resources from manifest files.',
  delete: 'Deletes Kubernetes resources.',
  logs: 'Streams or prints pod/container logs.',
  exec: 'Executes a command inside a running container.',
  config: 'Manages kubeconfig contexts and cluster credentials.',
  rollout: 'Manages deployment rollouts and rollbacks.',
  scale: 'Scales Kubernetes workloads.',
  'port-forward': 'Forwards local ports to pods/services.',
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

const CHAIN_OPERATOR_HELP: Record<string, string> = {
  '&&': 'Runs the next command only if the previous command succeeds (exit code 0).',
  '||': 'Runs the next command only if the previous command fails (non-zero exit code).',
  '|': 'Pipes the previous command output into the next command as input.',
  ';': 'Runs commands in sequence regardless of success or failure.',
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

function summarizeShellSyntax(command: string): string[] {
  const notes: string[] = [];
  if (/\s>>\s?/.test(command)) notes.push("Uses '>>' to append command output to a file.");
  else if (/\s>\s?/.test(command)) notes.push("Uses '>' to overwrite a file with command output.");
  if (/\s2>\s?/.test(command)) notes.push("Uses '2>' to redirect stderr (errors) to a file.");
  if (/\s<\s?/.test(command)) notes.push("Uses '<' to read command input from a file.");
  if (/\*/.test(command)) notes.push("Uses '*' wildcard expansion to match multiple file names.");
  if (/\$\{?[A-Za-z_][A-Za-z0-9_]*\}?/.test(command)) notes.push('References one or more shell environment variables.');
  if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(command)) notes.push('Starts with environment variable assignment(s) for this command context.');
  return notes;
}

function splitFlagsAndTargets(args: string[]): { flags: string[]; targets: string[] } {
  const flags: string[] = [];
  const targets: string[] = [];
  for (const arg of args) {
    if (arg.startsWith('-')) flags.push(arg);
    else targets.push(arg);
  }
  return { flags, targets };
}

function explainContextualCommand(bin: string, args: string[]): string | null {
  const { flags, targets } = splitFlagsAndTargets(args);

  if (bin === 'wc') {
    const targetText = targets.length > 0 ? ` in ${targets.join(', ')}` : '';
    if (flags.includes('-m') || flags.includes('--chars')) return `Counts the number of characters${targetText}.`;
    if (flags.includes('-l') || flags.includes('--lines')) return `Counts the number of lines${targetText}.`;
    if (flags.includes('-w') || flags.includes('--words')) return `Counts the number of words${targetText}.`;
    if (flags.includes('-c') || flags.includes('--bytes')) return `Counts the number of bytes${targetText}.`;
    return `Counts lines, words, and bytes${targetText}.`;
  }

  if (bin === 'ls') {
    const location = targets.length > 0 ? targets.join(', ') : 'the current directory';
    const details: string[] = [];
    if (flags.some(flag => flag.includes('a'))) details.push('including hidden files');
    if (flags.some(flag => flag.includes('l'))) details.push('in long/detailed format');
    if (flags.some(flag => flag.includes('h'))) details.push('with human-readable sizes');
    const detailsText = details.length > 0 ? ` (${details.join(', ')})` : '';
    return `Lists files and folders in ${location}${detailsText}.`;
  }

  if (bin === 'grep') {
    const pattern = targets[0];
    const scope = targets.slice(1);
    if (!pattern) return 'Searches text for lines matching a pattern.';
    if (scope.length === 0) return `Searches incoming text for pattern '${pattern}'.`;
    return `Searches ${scope.join(', ')} for lines matching pattern '${pattern}'.`;
  }

  if (bin === 'find') {
    const root = targets[0] ?? '.';
    if (args.includes('-name') && args[args.indexOf('-name') + 1]) {
      return `Searches under ${root} for paths with name matching ${args[args.indexOf('-name') + 1]}.`;
    }
    if (args.includes('-type') && args[args.indexOf('-type') + 1]) {
      const typeArg = args[args.indexOf('-type') + 1];
      const typeText = typeArg === 'f' ? 'files' : typeArg === 'd' ? 'directories' : `type '${typeArg}' entries`;
      return `Searches under ${root} for ${typeText}.`;
    }
    return `Searches for files/directories under ${root}.`;
  }

  if (bin === 'mkdir') {
    if (targets.length === 0) return 'Creates a new directory.';
    const parents = flags.includes('-p') ? ' and creates missing parent folders as needed' : '';
    return `Creates director${targets.length === 1 ? 'y' : 'ies'}: ${targets.join(', ')}${parents}.`;
  }

  if (bin === 'touch') {
    if (targets.length === 0) return 'Creates an empty file or updates file timestamps.';
    return `Creates file${targets.length === 1 ? '' : 's'} or updates timestamps: ${targets.join(', ')}.`;
  }

  if (bin === 'rm') {
    if (targets.length === 0) return 'Removes files or directories.';
    const recursive = flags.some(flag => flag.includes('r')) ? ' recursively' : '';
    const forced = flags.some(flag => flag.includes('f')) ? ' (force mode)' : '';
    return `Removes ${targets.join(', ')}${recursive}${forced}.`;
  }

  if (bin === 'cp') {
    if (targets.length >= 2) {
      const destination = targets[targets.length - 1];
      const sources = targets.slice(0, -1);
      const recursive = flags.some(flag => flag.includes('r')) ? ' recursively' : '';
      return `Copies ${sources.join(', ')} to ${destination}${recursive}.`;
    }
    return 'Copies files or directories.';
  }

  if (bin === 'mv') {
    if (targets.length >= 2) {
      const destination = targets[targets.length - 1];
      const sources = targets.slice(0, -1);
      return `Moves/renames ${sources.join(', ')} to ${destination}.`;
    }
    return 'Moves or renames files/directories.';
  }

  if (bin === 'ln') {
    if (targets.length >= 2) {
      const source = targets[0];
      const destination = targets[1];
      if (flags.some(flag => flag.includes('s'))) return `Creates a symbolic link from ${destination} to ${source}.`;
      return `Creates a hard link from ${destination} to ${source}.`;
    }
    return 'Creates links between files.';
  }

  if (bin === 'cat') {
    if (targets.length === 0) return 'Prints file contents to the terminal.';
    return `Prints the contents of ${targets.join(', ')}.`;
  }

  if (bin === 'head' || bin === 'tail') {
    const countFlagIndex = args.findIndex(arg => arg === '-n' || arg.startsWith('-n'));
    let lineCount = '10';
    if (countFlagIndex >= 0) {
      const direct = args[countFlagIndex];
      lineCount = direct === '-n' ? args[countFlagIndex + 1] ?? lineCount : direct.replace('-n', '') || lineCount;
    }
    const files = targets.length > 0 ? ` from ${targets.join(', ')}` : '';
    return `${bin === 'head' ? 'Shows first' : 'Shows last'} ${lineCount} line(s)${files}.`;
  }

  if (bin === 'tar') {
    if (flags.some(flag => flag.includes('x'))) return 'Extracts files from a tar archive.';
    if (flags.some(flag => flag.includes('c'))) return 'Creates a tar archive from files/directories.';
    return 'Creates or extracts tar archives.';
  }

  if (bin === 'sed') {
    const expression = targets[0];
    const files = targets.slice(1);
    const scope = files.length > 0 ? ` on ${files.join(', ')}` : '';
    if (!expression) return 'Applies text transformations to input.';
    if (flags.includes('-i') || flags.includes('--in-place')) {
      return `Applies sed expression '${expression}' in-place${scope}.`;
    }
    return `Applies sed expression '${expression}'${scope}.`;
  }

  if (bin === 'awk') {
    const program = targets[0];
    const files = targets.slice(1);
    const fileText = files.length > 0 ? ` over ${files.join(', ')}` : '';
    if (!program) return 'Processes and extracts structured text data.';
    return `Runs awk program '${program}'${fileText}.`;
  }

  if (bin === 'jq') {
    const filter = targets[0];
    const files = targets.slice(1);
    if (!filter) return 'Filters/transforms JSON from stdin or files.';
    const fileText = files.length > 0 ? ` on ${files.join(', ')}` : ' on JSON input';
    return `Applies jq filter '${filter}'${fileText}.`;
  }

  if (bin === 'curl') {
    const methodIndex = args.findIndex(arg => arg === '-X' || arg === '--request');
    const method = methodIndex >= 0 ? args[methodIndex + 1] : 'GET';
    const url = targets.find(target => /^https?:\/\//.test(target));
    if (url) return `Makes an HTTP ${method} request to ${url}.`;
    return `Makes an HTTP ${method} request from the terminal.`;
  }

  if (bin === 'ssh') {
    const destination = targets.find(target => !target.startsWith('-'));
    if (destination) return `Connects to remote host '${destination}' over SSH.`;
    return 'Connects to a remote machine over SSH.';
  }

  if (bin === 'scp') {
    if (targets.length >= 2) {
      return `Copies ${targets.slice(0, -1).join(', ')} to ${targets[targets.length - 1]} over SSH.`;
    }
    return 'Copies files over SSH.';
  }

  if (bin === 'rsync') {
    if (targets.length >= 2) {
      return `Synchronizes ${targets.slice(0, -1).join(', ')} to ${targets[targets.length - 1]}.`;
    }
    return 'Syncs files/directories efficiently.';
  }

  if (bin === 'ping') {
    const host = targets.find(target => !target.startsWith('-'));
    const countIndex = args.findIndex(arg => arg === '-c');
    const count = countIndex >= 0 ? args[countIndex + 1] : null;
    if (host && count) return `Sends ${count} ICMP ping request(s) to ${host}.`;
    if (host) return `Sends ICMP ping requests to ${host}.`;
    return 'Sends ICMP echo packets to test connectivity.';
  }

  if (bin === 'ps') {
    if (flags.includes('-ef')) return 'Lists all running processes in full-format view.';
    if (flags.some(flag => flag.includes('a')) || flags.some(flag => flag.includes('x'))) {
      return 'Lists running processes, including processes not attached to your terminal.';
    }
    return 'Lists running processes.';
  }

  if (bin === 'kill') {
    const signalFlag = flags.find(flag => /^-\d+$/.test(flag) || /^-SIG/.test(flag));
    if (targets.length === 0) return 'Stops a process by PID.';
    const signalText = signalFlag ? ` using signal ${signalFlag}` : '';
    return `Sends a termination signal${signalText} to PID(s): ${targets.join(', ')}.`;
  }

  if (bin === 'du') {
    const scope = targets.length > 0 ? targets.join(', ') : 'the current directory';
    const human = flags.some(flag => flag.includes('h')) ? ' with human-readable sizes' : '';
    const summarize = flags.some(flag => flag.includes('s')) ? ' (summary only)' : '';
    return `Estimates disk usage for ${scope}${human}${summarize}.`;
  }

  if (bin === 'df') {
    const human = flags.some(flag => flag.includes('h')) ? ' with human-readable units' : '';
    return `Shows filesystem disk space usage${human}.`;
  }

  if (bin === 'systemctl') {
    const action = targets[0];
    const unit = targets[1];
    if (action && unit) return `Runs 'systemctl ${action}' on service/unit '${unit}'.`;
    if (action) return `Runs systemctl action '${action}'.`;
    return 'Manages systemd services and system state.';
  }

  if (bin === 'docker') {
    const sub = args[0];
    if (sub === 'run') {
      const image = targets[1];
      if (image) return `Starts a new container from image '${image}'.`;
      return 'Starts a new container from an image.';
    }
    if (sub === 'exec') {
      const container = targets[1];
      if (container) return `Runs a command inside running container '${container}'.`;
    }
  }

  if (bin === 'chmod') {
    if (targets.length >= 2) return `Changes permissions to '${targets[0]}' for ${targets.slice(1).join(', ')}.`;
    return 'Changes file permissions.';
  }

  if (bin === 'chown') {
    if (targets.length >= 2) return `Changes owner/group to '${targets[0]}' for ${targets.slice(1).join(', ')}.`;
    return 'Changes file owner/group.';
  }

  if (bin === 'git') {
    const sub = args[0];
    if (sub === 'checkout' || sub === 'switch') {
      const branch = args.find(arg => !arg.startsWith('-') && arg !== sub);
      if (branch) return `Switches to branch or target '${branch}'.`;
    }
    if (sub === 'commit') {
      const messageIndex = args.findIndex(arg => arg === '-m' || arg === '--message');
      const message = messageIndex >= 0 ? args[messageIndex + 1] : null;
      if (message) return `Creates a commit with message ${message}.`;
      return 'Creates a commit with staged changes.';
    }
    if (sub === 'log') {
      if (flags.includes('--oneline')) return 'Shows compact one-line commit history.';
      return 'Shows commit history.';
    }
  }

  return null;
}

function explainSingleCommand(command: string): string {
  const trimmed = command.trim();
  if (!trimmed) return 'Runs a shell command in the current project environment.';

  if (EXACT_COMMAND_HELP[trimmed]) return EXACT_COMMAND_HELP[trimmed];

  const [rawBin, ...rest] = trimmed.split(/\s+/);
  if (rawBin === 'sudo' && rest.length > 0) {
    const nested = rest.join(' ');
    return `Runs with elevated privileges (sudo). Underlying command: ${explainSingleCommand(nested)}`;
  }
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

  const contextual = explainContextualCommand(bin, rest);
  if (contextual) return contextual;

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

  if (bin === 'yarn') {
    return explainPackageManagerCommand('yarn', rest, YARN_SUBCOMMAND_HELP, COMMAND_HELP.yarn, {
      runMeansScript: true,
      installSubcommands: ['add', 'install'],
    });
  }

  if (bin === 'kubectl') {
    return explainPackageManagerCommand('kubectl', rest, KUBECTL_SUBCOMMAND_HELP, COMMAND_HELP.kubectl);
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

  const syntaxNotes = summarizeShellSyntax(trimmed);
  if (syntaxNotes.length > 0) {
    return `Runs the '${bin}' command in the project shell. ${syntaxNotes.join(' ')}`;
  }

  if (bin.startsWith('./') || bin.startsWith('/')) {
    return 'Executes a script/binary from a direct filesystem path.';
  }

  return `Runs the '${bin}' command in the project shell.`;
}

function explainCommandChain(command: string): string | null {
  const chainOperatorPattern = /\s*(\&\&|\|\||\||;)\s*/;
  if (!chainOperatorPattern.test(command)) return null;
  const tokens = command.split(chainOperatorPattern).map(token => token.trim()).filter(Boolean);
  if (tokens.length === 0) return null;

  const explainedParts: string[] = [];
  let commandIndex = 1;
  for (const token of tokens) {
    if (CHAIN_OPERATOR_HELP[token]) {
      explainedParts.push(`Operator '${token}': ${CHAIN_OPERATOR_HELP[token]}`);
      continue;
    }

    explainedParts.push(`Command ${commandIndex} ('${token}'): ${explainSingleCommand(token)}`);
    commandIndex += 1;
  }

  return explainedParts.join(' ');
}

export function explainShellCommand(command: string): string {
  const trimmed = command.trim();
  if (!trimmed) return 'Runs a shell command in the current project environment.';

  const chainExplanation = explainCommandChain(trimmed);
  if (chainExplanation) return chainExplanation;

  return explainSingleCommand(trimmed);
}
