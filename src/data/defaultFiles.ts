import { FileNode } from '@/types/ide';

export const defaultFiles: FileNode[] = [
  {
    id: 'root',
    name: 'my-repl',
    type: 'folder',
    children: [
      {
        id: 'index-html',
        name: 'index.html',
        type: 'file',
        language: 'html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Repl</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="container">
    <h1>Hello, World!</h1>
    <p>Welcome to your new Repl!</p>
    <button id="clickMe">Click Me</button>
    <div id="output"></div>
  </div>
  <script src="script.js"></script>
</body>
</html>`
      },
      {
        id: 'style-css',
        name: 'style.css',
        type: 'file',
        language: 'css',
        content: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  color: white;
}

.container {
  text-align: center;
  padding: 2rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  background: linear-gradient(45deg, #f26207, #ff9a56);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

p {
  color: #a0a0a0;
  margin-bottom: 1.5rem;
}

button {
  padding: 12px 32px;
  font-size: 1rem;
  border: none;
  border-radius: 8px;
  background: #f26207;
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
}

button:hover {
  background: #ff7a2a;
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(242, 98, 7, 0.4);
}

#output {
  margin-top: 1.5rem;
  padding: 1rem;
  min-height: 50px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.3);
}`
      },
      {
        id: 'script-js',
        name: 'script.js',
        type: 'file',
        language: 'javascript',
        content: `// Welcome to your JavaScript file!

let clickCount = 0;

document.getElementById('clickMe').addEventListener('click', () => {
  clickCount++;
  const output = document.getElementById('output');
  output.innerHTML = \`<p>Button clicked \${clickCount} time\${clickCount === 1 ? '' : 's'}!</p>\`;
  console.log('Button clicked!', clickCount);
});

// Try editing this code and click Run!
console.log('Hello from your Repl! 🚀');`
      },
      {
        id: 'readme',
        name: 'README.md',
        type: 'file',
        language: 'markdown',
        content: `# My Awesome Repl

Welcome to your new Repl! This is a simple HTML/CSS/JavaScript project.

## Getting Started

1. Edit the files in the sidebar
2. Click the **Run** button to see your changes
3. View the output in the preview pane

## Files

- \`index.html\` - The main HTML file
- \`style.css\` - Styles for your page
- \`script.js\` - JavaScript functionality

## Tips

- Use **Ctrl+S** to save
- Use **Ctrl+/\` to toggle comments
- The console shows your \`console.log\` outputs

Happy coding! 🎉`
      },
      {
        id: 'config-folder',
        name: '.config',
        type: 'folder',
        children: [
          {
            id: 'package-json',
            name: 'package.json',
            type: 'file',
            language: 'json',
            content: `{
  "name": "my-repl",
  "version": "1.0.0",
  "description": "A simple HTML/CSS/JS project",
  "main": "index.html",
  "scripts": {
    "start": "serve .",
    "dev": "live-server"
  },
  "author": "You",
  "license": "MIT"
}`
          }
        ]
      }
    ]
  }
];

export const findFileById = (files: FileNode[], id: string): FileNode | null => {
  for (const file of files) {
    if (file.id === id) return file;
    if (file.children) {
      const found = findFileById(file.children, id);
      if (found) return found;
    }
  }
  return null;
};

export const getFileLanguage = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    html: 'html',
    css: 'css',
    js: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    jsx: 'javascript',
    json: 'json',
    md: 'markdown',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
  };
  return languageMap[ext || ''] || 'text';
};
