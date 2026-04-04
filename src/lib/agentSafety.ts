import { getPlaybooksForRule, type SafetyPlaybook } from '@/data/safetyPlaybooks';

export type CommandRiskLevel = 'safe' | 'low' | 'medium' | 'high' | 'critical';

export interface SafetyRule {
  id: string;
  label: string;
  description: string;
  severity: Exclude<CommandRiskLevel, 'safe'>;
  pattern: RegExp;
  reason: string;
  saferAlternative?: string;
}

export interface ShellCommandRiskMatch {
  ruleId: string;
  label: string;
  severity: Exclude<CommandRiskLevel, 'safe'>;
  reason: string;
  saferAlternative?: string;
}

export interface ShellCommandSafetyReport {
  command: string;
  normalizedCommand: string;
  riskLevel: CommandRiskLevel;
  isBlocked: boolean;
  confidence: number;
  matches: ShellCommandRiskMatch[];
  playbooks: SafetyPlaybook[];
  summary: string;
}

const SHELL_CHAIN_OPERATORS = ['&&', '||', ';', '|'];

const mkRule = (
  id: string,
  label: string,
  severity: Exclude<CommandRiskLevel, 'safe'>,
  pattern: RegExp,
  reason: string,
  saferAlternative?: string,
): SafetyRule => ({
  id,
  label,
  description: label,
  severity,
  pattern,
  reason,
  saferAlternative,
});

const RULES: SafetyRule[] = [
  mkRule('delete-root-rm-rf', 'Recursive force delete from root-like path', 'critical', /\brm\s+-[^\n]*r[^\n]*f[^\n]*(\s+\/\b|\s+~\b|\s+\$HOME\b|\s+\.\.)/i, 'Recursive deletion targeting root/home paths can wipe the machine.', 'Use a specific project directory and preview with `find` first.'),
  mkRule('delete-rm-rf', 'Recursive force delete', 'high', /\brm\s+-[^\n]*r[^\n]*f\b/i, 'Recursive force deletion removes files without prompts.', 'Use `rm -ri` in a constrained folder.'),
  mkRule('delete-rm-wildcard', 'Wildcard delete from current directory', 'high', /\brm\s+-[^\n]*f[^\n]*\s+\*\b/i, 'Wildcard deletes can accidentally remove broad sets of files.', 'Use explicit file paths and review with `ls` first.'),
  mkRule('delete-find-exec-rm', 'find with exec rm', 'high', /\bfind\b[^\n]*-exec\s+rm\b/i, 'Batch delete via find can match more than intended.', 'Try `find ... -print` before deleting.'),
  mkRule('delete-rsync-delete', 'rsync delete mirror', 'high', /\brsync\b[^\n]*--delete\b/i, 'Mirroring with --delete removes destination files that do not exist in source.', 'Run with `--dry-run` before applying changes.'),
  mkRule('disk-format-mkfs', 'Disk format command', 'critical', /\bmkfs(\.[a-z0-9]+)?\b/i, 'Formatting a filesystem is destructive and often irreversible.'),
  mkRule('disk-dd-if', 'Raw disk write/read with dd', 'critical', /\bdd\b[^\n]*\bif=|\bdd\b[^\n]*\bof=/i, 'dd can overwrite entire disks if device paths are wrong.', 'Use safer tooling and confirm the target disk multiple times.'),
  mkRule('disk-shred', 'Secure deletion with shred', 'critical', /\bshred\b/i, 'shred permanently destroys file contents.'),
  mkRule('disk-wipefs', 'Filesystem signature wipe', 'critical', /\bwipefs\b/i, 'wipefs removes filesystem signatures and can make volumes unmountable.'),
  mkRule('disk-fdisk-write', 'fdisk write command', 'critical', /\bfdisk\b[^\n]*\b\/dev\//i, 'Partition table edits can make systems unbootable.'),
  mkRule('disk-parted', 'parted partition edits', 'critical', /\bparted\b[^\n]*\b\/dev\//i, 'Partition editing is high risk on active systems.'),
  mkRule('disk-zpool-destroy', 'zpool destroy', 'critical', /\bzpool\s+destroy\b/i, 'Destroying a zpool wipes access to the whole pool data set.'),
  mkRule('disk-lvremove', 'LVM remove', 'critical', /\blvremove\b/i, 'Removing LVM logical volumes can permanently destroy data.'),
  mkRule('disk-vgremove', 'Volume group remove', 'critical', /\bvgremove\b/i, 'Removing an LVM volume group can remove multiple volumes at once.'),
  mkRule('disk-pvremove', 'Physical volume remove', 'critical', /\bpvremove\b/i, 'Removing a physical volume signature can break storage configuration.'),
  mkRule('bootloader-grub-install', 'Bootloader installation', 'high', /\bgrub-install\b/i, 'Reinstalling the bootloader can make a machine unbootable if misconfigured.'),
  mkRule('bootloader-efibootmgr-delete', 'EFI boot entry delete', 'high', /\befibootmgr\b[^\n]*-B\b/i, 'Deleting EFI boot entries can break startup.'),
  mkRule('power-shutdown', 'Shutdown command', 'medium', /\bshutdown\b/i, 'Shutdown disrupts active sessions and can interrupt critical tasks.'),
  mkRule('power-reboot', 'Reboot command', 'medium', /\breboot\b/i, 'Reboot disrupts active sessions and can interrupt critical tasks.'),
  mkRule('power-poweroff', 'Power off command', 'medium', /\bpoweroff\b/i, 'Poweroff terminates current processes.'),
  mkRule('users-deluser', 'Delete user account', 'high', /\b(userdel|deluser)\b/i, 'Deleting user accounts can remove access and potentially home directories.'),
  mkRule('users-passwd-root-lock', 'Lock root account', 'high', /\bpasswd\b[^\n]*\s+-l\s+root\b/i, 'Locking root account may block emergency administration.'),
  mkRule('users-chown-recursive-root', 'Recursive chown on root paths', 'high', /\bchown\b\s+-R\b[^\n]*(\s+\/\b|\s+~\b|\s+\$HOME\b)/i, 'Recursive ownership changes on system paths can break permissions.'),
  mkRule('users-chmod-777-recursive', 'chmod 777 recursively', 'high', /\bchmod\b\s+-R\s+777\b/i, 'World-writable recursive permissions are a major security risk.'),
  mkRule('users-sudoers-edit', 'Direct sudoers modification', 'high', /\b(vi|vim|nano|echo|cat)\b[^\n]*\/etc\/sudoers\b/i, 'Editing sudoers incorrectly can lock out privileged access.', 'Use `visudo` for syntax validation.'),
  mkRule('network-curl-pipe-shell', 'Pipe curl response to shell', 'critical', /\bcurl\b[^\n]*\|\s*(sh|bash|zsh|fish|ksh)\b/i, 'Piping remote scripts directly to a shell executes untrusted code.', 'Download and inspect scripts before execution.'),
  mkRule('network-wget-pipe-shell', 'Pipe wget response to shell', 'critical', /\bwget\b[^\n]*\|\s*(sh|bash|zsh|fish|ksh)\b/i, 'Piping remote scripts directly to a shell executes untrusted code.', 'Download and inspect scripts before execution.'),
  mkRule('network-nc-shell', 'Bind/reverse shell via netcat', 'critical', /\bnc\b[^\n]*\s+-e\s+(\/bin\/sh|\/bin\/bash)/i, 'Netcat shell execution can expose remote command access.'),
  mkRule('network-socat-shell', 'Remote shell via socat', 'critical', /\bsocat\b[^\n]*(exec:|pty,stderr)/i, 'Socat shell relays are commonly used for reverse shell behavior.'),
  mkRule('network-python-reverse-shell', 'Python reverse shell one-liner', 'critical', /python[23]?\s+-c\s+["'][^\n]*(socket|subprocess|pty)[^\n]*["']/i, 'Inline Python socket shell patterns can establish remote command channels.'),
  mkRule('network-openssl-enc', 'OpenSSL encrypted exfiltration style command', 'high', /\bopenssl\b[^\n]*\b(enc|s_client)\b/i, 'OpenSSL pipeline usage can conceal unexpected data transfer.'),
  mkRule('network-ssh-keyscan-known-hosts', 'Bulk rewrite known_hosts', 'medium', /\bssh-keyscan\b[^\n]*>>?\s*~\/\.ssh\/known_hosts\b/i, 'Blindly appending host keys can trust spoofed hosts.'),
  mkRule('container-docker-prune-all', 'Docker system prune all volumes', 'high', /\bdocker\b\s+system\s+prune\b[^\n]*--volumes\b[^\n]*-a\b|\bdocker\b\s+system\s+prune\b[^\n]*-a\b[^\n]*--volumes\b/i, 'Docker prune with -a and --volumes removes images, containers, and persistent volume data.'),
  mkRule('container-docker-rmi-force', 'Force remove docker images', 'medium', /\bdocker\b\s+rmi\b[^\n]*\s-f\b/i, 'Force-removing images may break dependent environments.'),
  mkRule('container-k8s-delete-all', 'Kubernetes delete all resources', 'critical', /\bkubectl\b[^\n]*\bdelete\b[^\n]*\ball\b[^\n]*(--all|-A|--namespace)/i, 'Mass delete in Kubernetes can remove production workloads.'),
  mkRule('container-k8s-drain-delete', 'Kubernetes node drain with delete', 'high', /\bkubectl\b[^\n]*\bdrain\b[^\n]*--delete-emptydir-data\b/i, 'Node drain deleting emptyDir data can disrupt services.'),
  mkRule('container-helm-uninstall', 'Helm uninstall command', 'medium', /\bhelm\b\s+uninstall\b/i, 'Uninstalling a Helm release removes deployed resources.'),
  mkRule('git-reset-hard', 'Git hard reset', 'medium', /\bgit\b\s+reset\s+--hard\b/i, 'Hard reset discards local changes.'),
  mkRule('git-clean-force', 'Git clean force', 'medium', /\bgit\b\s+clean\b[^\n]*\s-f\b/i, 'git clean -f removes untracked files.'),
  mkRule('git-push-force', 'Git force push', 'medium', /\bgit\b\s+push\b[^\n]*\s--force(?!-with-lease)\b/i, 'Force push can overwrite remote history.'),
  mkRule('git-filter-repo', 'Git history rewrite', 'high', /\bgit\b\s+filter-repo\b|\bgit\b\s+filter-branch\b/i, 'History rewrite can permanently alter repository state.'),
  mkRule('crypto-ransom-note-pattern', 'Potential ransomware command pattern', 'critical', /\bfor\b[^\n]*\bopenssl\b[^\n]*\benc\b[^\n]*\bmv\b/i, 'Bulk encryption loops are a ransomware-like behavior.'),
  mkRule('proc-killall', 'Kill all processes by name', 'high', /\bkillall\b\s+(-9\s+)?\S+/i, 'killall can abruptly terminate all matching processes.'),
  mkRule('proc-pkill', 'Process kill by pattern', 'medium', /\bpkill\b\s+(-9\s+)?\S+/i, 'pkill may terminate multiple unintended processes.'),
  mkRule('proc-kill-negative-group', 'Kill process group', 'high', /\bkill\b\s+-9\s+-\d+/i, 'Killing a process group can terminate many processes at once.'),
  mkRule('service-disable-security', 'Disable firewall/security service', 'high', /\b(systemctl|service)\b[^\n]*\b(stop|disable)\b[^\n]*(ufw|firewalld|selinux|apparmor)/i, 'Disabling host security services increases system exposure.'),
  mkRule('service-stop-database', 'Stop database service', 'medium', /\b(systemctl|service)\b[^\n]*\b(stop|restart)\b[^\n]*(mysql|postgres|mongod|redis)/i, 'Stopping data services can interrupt applications.'),
  mkRule('permissions-write-shadow', 'Modify /etc/shadow', 'critical', /\b(vi|vim|nano|sed|echo|cat)\b[^\n]*\/etc\/shadow\b/i, 'Direct edits to /etc/shadow can break authentication.'),
  mkRule('permissions-write-passwd', 'Modify /etc/passwd', 'high', /\b(vi|vim|nano|sed|echo|cat)\b[^\n]*\/etc\/passwd\b/i, 'Direct edits to /etc/passwd can break user identities.'),
  mkRule('filesystem-chattr-immutable', 'Set immutable flag recursively', 'high', /\bchattr\b[^\n]*\+i\b[^\n]*\s+-R\b|\bchattr\b[^\n]*\s+-R\b[^\n]*\+i\b/i, 'Recursive immutable attribute changes can lock file modifications.'),
  mkRule('filesystem-find-perm-exec-chmod', 'Bulk chmod via find', 'medium', /\bfind\b[^\n]*-exec\s+chmod\b/i, 'Bulk permission changes may alter more files than expected.'),
  mkRule('filesystem-find-perm-exec-chown', 'Bulk chown via find', 'medium', /\bfind\b[^\n]*-exec\s+chown\b/i, 'Bulk ownership changes may alter more files than expected.'),
  mkRule('filesystem-truncate-large', 'Truncate command on wildcard', 'high', /\btruncate\b[^\n]*\s-s\s+0\s+\*/i, 'Truncating wildcard files can destroy contents broadly.'),
  mkRule('env-history-clear', 'Clear shell history', 'low', /\bhistory\b\s+-c\b|\brm\b[^\n]*\.bash_history\b/i, 'History clearing can hide audit trails.'),
  mkRule('env-export-credentials', 'Potential credential export', 'medium', /\b(export|set)\b[^\n]*(AWS_SECRET_ACCESS_KEY|GITHUB_TOKEN|OPENAI_API_KEY|PASSWORD)=/i, 'Directly exporting credentials in shells can leak secrets in logs.'),
  mkRule('env-print-secrets', 'Print env secrets', 'medium', /\b(printenv|env)\b[^\n]*(SECRET|TOKEN|PASSWORD|KEY)/i, 'Printing environment secrets may leak credentials.'),
  mkRule('archive-tar-overwrite-root', 'Extract tar to root', 'high', /\btar\b[^\n]*\s-x[^\n]*\s+-C\s+\/(\s|$)/i, 'Extracting archives to root can overwrite system files.'),
  mkRule('archive-unzip-overwrite', 'Unzip overwrite all', 'medium', /\bunzip\b[^\n]*\s-o\b/i, 'Overwriting files from archives can replace important files.'),
  mkRule('package-apt-remove-essential', 'Remove essential apt packages', 'critical', /\bapt(-get)?\b[^\n]*\b(remove|purge)\b[^\n]*(--allow-remove-essential|linux-image|systemd)/i, 'Removing essential system packages can break the OS.'),
  mkRule('package-npm-postinstall-exec', 'npm lifecycle script ignore', 'high', /\bnpm\b\s+(install|ci)\b(?![^\n]*--ignore-scripts)/i, 'Installing dependencies with scripts may execute untrusted postinstall commands.', 'Use `npm ci --ignore-scripts` when evaluating unknown projects.'),
  mkRule('package-pip-exec-remote', 'Pip install from arbitrary URL', 'high', /\bpip\b[^\n]*\binstall\b[^\n]*(https?:\/\/|git\+)/i, 'Installing packages from direct URLs may bypass trusted indexes.'),
  mkRule('vm-virsh-destroy', 'Force-stop virtual machine', 'medium', /\bvirsh\b\s+destroy\b/i, 'Force-stopping VMs can cause data corruption.'),
  mkRule('db-drop-database', 'Drop database command', 'critical', /\b(drop\s+database|DROP\s+DATABASE)\b/i, 'Dropping a database permanently removes schema and data.'),
  mkRule('db-drop-table', 'Drop table command', 'high', /\b(drop\s+table|DROP\s+TABLE)\b/i, 'Dropping tables permanently removes data structures.'),
  mkRule('db-truncate-table', 'Truncate table command', 'high', /\b(truncate\s+table|TRUNCATE\s+TABLE)\b/i, 'Truncating tables removes all rows quickly.'),
  mkRule('cloud-aws-s3-rm-recursive', 'AWS S3 recursive delete', 'critical', /\baws\b\s+s3\s+rm\b[^\n]*--recursive\b/i, 'Recursive S3 deletion can remove entire buckets or prefixes.'),
  mkRule('cloud-aws-ec2-terminate', 'AWS EC2 terminate instances', 'critical', /\baws\b\s+ec2\s+terminate-instances\b/i, 'Terminating instances immediately stops and removes servers.'),
  mkRule('cloud-gcloud-delete', 'GCloud delete command', 'high', /\bgcloud\b[^\n]*\bdelete\b/i, 'Delete operations in cloud CLIs can remove critical resources.'),
  mkRule('cloud-az-delete', 'Azure delete command', 'high', /\baz\b[^\n]*\bdelete\b/i, 'Delete operations in Azure CLI can remove critical resources.'),
  mkRule('terraform-destroy', 'Terraform destroy', 'critical', /\bterraform\b\s+destroy\b/i, 'Terraform destroy will tear down managed infrastructure.'),
  mkRule('ansible-shell', 'Ansible ad-hoc shell', 'medium', /\bansible\b[^\n]*\s+-m\s+shell\b/i, 'Remote shell modules can execute dangerous commands across many hosts.'),
  mkRule('eval-command-substitution', 'Use of eval with substitution', 'high', /\beval\b\s+["']?\$\(/i, 'eval with command substitution can execute unintended input.'),
  mkRule('shell-forkbomb', 'Shell fork bomb', 'critical', /:\s*\(\)\s*\{\s*:\|:&\s*\};:/, 'Fork bombs can exhaust system resources immediately.'),
  mkRule('shell-redirection-dev-disk', 'Write redirection to block devices', 'critical', />\s*\/dev\/(sd[a-z]\d*|nvme\d+n\d+(p\d+)?|vd[a-z]\d*)/i, 'Redirecting output to block devices can corrupt disks.'),
  mkRule('shell-cp-root-overwrite', 'Copy recursively into root', 'high', /\bcp\b\s+-R\b[^\n]*\s+\/(\s|$)/i, 'Recursive copy into root can overwrite system content.'),
  mkRule('shell-mv-system', 'Move important system directories', 'critical', /\bmv\b[^\n]*(\/etc|\/bin|\/usr|\/lib)\b/i, 'Moving system directories can make the OS unstable.'),
  mkRule('shell-sed-inplace-etc', 'In-place edit in /etc', 'high', /\bsed\b[^\n]*-i[^\n]*\/etc\//i, 'In-place edits under /etc can break system configuration.'),
  mkRule('shell-chroot', 'chroot usage', 'medium', /\bchroot\b/i, 'chroot changes root context and can be risky without isolation controls.'),
  mkRule('shell-mount', 'Mount command', 'medium', /\bmount\b\s+\/dev\//i, 'Mounting block devices can impact active filesystems.'),
  mkRule('shell-umount-force', 'Forced unmount', 'high', /\bumount\b[^\n]*\s+-f\b/i, 'Forced unmount may cause data loss for busy filesystems.'),
  mkRule('shell-nohup-background-remote', 'Background remote fetch execution', 'high', /\bnohup\b[^\n]*(curl|wget)[^\n]*(sh|bash)/i, 'Detached remote script execution is hard to monitor and audit.'),
];

const severityToScore: Record<Exclude<CommandRiskLevel, 'safe'>, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const scoreToRiskLevel = (score: number): CommandRiskLevel => {
  if (score <= 0) return 'safe';
  if (score === 1) return 'low';
  if (score === 2) return 'medium';
  if (score === 3) return 'high';
  return 'critical';
};

const normalizeCommand = (command: string) => command.replace(/\s+/g, ' ').trim();

const splitCompositeCommands = (command: string): string[] => {
  const normalized = normalizeCommand(command);
  if (!normalized) return [];

  let parts = [normalized];
  for (const operator of SHELL_CHAIN_OPERATORS) {
    parts = parts.flatMap((part) => part.split(operator));
  }

  return parts.map((part) => part.trim()).filter(Boolean);
};

const evaluateSegment = (segment: string): ShellCommandRiskMatch[] => {
  const matches: ShellCommandRiskMatch[] = [];

  for (const rule of RULES) {
    if (rule.pattern.test(segment)) {
      matches.push({
        ruleId: rule.id,
        label: rule.label,
        severity: rule.severity,
        reason: rule.reason,
        saferAlternative: rule.saferAlternative,
      });
    }
  }

  return matches;
};

const dedupeMatches = (matches: ShellCommandRiskMatch[]): ShellCommandRiskMatch[] => {
  const byRule = new Map<string, ShellCommandRiskMatch>();
  for (const match of matches) {
    if (!byRule.has(match.ruleId)) {
      byRule.set(match.ruleId, match);
    }
  }
  return Array.from(byRule.values());
};

const selectPlaybooks = (matches: ShellCommandRiskMatch[]): SafetyPlaybook[] => {
  const byId = new Map<string, SafetyPlaybook>();
  for (const match of matches) {
    for (const playbook of getPlaybooksForRule(match.ruleId)) {
      if (!byId.has(playbook.id)) {
        byId.set(playbook.id, playbook);
      }
    }
  }
  return Array.from(byId.values());
};

const scoreMatches = (matches: ShellCommandRiskMatch[]): number => {
  if (matches.length === 0) return 0;
  return matches.reduce((max, match) => Math.max(max, severityToScore[match.severity]), 0);
};

const confidenceFromMatches = (matches: ShellCommandRiskMatch[], segments: number): number => {
  if (matches.length === 0) return 0.98;
  const base = 0.55 + Math.min(0.35, matches.length * 0.07);
  const segmentFactor = Math.min(0.1, Math.max(0, segments - 1) * 0.03);
  return Number(Math.min(0.99, base + segmentFactor).toFixed(2));
};

const buildSummary = (riskLevel: CommandRiskLevel, matches: ShellCommandRiskMatch[]): string => {
  if (riskLevel === 'safe') {
    return 'No known destructive shell patterns detected.';
  }

  const highest = matches
    .filter((match) => scoreMatches([match]) === scoreMatches(matches))
    .map((match) => match.label)
    .slice(0, 2);

  if (highest.length === 0) {
    return `Potentially ${riskLevel}-risk command detected.`;
  }

  return `Detected ${riskLevel}-risk behavior: ${highest.join(', ')}.`;
};

export function analyzeShellCommandSafety(command: string): ShellCommandSafetyReport {
  const normalizedCommand = normalizeCommand(command);

  if (!normalizedCommand) {
    return {
      command,
      normalizedCommand,
      riskLevel: 'safe',
      isBlocked: false,
      confidence: 0.99,
      matches: [],
      playbooks: [],
      summary: 'Empty command.',
    };
  }

  const segments = splitCompositeCommands(normalizedCommand);
  const allMatches = dedupeMatches(segments.flatMap((segment) => evaluateSegment(segment)));
  const severityScore = scoreMatches(allMatches);
  const riskLevel = scoreToRiskLevel(severityScore);
  const isBlocked = riskLevel === 'high' || riskLevel === 'critical';
  const playbooks = selectPlaybooks(allMatches);

  return {
    command,
    normalizedCommand,
    riskLevel,
    isBlocked,
    confidence: confidenceFromMatches(allMatches, segments.length),
    matches: allMatches,
    playbooks,
    summary: buildSummary(riskLevel, allMatches),
  };
}

export function isPotentiallyDestructiveShellCommand(command: string): boolean {
  return analyzeShellCommandSafety(command).isBlocked;
}

export function listShellSafetyRules(): SafetyRule[] {
  return RULES.map((rule) => ({ ...rule }));
}
