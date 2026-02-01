import { useState, useMemo } from 'react';
import { Package, Search, Plus, Trash2, ExternalLink, AlertCircle } from 'lucide-react';
import { FileNode } from '@/types/ide';
import { cn } from '@/lib/utils';

interface PackagePanelProps {
  files: FileNode[];
  currentLanguage: string;
}

interface DetectedPackage {
  name: string;
  source: string;
  fileName: string;
}

// Popular packages by language
const popularPackages: Record<string, { name: string; description: string }[]> = {
  javascript: [
    { name: 'lodash', description: 'Utility library' },
    { name: 'axios', description: 'HTTP client' },
    { name: 'moment', description: 'Date manipulation' },
    { name: 'uuid', description: 'UUID generation' },
    { name: 'chalk', description: 'Terminal styling' },
  ],
  typescript: [
    { name: 'lodash', description: 'Utility library' },
    { name: 'axios', description: 'HTTP client' },
    { name: 'zod', description: 'Schema validation' },
    { name: 'date-fns', description: 'Date utilities' },
    { name: 'uuid', description: 'UUID generation' },
  ],
  python: [
    { name: 'requests', description: 'HTTP library' },
    { name: 'numpy', description: 'Numerical computing' },
    { name: 'pandas', description: 'Data analysis' },
    { name: 'flask', description: 'Web framework' },
    { name: 'pytest', description: 'Testing framework' },
  ],
  ruby: [
    { name: 'rails', description: 'Web framework' },
    { name: 'sinatra', description: 'Micro framework' },
    { name: 'nokogiri', description: 'HTML/XML parser' },
    { name: 'rspec', description: 'Testing framework' },
    { name: 'pry', description: 'REPL/debugger' },
  ],
  go: [
    { name: 'gin', description: 'Web framework' },
    { name: 'gorm', description: 'ORM library' },
    { name: 'viper', description: 'Configuration' },
    { name: 'cobra', description: 'CLI framework' },
    { name: 'testify', description: 'Testing toolkit' },
  ],
  rust: [
    { name: 'serde', description: 'Serialization' },
    { name: 'tokio', description: 'Async runtime' },
    { name: 'reqwest', description: 'HTTP client' },
    { name: 'clap', description: 'CLI parser' },
    { name: 'anyhow', description: 'Error handling' },
  ],
  java: [
    { name: 'spring-boot', description: 'Web framework' },
    { name: 'jackson', description: 'JSON processing' },
    { name: 'lombok', description: 'Boilerplate reducer' },
    { name: 'junit', description: 'Testing framework' },
    { name: 'slf4j', description: 'Logging facade' },
  ],
  php: [
    { name: 'laravel', description: 'Web framework' },
    { name: 'symfony', description: 'Component library' },
    { name: 'guzzle', description: 'HTTP client' },
    { name: 'phpunit', description: 'Testing framework' },
    { name: 'monolog', description: 'Logging library' },
  ],
};

// Detect imports from file content
const detectImports = (content: string, language: string): string[] => {
  const imports: string[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    // JavaScript/TypeScript imports
    if (language === 'javascript' || language === 'typescript') {
      // import x from 'package'
      const importMatch = line.match(/import\s+.*?\s+from\s+['"]([^./][^'"]*)['"]/);
      if (importMatch) imports.push(importMatch[1].split('/')[0]);
      
      // require('package')
      const requireMatch = line.match(/require\s*\(\s*['"]([^./][^'"]*)['"]\s*\)/);
      if (requireMatch) imports.push(requireMatch[1].split('/')[0]);
    }
    
    // Python imports
    if (language === 'python') {
      // import package
      const importMatch = line.match(/^import\s+(\w+)/);
      if (importMatch) imports.push(importMatch[1]);
      
      // from package import ...
      const fromMatch = line.match(/^from\s+(\w+)/);
      if (fromMatch) imports.push(fromMatch[1]);
    }
    
    // Ruby requires
    if (language === 'ruby') {
      const requireMatch = line.match(/require\s+['"]([^'"]+)['"]/);
      if (requireMatch) imports.push(requireMatch[1]);
      
      const gemMatch = line.match(/gem\s+['"]([^'"]+)['"]/);
      if (gemMatch) imports.push(gemMatch[1]);
    }
    
    // Go imports
    if (language === 'go') {
      const importMatch = line.match(/["']([^"']+)["']/);
      if (importMatch && line.includes('import')) {
        const pkg = importMatch[1].split('/').pop() || importMatch[1];
        imports.push(pkg);
      }
    }
    
    // Rust use
    if (language === 'rust') {
      const useMatch = line.match(/^use\s+(\w+)/);
      if (useMatch) imports.push(useMatch[1]);
      
      // extern crate
      const externMatch = line.match(/extern\s+crate\s+(\w+)/);
      if (externMatch) imports.push(externMatch[1]);
    }
    
    // Java imports
    if (language === 'java') {
      const importMatch = line.match(/^import\s+(?:static\s+)?([a-z][a-z0-9]*)\./i);
      if (importMatch) imports.push(importMatch[1]);
    }
    
    // PHP use
    if (language === 'php') {
      const useMatch = line.match(/^use\s+([A-Z][a-zA-Z0-9]*)/);
      if (useMatch) imports.push(useMatch[1]);
    }
  }
  
  return [...new Set(imports)];
};

// Standard library packages to exclude
const stdLibPackages: Record<string, string[]> = {
  python: ['os', 'sys', 'json', 'time', 'datetime', 'random', 'math', 're', 'collections', 'functools', 'itertools', 'typing', 'pathlib', 'io', 'subprocess', 'threading', 'multiprocessing'],
  javascript: ['fs', 'path', 'http', 'https', 'url', 'crypto', 'os', 'util', 'events', 'stream', 'buffer', 'child_process'],
  typescript: ['fs', 'path', 'http', 'https', 'url', 'crypto', 'os', 'util', 'events', 'stream', 'buffer', 'child_process'],
  go: ['fmt', 'os', 'io', 'strings', 'strconv', 'time', 'net', 'http', 'json', 'encoding', 'bytes', 'bufio', 'sync', 'context', 'errors'],
  rust: ['std', 'core', 'alloc'],
  java: ['java', 'javax', 'sun', 'com'],
  ruby: ['json', 'yaml', 'csv', 'net', 'uri', 'date', 'time', 'fileutils', 'pathname', 'set', 'ostruct'],
  php: ['Exception', 'Error', 'stdClass', 'DateTime', 'DateTimeImmutable', 'ArrayObject'],
};

export const PackagePanel = ({ files, currentLanguage }: PackagePanelProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [installedPackages, setInstalledPackages] = useState<string[]>([]);

  // Flatten files
  const getAllFiles = (nodes: FileNode[]): FileNode[] => {
    const result: FileNode[] = [];
    const traverse = (items: FileNode[]) => {
      for (const item of items) {
        if (item.type === 'file') result.push(item);
        if (item.children) traverse(item.children);
      }
    };
    traverse(nodes);
    return result;
  };

  // Detect packages from all files
  const detectedPackages = useMemo((): DetectedPackage[] => {
    const allFiles = getAllFiles(files);
    const packages: DetectedPackage[] = [];
    const seen = new Set<string>();
    const stdLib = stdLibPackages[currentLanguage] || [];

    for (const file of allFiles) {
      if (!file.content || !file.language) continue;
      
      const imports = detectImports(file.content, file.language);
      for (const pkg of imports) {
        if (!seen.has(pkg) && !stdLib.includes(pkg.toLowerCase())) {
          seen.add(pkg);
          packages.push({
            name: pkg,
            source: 'detected',
            fileName: file.name,
          });
        }
      }
    }

    return packages;
  }, [files, currentLanguage]);

  // Combined packages (detected + manually installed)
  const allPackages = useMemo(() => {
    const combined = [...detectedPackages];
    for (const pkg of installedPackages) {
      if (!combined.find(p => p.name === pkg)) {
        combined.push({ name: pkg, source: 'installed', fileName: '' });
      }
    }
    return combined;
  }, [detectedPackages, installedPackages]);

  // Available suggestions
  const suggestions = popularPackages[currentLanguage] || popularPackages.javascript;
  const filteredSuggestions = suggestions.filter(
    pkg => 
      pkg.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !allPackages.find(p => p.name.toLowerCase() === pkg.name.toLowerCase())
  );

  const handleAddPackage = (name: string) => {
    if (!installedPackages.includes(name)) {
      setInstalledPackages([...installedPackages, name]);
    }
    setSearchQuery('');
  };

  const handleRemovePackage = (name: string) => {
    setInstalledPackages(installedPackages.filter(p => p !== name));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search packages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-input border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto ide-scrollbar">
        {/* Installed/Detected Packages */}
        {allPackages.length > 0 && (
          <div className="p-3 border-b border-border">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Dependencies ({allPackages.length})
            </h3>
            <div className="space-y-1">
              {allPackages.map((pkg) => (
                <div
                  key={pkg.name}
                  className="flex items-center justify-between p-2 rounded-md bg-accent/50 group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Package className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm truncate">{pkg.name}</span>
                    {pkg.source === 'detected' && (
                      <span className="text-xs text-muted-foreground">
                        ({pkg.fileName})
                      </span>
                    )}
                  </div>
                  {pkg.source === 'installed' && (
                    <button
                      onClick={() => handleRemovePackage(pkg.name)}
                      className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search Results / Suggestions */}
        <div className="p-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {searchQuery ? 'Search Results' : 'Popular Packages'}
          </h3>
          
          {filteredSuggestions.length > 0 ? (
            <div className="space-y-1">
              {filteredSuggestions.map((pkg) => (
                <button
                  key={pkg.name}
                  onClick={() => handleAddPackage(pkg.name)}
                  className="w-full flex items-center justify-between p-2 rounded-md hover:bg-accent text-left group"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{pkg.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground ml-6 truncate">
                      {pkg.description}
                    </p>
                  </div>
                  <Plus className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              ))}
            </div>
          ) : searchQuery ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No packages found for "{searchQuery}"
            </p>
          ) : null}
        </div>

        {/* Info notice */}
        <div className="p-3 mx-3 mb-3 rounded-md bg-muted/50 border border-border">
          <div className="flex gap-2">
            <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground">
              <p className="font-medium mb-1">Sandbox Limitations</p>
              <p>
                The code execution sandbox has limited package support. 
                Standard library packages work, but external packages may not be available.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
