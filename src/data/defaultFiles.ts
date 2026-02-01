import { FileNode } from '@/types/ide';
import { LanguageTemplate } from '@/components/ide/LanguagePicker';

export const getTemplateFiles = (template: LanguageTemplate): FileNode[] => {
  switch (template) {
    case 'html':
      return htmlTemplate;
    case 'javascript':
      return javascriptTemplate;
    case 'typescript':
      return typescriptTemplate;
    case 'python':
      return pythonTemplate;
    case 'java':
      return javaTemplate;
    case 'cpp':
      return cppTemplate;
    case 'c':
      return cTemplate;
    case 'go':
      return goTemplate;
    default:
      return htmlTemplate;
  }
};

const htmlTemplate: FileNode[] = [
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

Happy coding! 🎉`
      }
    ]
  }
];

const javascriptTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-repl',
    type: 'folder',
    children: [
      {
        id: 'index-js',
        name: 'index.js',
        type: 'file',
        language: 'javascript',
        content: `// Welcome to JavaScript!
// Type your code here and run it

function greet(name) {
  return \`Hello, \${name}! Welcome to JavaScript.\`;
}

console.log(greet('World'));

// Try some JavaScript features
const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(n => n * 2);
console.log('Doubled:', doubled);

// Async/await example
async function fetchData() {
  console.log('Fetching data...');
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('Data fetched!');
}

fetchData();`
      },
      {
        id: 'readme',
        name: 'README.md',
        type: 'file',
        language: 'markdown',
        content: `# JavaScript Repl

Write and run JavaScript code.

## Quick Start

Run \`node index.js\` in the shell to execute your code.`
      }
    ]
  }
];

const typescriptTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-repl',
    type: 'folder',
    children: [
      {
        id: 'index-ts',
        name: 'index.ts',
        type: 'file',
        language: 'typescript',
        content: `// Welcome to TypeScript!
// Enjoy the power of static typing

interface User {
  id: number;
  name: string;
  email: string;
}

function greetUser(user: User): string {
  return \`Hello, \${user.name}! Your email is \${user.email}\`;
}

const user: User = {
  id: 1,
  name: 'TypeScript Developer',
  email: 'dev@example.com'
};

console.log(greetUser(user));

// Generic function example
function identity<T>(value: T): T {
  return value;
}

console.log(identity<number>(42));
console.log(identity<string>('Hello TypeScript!'));`
      },
      {
        id: 'tsconfig',
        name: 'tsconfig.json',
        type: 'file',
        language: 'json',
        content: `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist"
  },
  "include": ["*.ts"],
  "exclude": ["node_modules"]
}`
      }
    ]
  }
];

const pythonTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-repl',
    type: 'folder',
    children: [
      {
        id: 'main-py',
        name: 'main.py',
        type: 'file',
        language: 'python',
        content: `# Welcome to Python!
# A beginner-friendly programming language

def greet(name):
    """Return a greeting message."""
    return f"Hello, {name}! Welcome to Python."

print(greet("World"))

# List comprehension example
numbers = [1, 2, 3, 4, 5]
squared = [n ** 2 for n in numbers]
print(f"Squared: {squared}")

# Class example
class Calculator:
    def __init__(self):
        self.result = 0
    
    def add(self, value):
        self.result += value
        return self
    
    def multiply(self, value):
        self.result *= value
        return self

calc = Calculator()
calc.add(5).multiply(3)
print(f"Result: {calc.result}")  # Output: 15`
      },
      {
        id: 'requirements',
        name: 'requirements.txt',
        type: 'file',
        language: 'text',
        content: `# Add your Python dependencies here
# Example:
# requests==2.28.0
# numpy==1.24.0`
      }
    ]
  }
];

const javaTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-repl',
    type: 'folder',
    children: [
      {
        id: 'main-java',
        name: 'Main.java',
        type: 'file',
        language: 'java',
        content: `// Welcome to Java!
// Object-oriented programming at its finest

public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
        
        // Create an instance
        Greeter greeter = new Greeter("Java Developer");
        greeter.greet();
        
        // Array example
        int[] numbers = {1, 2, 3, 4, 5};
        int sum = 0;
        for (int num : numbers) {
            sum += num;
        }
        System.out.println("Sum: " + sum);
    }
}

class Greeter {
    private String name;
    
    public Greeter(String name) {
        this.name = name;
    }
    
    public void greet() {
        System.out.println("Hello, " + name + "!");
    }
}`
      }
    ]
  }
];

const cppTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-repl',
    type: 'folder',
    children: [
      {
        id: 'main-cpp',
        name: 'main.cpp',
        type: 'file',
        language: 'cpp',
        content: `// Welcome to C++!
// High-performance programming

#include <iostream>
#include <vector>
#include <string>

using namespace std;

class Greeter {
private:
    string name;
    
public:
    Greeter(const string& name) : name(name) {}
    
    void greet() const {
        cout << "Hello, " << name << "!" << endl;
    }
};

int main() {
    cout << "Hello, World!" << endl;
    
    // Class example
    Greeter greeter("C++ Developer");
    greeter.greet();
    
    // Vector example
    vector<int> numbers = {1, 2, 3, 4, 5};
    int sum = 0;
    for (int num : numbers) {
        sum += num;
    }
    cout << "Sum: " << sum << endl;
    
    return 0;
}`
      },
      {
        id: 'makefile',
        name: 'Makefile',
        type: 'file',
        language: 'makefile',
        content: `CXX = g++
CXXFLAGS = -std=c++17 -Wall -Wextra

main: main.cpp
\t$(CXX) $(CXXFLAGS) -o main main.cpp

clean:
\trm -f main

run: main
\t./main`
      }
    ]
  }
];

const cTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-repl',
    type: 'folder',
    children: [
      {
        id: 'main-c',
        name: 'main.c',
        type: 'file',
        language: 'c',
        content: `/* Welcome to C!
   The foundation of modern programming */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

void greet(const char* name) {
    printf("Hello, %s!\\n", name);
}

int main() {
    printf("Hello, World!\\n");
    
    greet("C Developer");
    
    // Array example
    int numbers[] = {1, 2, 3, 4, 5};
    int sum = 0;
    int size = sizeof(numbers) / sizeof(numbers[0]);
    
    for (int i = 0; i < size; i++) {
        sum += numbers[i];
    }
    
    printf("Sum: %d\\n", sum);
    
    return 0;
}`
      },
      {
        id: 'makefile',
        name: 'Makefile',
        type: 'file',
        language: 'makefile',
        content: `CC = gcc
CFLAGS = -Wall -Wextra -std=c11

main: main.c
\t$(CC) $(CFLAGS) -o main main.c

clean:
\trm -f main

run: main
\t./main`
      }
    ]
  }
];

const goTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-repl',
    type: 'folder',
    children: [
      {
        id: 'main-go',
        name: 'main.go',
        type: 'file',
        language: 'go',
        content: `// Welcome to Go!
// Simple, fast, and reliable

package main

import (
\t"fmt"
)

type Greeter struct {
\tName string
}

func (g *Greeter) Greet() {
\tfmt.Printf("Hello, %s!\\n", g.Name)
}

func main() {
\tfmt.Println("Hello, World!")
\t
\t// Struct example
\tgreeter := &Greeter{Name: "Go Developer"}
\tgreeter.Greet()
\t
\t// Slice example
\tnumbers := []int{1, 2, 3, 4, 5}
\tsum := 0
\tfor _, num := range numbers {
\t\tsum += num
\t}
\tfmt.Printf("Sum: %d\\n", sum)
\t
\t// Goroutine example (uncomment to try)
\t// go func() {
\t//     fmt.Println("Hello from goroutine!")
\t// }()
\t// time.Sleep(time.Second)
}`
      },
      {
        id: 'go-mod',
        name: 'go.mod',
        type: 'file',
        language: 'go',
        content: `module my-repl

go 1.21`
      }
    ]
  }
];

// Keep default as HTML template for backwards compatibility
export const defaultFiles = htmlTemplate;

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
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
  };
  return languageMap[ext || ''] || 'text';
};
