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
    { name: 'lodash', description: 'Utility library for arrays, objects, strings' },
    { name: 'axios', description: 'Promise-based HTTP client' },
    { name: 'express', description: 'Fast, minimalist web framework' },
    { name: 'moment', description: 'Date parsing and formatting' },
    { name: 'uuid', description: 'RFC-compliant UUID generation' },
    { name: 'chalk', description: 'Terminal string styling' },
    { name: 'dotenv', description: 'Load .env variables' },
    { name: 'cors', description: 'CORS middleware for Express' },
    { name: 'jsonwebtoken', description: 'JWT sign and verify' },
    { name: 'bcrypt', description: 'Password hashing' },
    { name: 'socket.io', description: 'Real-time bidirectional events' },
    { name: 'mongoose', description: 'MongoDB object modeling' },
    { name: 'node-fetch', description: 'Fetch API for Node.js' },
    { name: 'commander', description: 'CLI interface builder' },
    { name: 'inquirer', description: 'Interactive CLI prompts' },
    { name: 'dayjs', description: 'Lightweight date library' },
    { name: 'ramda', description: 'Functional programming utilities' },
    { name: 'cheerio', description: 'Server-side HTML parsing' },
    { name: 'winston', description: 'Logging library' },
    { name: 'yargs', description: 'CLI argument parser' },
  ],
  typescript: [
    { name: 'lodash', description: 'Utility library' },
    { name: 'axios', description: 'Promise-based HTTP client' },
    { name: 'zod', description: 'TypeScript-first schema validation' },
    { name: 'date-fns', description: 'Modern date utility library' },
    { name: 'uuid', description: 'UUID generation' },
    { name: 'express', description: 'Web framework' },
    { name: 'prisma', description: 'Next-gen ORM for databases' },
    { name: 'tsx', description: 'TypeScript execute & watch' },
    { name: 'ts-node', description: 'TypeScript execution environment' },
    { name: 'type-fest', description: 'Essential TypeScript types' },
    { name: 'io-ts', description: 'Runtime type validation' },
    { name: 'fp-ts', description: 'Functional programming in TS' },
    { name: 'neverthrow', description: 'Type-safe error handling' },
    { name: 'superjson', description: 'JSON serialization with types' },
    { name: 'nanoid', description: 'Tiny unique string ID generator' },
    { name: 'effect', description: 'Effect system for TypeScript' },
  ],
  python: [
    { name: 'requests', description: 'HTTP library for humans' },
    { name: 'numpy', description: 'Numerical computing' },
    { name: 'pandas', description: 'Data analysis & manipulation' },
    { name: 'flask', description: 'Lightweight web framework' },
    { name: 'django', description: 'Full-featured web framework' },
    { name: 'fastapi', description: 'Modern async web framework' },
    { name: 'pytest', description: 'Testing framework' },
    { name: 'beautifulsoup4', description: 'HTML/XML parser' },
    { name: 'sqlalchemy', description: 'SQL toolkit & ORM' },
    { name: 'celery', description: 'Distributed task queue' },
    { name: 'pillow', description: 'Image processing' },
    { name: 'matplotlib', description: 'Data visualization' },
    { name: 'scipy', description: 'Scientific computing' },
    { name: 'scikit-learn', description: 'Machine learning' },
    { name: 'pydantic', description: 'Data validation with types' },
    { name: 'httpx', description: 'Async HTTP client' },
    { name: 'click', description: 'CLI creation toolkit' },
    { name: 'rich', description: 'Rich text terminal formatting' },
    { name: 'black', description: 'Code formatter' },
    { name: 'mypy', description: 'Static type checker' },
  ],
  ruby: [
    { name: 'rails', description: 'Full-stack web framework' },
    { name: 'sinatra', description: 'Lightweight web framework' },
    { name: 'nokogiri', description: 'HTML/XML parser' },
    { name: 'rspec', description: 'BDD testing framework' },
    { name: 'pry', description: 'Powerful REPL & debugger' },
    { name: 'devise', description: 'Authentication solution' },
    { name: 'sidekiq', description: 'Background job processing' },
    { name: 'httparty', description: 'HTTP client' },
    { name: 'rubocop', description: 'Code linter & formatter' },
    { name: 'faker', description: 'Fake data generator' },
    { name: 'pg', description: 'PostgreSQL adapter' },
    { name: 'redis', description: 'Redis client' },
  ],
  go: [
    { name: 'gin', description: 'High-performance web framework' },
    { name: 'gorm', description: 'Full-featured ORM' },
    { name: 'viper', description: 'Configuration management' },
    { name: 'cobra', description: 'CLI application framework' },
    { name: 'testify', description: 'Testing toolkit' },
    { name: 'fiber', description: 'Express-inspired web framework' },
    { name: 'echo', description: 'High perf web framework' },
    { name: 'zap', description: 'Blazing fast structured logger' },
    { name: 'wire', description: 'Compile-time dependency injection' },
    { name: 'go-redis', description: 'Redis client' },
    { name: 'sqlx', description: 'Extensions to database/sql' },
    { name: 'chi', description: 'Lightweight HTTP router' },
  ],
  rust: [
    { name: 'serde', description: 'Serialization framework' },
    { name: 'tokio', description: 'Async runtime' },
    { name: 'reqwest', description: 'Async HTTP client' },
    { name: 'clap', description: 'CLI argument parser' },
    { name: 'anyhow', description: 'Flexible error handling' },
    { name: 'thiserror', description: 'Derive macro for errors' },
    { name: 'actix-web', description: 'Powerful web framework' },
    { name: 'axum', description: 'Ergonomic web framework' },
    { name: 'diesel', description: 'Safe, extensible ORM' },
    { name: 'tracing', description: 'Application-level tracing' },
    { name: 'rayon', description: 'Data parallelism library' },
    { name: 'itertools', description: 'Extra iterator adaptors' },
  ],
  java: [
    { name: 'spring-boot', description: 'Production-ready framework' },
    { name: 'jackson', description: 'JSON processing' },
    { name: 'lombok', description: 'Boilerplate reducer' },
    { name: 'junit', description: 'Testing framework' },
    { name: 'slf4j', description: 'Logging facade' },
    { name: 'guava', description: 'Google core libraries' },
    { name: 'hibernate', description: 'ORM framework' },
    { name: 'mockito', description: 'Mocking framework' },
    { name: 'netty', description: 'Async event-driven networking' },
    { name: 'retrofit', description: 'Type-safe HTTP client' },
    { name: 'gson', description: 'JSON serialization by Google' },
    { name: 'apache-commons', description: 'Reusable Java components' },
  ],
  php: [
    { name: 'laravel', description: 'Elegant web framework' },
    { name: 'symfony', description: 'Component-based framework' },
    { name: 'guzzle', description: 'HTTP client' },
    { name: 'phpunit', description: 'Testing framework' },
    { name: 'monolog', description: 'Logging library' },
    { name: 'carbon', description: 'Date/time library' },
    { name: 'doctrine', description: 'Database ORM' },
    { name: 'faker', description: 'Fake data generator' },
    { name: 'predis', description: 'Redis client' },
    { name: 'twig', description: 'Template engine' },
  ],
  cpp: [
    { name: 'boost', description: 'Portable C++ libraries' },
    { name: 'fmt', description: 'Modern formatting library' },
    { name: 'nlohmann-json', description: 'JSON for modern C++' },
    { name: 'catch2', description: 'Unit testing framework' },
    { name: 'spdlog', description: 'Fast logging library' },
    { name: 'eigen', description: 'Linear algebra library' },
    { name: 'opencv', description: 'Computer vision library' },
    { name: 'grpc', description: 'RPC framework' },
  ],
  c: [
    { name: 'curl', description: 'HTTP client library' },
    { name: 'openssl', description: 'Cryptography toolkit' },
    { name: 'sqlite3', description: 'Embedded SQL database' },
    { name: 'jansson', description: 'JSON encoding/decoding' },
    { name: 'zlib', description: 'Compression library' },
    { name: 'check', description: 'Unit testing framework' },
  ],
  swift: [
    { name: 'Alamofire', description: 'HTTP networking library' },
    { name: 'SwiftyJSON', description: 'JSON handling' },
    { name: 'Kingfisher', description: 'Image downloading & caching' },
    { name: 'SnapKit', description: 'Auto Layout DSL' },
    { name: 'RxSwift', description: 'Reactive programming' },
    { name: 'Vapor', description: 'Server-side Swift framework' },
  ],
  kotlin: [
    { name: 'ktor', description: 'Async web framework' },
    { name: 'kotlinx-coroutines', description: 'Coroutines support' },
    { name: 'kotlinx-serialization', description: 'Multiplatform serialization' },
    { name: 'exposed', description: 'SQL library & ORM' },
    { name: 'koin', description: 'Dependency injection' },
    { name: 'arrow', description: 'Functional programming' },
  ],
  csharp: [
    { name: 'Newtonsoft.Json', description: 'JSON framework' },
    { name: 'Dapper', description: 'Micro ORM' },
    { name: 'AutoMapper', description: 'Object-object mapper' },
    { name: 'xUnit', description: 'Unit testing tool' },
    { name: 'Serilog', description: 'Structured logging' },
    { name: 'MediatR', description: 'Mediator pattern impl' },
  ],
  elixir: [
    { name: 'phoenix', description: 'Web framework' },
    { name: 'ecto', description: 'Database wrapper & query' },
    { name: 'jason', description: 'JSON parser' },
    { name: 'tesla', description: 'HTTP client' },
    { name: 'oban', description: 'Background job processing' },
    { name: 'absinthe', description: 'GraphQL toolkit' },
  ],
  dart: [
    { name: 'http', description: 'HTTP client' },
    { name: 'dio', description: 'Powerful HTTP client' },
    { name: 'provider', description: 'State management' },
    { name: 'riverpod', description: 'Reactive state management' },
    { name: 'freezed', description: 'Code generation for immutable classes' },
    { name: 'shelf', description: 'Web server middleware' },
  ],
  scala: [
    { name: 'akka', description: 'Actor-based concurrency' },
    { name: 'play', description: 'Web framework' },
    { name: 'cats', description: 'Functional programming' },
    { name: 'circe', description: 'JSON library' },
    { name: 'http4s', description: 'Typeful HTTP library' },
    { name: 'zio', description: 'Type-safe effects' },
  ],
  lua: [
    { name: 'luasocket', description: 'Network support' },
    { name: 'lfs', description: 'File system library' },
    { name: 'lpeg', description: 'Pattern matching' },
    { name: 'penlight', description: 'Utility libraries' },
    { name: 'luarocks', description: 'Package manager' },
  ],
  r: [
    { name: 'ggplot2', description: 'Data visualization' },
    { name: 'dplyr', description: 'Data manipulation' },
    { name: 'tidyr', description: 'Data tidying' },
    { name: 'shiny', description: 'Web applications' },
    { name: 'caret', description: 'Machine learning' },
    { name: 'lubridate', description: 'Date/time handling' },
  ],
  haskell: [
    { name: 'aeson', description: 'JSON parsing' },
    { name: 'lens', description: 'Optics library' },
    { name: 'scotty', description: 'Web framework' },
    { name: 'servant', description: 'Type-level web APIs' },
    { name: 'QuickCheck', description: 'Property-based testing' },
    { name: 'conduit', description: 'Streaming data library' },
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
