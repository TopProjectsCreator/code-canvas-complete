import { FileNode } from "@/types/ide";
import { LanguageTemplate } from "@/data/templateRegistry";
import { getArduinoTemplateFiles } from "./arduinoTemplates";

const tutorialTitles: Record<LanguageTemplate, string> = {
  blank: "Blank Canvas",
  html: "HTML/CSS/JS",
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  java: "Java",
  cpp: "C++",
  c: "C",
  go: "Go",
  rust: "Rust",
  ruby: "Ruby",
  php: "PHP",
  csharp: "C#",
  bash: "Bash",
  lua: "Lua",
  perl: "Perl",
  r: "R",
  haskell: "Haskell",
  nim: "Nim",
  zig: "Zig",
  lisp: "Common Lisp",
  d: "D",
  groovy: "Groovy",
  pascal: "Pascal",
  react: "React",
  nodejs: "Node.js",
  sqlite: "SQLite",
  arduino: "Arduino",
  scratch: "Scratch Blocks",
  word: "Word Document",
  powerpoint: "PowerPoint",
  excel: "Excel Spreadsheet",
  video: "Video Editor",
  audio: "Audio Editor",
  rtf: "Rich Text",
  cad: "3D CAD Viewer",
};

const cloneFileNodes = (nodes: FileNode[]): FileNode[] =>
  nodes.map((node) => ({
    ...node,
    children: node.children ? cloneFileNodes(node.children) : undefined,
  }));

const withTutorialFolder = (template: LanguageTemplate, templateFiles: FileNode[]): FileNode[] => {
  return cloneFileNodes(templateFiles);
};

export const getTemplateFiles = (template: LanguageTemplate): FileNode[] => {
  let baseTemplate: FileNode[];

  switch (template) {
    case "blank":
      baseTemplate = blankTemplate;
      break;
    case "html":
      baseTemplate = htmlTemplate;
      break;
    case "javascript":
      baseTemplate = javascriptTemplate;
      break;
    case "typescript":
      baseTemplate = typescriptTemplate;
      break;
    case "python":
      baseTemplate = pythonTemplate;
      break;
    case "java":
      baseTemplate = javaTemplate;
      break;
    case "cpp":
      baseTemplate = cppTemplate;
      break;
    case "c":
      baseTemplate = cTemplate;
      break;
    case "go":
      baseTemplate = goTemplate;
      break;
    case "rust":
      baseTemplate = rustTemplate;
      break;
    case "ruby":
      baseTemplate = rubyTemplate;
      break;
    case "php":
      baseTemplate = phpTemplate;
      break;
    case "csharp":
      baseTemplate = csharpTemplate;
      break;
    case "bash":
      baseTemplate = bashTemplate;
      break;
    case "lua":
      baseTemplate = luaTemplate;
      break;
    case "perl":
      baseTemplate = perlTemplate;
      break;
    case "r":
      baseTemplate = rTemplate;
      break;
    case "haskell":
      baseTemplate = haskellTemplate;
      break;
    // New templates
    case "react":
      baseTemplate = reactTemplate;
      break;
    case "nodejs":
      baseTemplate = nodejsTemplate;
      break;
    case "sqlite":
      baseTemplate = sqliteTemplate;
      break;
    case "nim":
      baseTemplate = nimTemplate;
      break;
    case "zig":
      baseTemplate = zigTemplate;
      break;
    case "lisp":
      baseTemplate = lispTemplate;
      break;
    case "d":
      baseTemplate = dTemplate;
      break;
    case "groovy":
      baseTemplate = groovyTemplate;
      break;
    case "pascal":
      baseTemplate = pascalTemplate;
      break;
    case "arduino":
      return withTutorialFolder(template, getArduinoTemplateFiles("uno"));
    case "scratch":
      baseTemplate = scratchTemplate;
      break;
    case "word":
      baseTemplate = wordTemplate;
      break;
    case "powerpoint":
      baseTemplate = powerpointTemplate;
      break;
    case "excel":
      baseTemplate = excelTemplate;
      break;
    case "video":
      baseTemplate = videoTemplate;
      break;
    case "audio":
      baseTemplate = audioTemplate;
      break;
    case "rtf":
      baseTemplate = rtfTemplate;
      break;
    case "cad":
      baseTemplate = cadTemplate;
      break;
    default:
      baseTemplate = htmlTemplate;
      break;
  }

  return withTutorialFolder(template, baseTemplate);
};

const htmlTemplate: FileNode[] = [
  {
    id: "root",
    name: "my-canvas",
    type: "folder",
    children: [
      {
        id: "index-html",
        name: "index.html",
        type: "file",
        language: "html",
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Canvas</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="container">
    <h1>Hello, World!</h1>
    <p>Welcome to your new Canvas!</p>
    <button id="clickMe">Click Me</button>
    <div id="output"></div>
  </div>
  <script src="script.js"></script>
</body>
</html>`,
      },
      {
        id: "style-css",
        name: "style.css",
        type: "file",
        language: "css",
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
}`,
      },
      {
        id: "script-js",
        name: "script.js",
        type: "file",
        language: "javascript",
        content: `// Welcome to your JavaScript file!

let clickCount = 0;

document.getElementById('clickMe').addEventListener('click', () => {
  clickCount++;
  const output = document.getElementById('output');
  output.innerHTML = \`<p>Button clicked \${clickCount} time\${clickCount === 1 ? '' : 's'}!</p>\`;
  console.log('Button clicked!', clickCount);
});

// Try editing this code and click Run!
console.log('Hello from your Canvas! 🚀');`,
      },
      {
        id: "readme",
        name: "README.md",
        type: "file",
        language: "markdown",
        content: `# My Awesome Canvas

Welcome to your new Canvas! This is a simple HTML/CSS/JavaScript project.

## Getting Started

1. Edit the files in the sidebar
2. Click the **Run** button to see your changes
3. View the output in the preview pane

Happy coding! 🎉`,
      },
    ],
  },
];

const javascriptTemplate: FileNode[] = [
  {
    id: "root",
    name: "my-canvas",
    type: "folder",
    children: [
      {
        id: "index-js",
        name: "index.js",
        type: "file",
        language: "javascript",
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

fetchData();`,
      },
      {
        id: "readme",
        name: "README.md",
        type: "file",
        language: "markdown",
        content: `# JavaScript Canvas

Write and run JavaScript code.

## Quick Start

Run \`node index.js\` in the shell to execute your code.`,
      },
    ],
  },
];

const typescriptTemplate: FileNode[] = [
  {
    id: "root",
    name: "my-canvas",
    type: "folder",
    children: [
      {
        id: "index-ts",
        name: "index.ts",
        type: "file",
        language: "typescript",
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
console.log(identity<string>('Hello TypeScript!'));`,
      },
      {
        id: "tsconfig",
        name: "tsconfig.json",
        type: "file",
        language: "json",
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
}`,
      },
    ],
  },
];

const pythonTemplate: FileNode[] = [
  {
    id: "root",
    name: "my-canvas",
    type: "folder",
    children: [
      {
        id: "main-py",
        name: "main.py",
        type: "file",
        language: "python",
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
print(f"Result: {calc.result}")  # Output: 15`,
      },
      {
        id: "requirements",
        name: "requirements.txt",
        type: "file",
        language: "text",
        content: `# Add your Python dependencies here
# Example:
# requests==2.28.0
# numpy==1.24.0`,
      },
    ],
  },
];

const javaTemplate: FileNode[] = [
  {
    id: "root",
    name: "my-canvas",
    type: "folder",
    children: [
      {
        id: "main-java",
        name: "prog.java",
        type: "file",
        language: "java",
        content: `// Welcome to Java!
// Object-oriented programming at its finest

public class Java {
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
}`,
      },
    ],
  },
];

const cppTemplate: FileNode[] = [
  {
    id: "root",
    name: "my-canvas",
    type: "folder",
    children: [
      {
        id: "main-cpp",
        name: "main.cpp",
        type: "file",
        language: "cpp",
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
}`,
      },
      {
        id: "makefile",
        name: "Makefile",
        type: "file",
        language: "makefile",
        content: `CXX = g++
CXXFLAGS = -std=c++17 -Wall -Wextra

main: main.cpp
\t$(CXX) $(CXXFLAGS) -o main main.cpp

clean:
\trm -f main

run: main
\t./main`,
      },
    ],
  },
];

const cTemplate: FileNode[] = [
  {
    id: "root",
    name: "my-canvas",
    type: "folder",
    children: [
      {
        id: "main-c",
        name: "main.c",
        type: "file",
        language: "c",
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
}`,
      },
      {
        id: "makefile",
        name: "Makefile",
        type: "file",
        language: "makefile",
        content: `CC = gcc
CFLAGS = -Wall -Wextra -std=c11

main: main.c
\t$(CC) $(CFLAGS) -o main main.c

clean:
\trm -f main

run: main
\t./main`,
      },
    ],
  },
];

const goTemplate: FileNode[] = [
  {
    id: "root",
    name: "my-canvas",
    type: "folder",
    children: [
      {
        id: "main-go",
        name: "main.go",
        type: "file",
        language: "go",
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
}`,
      },
      {
        id: "go-mod",
        name: "go.mod",
        type: "file",
        language: "go",
        content: `module my-canvas

go 1.21`,
      },
    ],
  },
];

const rustTemplate: FileNode[] = [
  {
    id: "root",
    name: "my-canvas",
    type: "folder",
    children: [
      {
        id: "main-rs",
        name: "main.rs",
        type: "file",
        language: "rust",
        content: `// Welcome to Rust!
// Memory safety without garbage collection

fn main() {
    println!("Hello, World!");
    
    // Ownership example
    let s1 = String::from("hello");
    let s2 = s1.clone();
    println!("s1 = {}, s2 = {}", s1, s2);
    
    // Vector and iteration
    let numbers = vec![1, 2, 3, 4, 5];
    let sum: i32 = numbers.iter().sum();
    println!("Sum: {}", sum);
    
    // Struct example
    let greeter = Greeter::new("Rust Developer");
    greeter.greet();
}

struct Greeter {
    name: String,
}

impl Greeter {
    fn new(name: &str) -> Self {
        Greeter { name: name.to_string() }
    }
    
    fn greet(&self) {
        println!("Hello, {}!", self.name);
    }
}`,
      },
      {
        id: "cargo-toml",
        name: "Cargo.toml",
        type: "file",
        language: "toml",
        content: `[package]
name = "my-canvas"
version = "0.1.0"
edition = "2021"

[dependencies]`,
      },
    ],
  },
];

const rubyTemplate: FileNode[] = [
  {
    id: "root",
    name: "my-canvas",
    type: "folder",
    children: [
      {
        id: "main-rb",
        name: "main.rb",
        type: "file",
        language: "ruby",
        content: `# Welcome to Ruby!
# A programmer's best friend

def greet(name)
  "Hello, #{name}!"
end

puts greet("World")

# Array methods
numbers = [1, 2, 3, 4, 5]
squared = numbers.map { |n| n ** 2 }
puts "Squared: #{squared}"

# Class example
class Greeter
  def initialize(name)
    @name = name
  end
  
  def greet
    puts "Hello, #{@name}!"
  end
end

greeter = Greeter.new("Ruby Developer")
greeter.greet

# Block example
3.times { |i| puts "Count: #{i + 1}" }`,
      },
      {
        id: "gemfile",
        name: "Gemfile",
        type: "file",
        language: "ruby",
        content: `source 'https://rubygems.org'

# Add your gems here
# gem 'rails'`,
      },
    ],
  },
];

const phpTemplate: FileNode[] = [
  {
    id: "root",
    name: "my-canvas",
    type: "folder",
    children: [
      {
        id: "index-php",
        name: "index.php",
        type: "file",
        language: "php",
        content: `<?php
// Welcome to PHP!
// The web's favorite scripting language

function greet(\$name) {
    return "Hello, \$name!";
}

echo greet("World") . "\\n";

// Array example
\$numbers = [1, 2, 3, 4, 5];
\$doubled = array_map(fn(\$n) => \$n * 2, \$numbers);
echo "Doubled: " . implode(", ", \$doubled) . "\\n";

// Class example
class Greeter {
    private string \$name;
    
    public function __construct(string \$name) {
        \$this->name = \$name;
    }
    
    public function greet(): void {
        echo "Hello, {\$this->name}!\\n";
    }
}

\$greeter = new Greeter("PHP Developer");
\$greeter->greet();

// Associative array
\$user = [
    "name" => "John",
    "email" => "john@example.com",
    "age" => 30
];

echo "User: {\$user['name']} ({\$user['email']})\\n";
?>`,
      },
    ],
  },
];

const csharpTemplate: FileNode[] = [
  {
    id: "root",
    name: "my-canvas",
    type: "folder",
    children: [
      {
        id: "main-cs",
        name: "Main.cs",
        type: "file",
        language: "csharp",
        content: `// Welcome to C#!
// Versatile and powerful

using System;
using System.Linq;
using System.Collections.Generic;

class Program
{
    static void Main()
    {
        Console.WriteLine("Hello, World!");
        
        // LINQ example
        var numbers = new List<int> { 1, 2, 3, 4, 5 };
        var doubled = numbers.Select(n => n * 2).ToList();
        Console.WriteLine($"Doubled: {string.Join(", ", doubled)}");
        
        // Class usage
        var greeter = new Greeter("C# Developer");
        greeter.Greet();
        
        // Record type (C# 9+)
        var user = new User("John", "john@example.com");
        Console.WriteLine($"User: {user}");
    }
}

class Greeter
{
    private readonly string _name;
    
    public Greeter(string name)
    {
        _name = name;
    }
    
    public void Greet()
    {
        Console.WriteLine($"Hello, {_name}!");
    }
}

record User(string Name, string Email);`,
      },
    ],
  },
];

const bashTemplate: FileNode[] = [
  {
    id: "root",
    name: "my-canvas",
    type: "folder",
    children: [
      {
        id: "script-sh",
        name: "script.sh",
        type: "file",
        language: "bash",
        content: `#!/bin/bash
# Welcome to Bash!
# The power of the command line

echo "Hello, World!"

# Variables
NAME="Bash Developer"
echo "Hello, \$NAME!"

# Function
greet() {
    local name=\$1
    echo "Greetings, \$name!"
}

greet "Shell User"

# Arrays
numbers=(1 2 3 4 5)
echo "Numbers: \${numbers[@]}"

# Loop
sum=0
for num in "\${numbers[@]}"; do
    sum=\$((sum + num))
done
echo "Sum: \$sum"

# Conditional
if [ \$sum -gt 10 ]; then
    echo "Sum is greater than 10"
else
    echo "Sum is 10 or less"
fi

# Command substitution
current_date=\$(date +%Y-%m-%d)
echo "Today is: \$current_date"

# File operations (example)
echo "Current directory: \$(pwd)"
echo "Files: \$(ls -la 2>/dev/null | head -5)"`,
      },
    ],
  },
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
  const ext = filename.split(".").pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    html: "html",
    css: "css",
    js: "javascript",
    ts: "typescript",
    tsx: "typescript",
    jsx: "javascript",
    json: "json",
    sb3: "binary",
    md: "markdown",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
    php: "php",
    cs: "csharp",
    sh: "bash",
    toml: "toml",
    lua: "lua",
    pl: "perl",
    r: "r",
    hs: "haskell",
  };
  return languageMap[ext || ""] || "text";
};

const luaTemplate: FileNode[] = [
  {
    id: "root",
    name: "my-canvas",
    type: "folder",
    children: [
      {
        id: "main-lua",
        name: "main.lua",
        type: "file",
        language: "lua",
        content: `-- Welcome to Lua!
-- A lightweight, embeddable scripting language

-- Simple greeting function
function greet(name)
    return "Hello, " .. name .. "! Welcome to Lua."
end

print(greet("World"))

-- Table (Lua's main data structure)
local person = {
    name = "Lua Developer",
    age = 25,
    skills = {"scripting", "game dev", "embedded"}
}

print("Name: " .. person.name)
print("Skills: " .. table.concat(person.skills, ", "))

-- For loop example
local sum = 0
for i = 1, 10 do
    sum = sum + i
end
print("Sum 1-10: " .. sum)

-- Closure example
function counter()
    local count = 0
    return function()
        count = count + 1
        return count
    end
end

local myCounter = counter()
print("Count: " .. myCounter())  -- 1
print("Count: " .. myCounter())  -- 2
print("Count: " .. myCounter())  -- 3`,
      },
    ],
  },
];

const scratchTemplate: FileNode[] = [
  {
    id: "root",
    name: "scratch-project",
    type: "folder",
    children: [
      {
        id: "scratch-readme",
        name: "README.md",
        type: "file",
        language: "markdown",
        content: `# Scratch Blocks IDE

Use the Scratch panel to build scripts visually.

- Import an existing .sb3 file
- Drag blocks into the scripts area
- Run with the green flag button
- Export back to .sb3 for Scratch compatibility
`,
      },
      {
        id: "scratch-project-json",
        name: "project.json",
        type: "file",
        language: "json",
        content: `{
  "targets": [],
  "monitors": [],
  "extensions": [],
  "meta": {
    "semver": "3.0.0",
    "vm": "0.2.0",
    "agent": "code-canvas"
  }
}`,
      },
    ],
  },
];

const perlTemplate: FileNode[] = [
  {
    id: "root",
    name: "my-canvas",
    type: "folder",
    children: [
      {
        id: "main-pl",
        name: "main.pl",
        type: "file",
        language: "perl",
        content: `#!/usr/bin/perl
# Welcome to Perl!
# The practical extraction and report language

use strict;
use warnings;

# Simple greeting
sub greet {
    my ($name) = @_;
    return "Hello, $name! Welcome to Perl.";
}

print greet("World"), "\\n";

# Array example
my @numbers = (1, 2, 3, 4, 5);
my $sum = 0;
$sum += $_ for @numbers;
print "Sum: $sum\\n";

# Hash example
my %person = (
    name => "Perl Developer",
    age  => 30,
    lang => "Perl"
);

print "Name: $person{name}\\n";

# Regular expression (Perl's superpower!)
my $text = "The quick brown fox";
if ($text =~ /quick (\\w+)/) {
    print "Found: $1\\n";
}

# String manipulation
my @words = split / /, $text;
print "Words: ", join(", ", @words), "\\n";`,
      },
    ],
  },
];

// ============= NEW TEMPLATES =============

const reactTemplate: FileNode[] = [
  {
    id: "root",
    name: "my-react-app",
    type: "folder",
    children: [
      {
        id: "app-jsx",
        name: "App.jsx",
        type: "file",
        language: "javascript",
        content: `function App() {
  const [count, setCount] = React.useState(0);

  return (
    <div className="app">
      <h1>Hello React! ⚛️</h1>
      <div className="card">
        <button onClick={() => setCount(c => c + 1)}>
          Count is {count}
        </button>
        <p>Edit App.jsx and click Run to see changes</p>
      </div>
    </div>
  );
}`,
      },
      {
        id: "index-html",
        name: "index.html",
        type: "file",
        language: "html",
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>React App</title>
  <style>
    body { font-family: system-ui; background: #242424; color: white; margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .app { text-align: center; }
    h1 { font-size: 3rem; }
    .card { padding: 2rem; }
    button { padding: 0.6rem 1.2rem; font-size: 1rem; border-radius: 8px; border: 1px solid transparent; background-color: #1a1a1a; color: white; cursor: pointer; transition: all 0.25s; }
    button:hover { border-color: #646cff; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <!-- APP_JSX_PLACEHOLDER -->
</body>
</html>`,
      },
      {
        id: "style-css",
        name: "style.css",
        type: "file",
        language: "css",
        content: `/* Add your custom styles here */`,
      },
    ],
  },
];

const nodejsTemplate: FileNode[] = [
  {
    id: "root",
    name: "my-express-app",
    type: "folder",
    children: [
      {
        id: "index-js",
        name: "index.js",
        type: "file",
        language: "javascript",
        content: `// Simple Node.js HTTP server (no dependencies needed)
const http = require('http');
const PORT = 3000;

// Simple router
const routes = {
  'GET /': (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Hello from Node.js! 🚀' }));
  },
  'GET /api/users': (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' }
    ]));
  }
};

const server = http.createServer((req, res) => {
  const key = \`\${req.method} \${req.url}\`;
  const handler = routes[key];
  if (handler) {
    handler(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, () => {
  console.log(\`Server running at http://localhost:\${PORT}\`);
  // Since we can't keep a server running in this sandbox,
  // let's demonstrate the routes directly:
  console.log('\\nDemo output:');
  console.log('GET / -> { message: "Hello from Node.js! 🚀" }');
  console.log('GET /api/users -> [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }]');
  server.close();
});`,
      },
      {
        id: "package-json",
        name: "package.json",
        type: "file",
        language: "json",
        content: `{
  "name": "nodejs-app",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  }
}`,
      },
    ],
  },
];

const sqliteTemplate: FileNode[] = [
  {
    id: "root",
    name: "my-sql-canvas",
    type: "folder",
    children: [
      {
        id: "schema-sql",
        name: "schema.sql",
        type: "file",
        language: "sql",
        content: `-- SQLite Database Schema
-- Create tables

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Insert sample data
INSERT INTO users (username, email) VALUES 
    ('alice', 'alice@example.com'),
    ('bob', 'bob@example.com');

INSERT INTO posts (user_id, title, content) VALUES 
    (1, 'Hello World', 'My first post!'),
    (2, 'SQLite is awesome', 'Easy to use embedded database.');

-- Query examples
SELECT * FROM users;
SELECT u.username, p.title FROM users u JOIN posts p ON u.id = p.user_id;`,
      },
      {
        id: "queries-sql",
        name: "queries.sql",
        type: "file",
        language: "sql",
        content: `-- Common SQL Query Examples

-- Select all users
SELECT * FROM users;

-- Select with WHERE
SELECT * FROM users WHERE username = 'alice';

-- Join tables
SELECT 
    u.username,
    p.title,
    p.created_at
FROM users u
INNER JOIN posts p ON u.id = p.user_id
ORDER BY p.created_at DESC;

-- Aggregate functions
SELECT 
    user_id,
    COUNT(*) as post_count
FROM posts
GROUP BY user_id;

-- Subquery
SELECT * FROM users 
WHERE id IN (SELECT DISTINCT user_id FROM posts);`,
      },
    ],
  },
];

const rTemplate: FileNode[] = [
  {
    id: "root",
    name: "my-canvas",
    type: "folder",
    children: [
      {
        id: "main-r",
        name: "main.r",
        type: "file",
        language: "r",
        content: `# Welcome to R!
# Statistical computing and data analysis

# Variables
x <- c(1, 2, 3, 4, 5)
y <- c(2, 4, 6, 8, 10)

cat("x:", x, "\\n")
cat("y:", y, "\\n")
cat("Mean of x:", mean(x), "\\n")
cat("Sum of y:", sum(y), "\\n")

# Function
greet <- function(name) {
  paste("Hello,", name, "- welcome to R!")
}

cat(greet("World"), "\\n")

# Data manipulation
nums <- 1:20
evens <- nums[nums %% 2 == 0]
cat("Evens:", evens, "\\n")

# Factorial
factorial_r <- function(n) {
  if (n <= 1) return(1)
  return(n * factorial_r(n - 1))
}

cat("Factorial of 5:", factorial_r(5), "\\n")`,
      },
    ],
  },
];

const haskellTemplate: FileNode[] = [
  {
    id: "root",
    name: "my-canvas",
    type: "folder",
    children: [
      {
        id: "main-hs",
        name: "Main.hs",
        type: "file",
        language: "haskell",
        content: `-- Welcome to Haskell!
-- Pure functional programming

-- Simple function
greet :: String -> String
greet name = "Hello, " ++ name ++ "!"

-- Factorial with pattern matching
factorial :: Integer -> Integer
factorial 0 = 1
factorial n = n * factorial (n - 1)

-- Fibonacci
fibonacci :: Int -> [Int]
fibonacci n = take n fibs
  where fibs = 0 : 1 : zipWith (+) fibs (tail fibs)

main :: IO ()
main = do
    putStrLn (greet "World")
    putStrLn $ "Factorial of 5: " ++ show (factorial 5)
    putStrLn $ "Fibonacci: " ++ show (fibonacci 10)
    
    let numbers = [1..10]
    let doubled = map (*2) numbers
    putStrLn $ "Doubled: " ++ show doubled
    
    let evens = filter even [1..20]
    putStrLn $ "Evens: " ++ show evens`,
      },
    ],
  },
];

const nimTemplate: FileNode[] = [
  {
    id: "root",
    name: "my-canvas",
    type: "folder",
    children: [
      {
        id: "main-nim",
        name: "main.nim",
        type: "file",
        language: "nim",
        content: `# Welcome to Nim!
# Efficient and expressive

echo "Hello, World!"

# Variables
var name = "Nim Developer"
let pi = 3.14159
echo "Welcome, " & name

# Function
proc greet(name: string): string =
  "Hello, " & name & "!"

echo greet("World")

# Factorial
proc factorial(n: int): int =
  if n <= 1: 1
  else: n * factorial(n - 1)

echo "Factorial of 5: " & $factorial(5)

# Sequences
var numbers = @[1, 2, 3, 4, 5]
echo "Numbers: " & $numbers`,
      },
    ],
  },
];

const zigTemplate: FileNode[] = [
  {
    id: "root",
    name: "my-canvas",
    type: "folder",
    children: [
      {
        id: "main-zig",
        name: "main.zig",
        type: "file",
        language: "zig",
        content: `const std = @import("std");

pub fn main() void {
    std.debug.print("Hello, World!\\n", .{});

    // Variables
    const x: i32 = 42;
    var y: i32 = 10;
    y += x;
    std.debug.print("x = {}, y = {}\\n", .{ x, y });

    // Array
    const nums = [_]i32{ 1, 2, 3, 4, 5 };
    var sum: i32 = 0;
    for (nums) |n| {
        sum += n;
    }
    std.debug.print("Sum: {}\\n", .{sum});
}`,
      },
    ],
  },
];

const lispTemplate: FileNode[] = [
  {
    id: "root",
    name: "my-canvas",
    type: "folder",
    children: [
      {
        id: "main-lisp",
        name: "main.lisp",
        type: "file",
        language: "lisp",
        content: `; Welcome to Common Lisp!
; The original programmable programming language

(format t "Hello, World!~%")

; Function definition
(defun greet (name)
  (format nil "Hello, ~a!" name))

(format t "~a~%" (greet "Lisp Developer"))

; Factorial
(defun factorial (n)
  (if (<= n 1) 1
      (* n (factorial (- n 1)))))

(format t "Factorial of 5: ~a~%" (factorial 5))

; List operations
(let ((numbers '(1 2 3 4 5)))
  (format t "Numbers: ~a~%" numbers)
  (format t "Sum: ~a~%" (reduce #'+ numbers))
  (format t "Doubled: ~a~%" (mapcar (lambda (x) (* x 2)) numbers)))`,
      },
    ],
  },
];

const dTemplate: FileNode[] = [
  {
    id: "root",
    name: "my-canvas",
    type: "folder",
    children: [
      {
        id: "main-d",
        name: "main.d",
        type: "file",
        language: "d",
        content: `import std.stdio;

void main() {
    writeln("Hello, World!");
    
    // Array operations
    auto nums = [1, 2, 3, 4, 5];
    int sum = 0;
    foreach (n; nums) sum += n;
    writefln("Sum: %d", sum);
    
    // Function
    writefln("Factorial of 5: %d", factorial(5));
}

long factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}`,
      },
    ],
  },
];

const groovyTemplate: FileNode[] = [
  {
    id: "root",
    name: "my-canvas",
    type: "folder",
    children: [
      {
        id: "main-groovy",
        name: "main.groovy",
        type: "file",
        language: "groovy",
        content: `// Welcome to Groovy!
println "Hello, World!"

// Variables
def name = "Groovy Developer"
println "Welcome, \${name}"

// List operations
def numbers = [1, 2, 3, 4, 5]
println "Numbers: \${numbers}"
println "Sum: \${numbers.sum()}"
println "Doubled: \${numbers.collect { it * 2 }}"

// Closure
def greet = { n -> "Hello, \${n}!" }
println greet("World")

// Factorial
def factorial
factorial = { n -> n <= 1 ? 1 : n * factorial(n - 1) }
println "Factorial of 5: \${factorial(5)}"`,
      },
    ],
  },
];

const pascalTemplate: FileNode[] = [
  {
    id: "root",
    name: "my-canvas",
    type: "folder",
    children: [
      {
        id: "main-pas",
        name: "main.pas",
        type: "file",
        language: "pascal",
        content: `program Hello;

function Factorial(n: Integer): Integer;
begin
  if n <= 1 then
    Factorial := 1
  else
    Factorial := n * Factorial(n - 1);
end;

var
  i, sum: Integer;
begin
  WriteLn('Hello, World!');
  
  sum := 0;
  for i := 1 to 10 do
    sum := sum + i;
  WriteLn('Sum 1-10: ', sum);
  
  WriteLn('Factorial of 5: ', Factorial(5));
end.`,
      },
    ],
  },
];

const blankTemplate: FileNode[] = [
  {
    id: "root",
    name: "my-canvas",
    type: "folder",
    children: [
      {
        id: "main-txt",
        name: "main.txt",
        type: "file",
        language: "text",
        content: `# Welcome to your blank Canvas!
# 
# This is an empty project. Create new files using
# the sidebar or drag and drop files here.
#
# Happy coding! 🚀`,
      },
    ],
  },
];

const wordTemplate: FileNode[] = [
  {
    id: "root",
    name: "my-document",
    type: "folder",
    children: [
      {
        id: "document-docx",
        name: "Document.docx",
        type: "file",
        language: "docx",
        content: "",
      },
      {
        id: "readme-md",
        name: "README.md",
        type: "file",
        language: "markdown",
        content: `# Word Document Project

This project contains a Word document. Click on \`Document.docx\` to open the Word-like editor.

## Features
- Rich text editing
- Font and size selection
- Bold, italic, underline formatting
- Text alignment
- Save to .docx format
`,
      },
    ],
  },
];

const powerpointTemplate: FileNode[] = [
  {
    id: "root",
    name: "my-presentation",
    type: "folder",
    children: [
      {
        id: "presentation-pptx",
        name: "Presentation.pptx",
        type: "file",
        language: "pptx",
        content: "",
      },
      {
        id: "readme-md",
        name: "README.md",
        type: "file",
        language: "markdown",
        content: `# PowerPoint Project

This project contains a PowerPoint presentation. Click on \`Presentation.pptx\` to open the slide editor.

## Features
- Slide thumbnails panel
- Click-to-edit text boxes
- Add, delete, duplicate, reorder slides
- Ribbon toolbar with formatting
- Save to .pptx format
`,
      },
    ],
  },
];

const excelTemplate: FileNode[] = [
  {
    id: "root",
    name: "my-spreadsheet",
    type: "folder",
    children: [
      {
        id: "spreadsheet-xlsx",
        name: "Spreadsheet.xlsx",
        type: "file",
        language: "xlsx",
        content: "",
      },
      {
        id: "readme-md",
        name: "README.md",
        type: "file",
        language: "markdown",
        content: `# Excel Spreadsheet Project

This project contains an Excel spreadsheet. Click on \`Spreadsheet.xlsx\` to open the spreadsheet editor.

## Features
- Full grid with 50 rows × 26 columns
- Formula bar with cell reference
- Keyboard navigation (arrows, Tab, Enter)
- Double-click or type to edit cells
- Sheet tabs
- Save to .xlsx format
`,
      },
    ],
  },
];

const audioTemplate: FileNode[] = [
  {
    id: "audio-project",
    name: "Audio Project",
    type: "folder",
    children: [
      {
        id: "sample-audio",
        name: "sample.mp3",
        type: "file",
        language: "audio",
        content: "",
      },
      {
        id: "readme-md",
        name: "README.md",
        type: "file",
        language: "markdown",
        content: `# Audio Editor Project

Upload \`.mp3\`, \`.wav\`, or \`.ogg\` files to get started.

## Features
- Waveform visualization
- Play/pause, skip forward/back
- Playback speed control
- Volume control with mute
- Trim in/out points
`,
      },
    ],
  },
];

const rtfTemplate: FileNode[] = [
  {
    id: "rtf-project",
    name: "Rich Text Project",
    type: "folder",
    children: [
      {
        id: "document-rtf",
        name: "Document.rtf",
        type: "file",
        language: "rtf",
        content: "{\\rtf1\\ansi\\deff0 Hello, start editing your rich text document here.}",
      },
      {
        id: "readme-md",
        name: "README.md",
        type: "file",
        language: "markdown",
        content: `# Rich Text Project

Click on \`Document.rtf\` to open the rich text editor.

## Features
- Bold, italic, underline formatting
- Text alignment
- Lists and headings
- Export as RTF
`,
      },
    ],
  },
];

const cadTemplate: FileNode[] = [
  {
    id: "cad-project",
    name: "CAD Project",
    type: "folder",
    children: [
      {
        id: "model-stl",
        name: "model.stl",
        type: "file",
        language: "cad",
        content: "",
      },
      {
        id: "readme-md",
        name: "README.md",
        type: "file",
        language: "markdown",
        content: `# 3D CAD Viewer Project

Upload \`.stl\` or \`.obj\` files to view 3D models.

## Features
- Interactive 3D orbit controls
- Wireframe toggle
- Grid and background options
- Model info (vertices, faces)
- Color customization
- Drag & drop upload
`,
      },
    ],
  },
];

const videoTemplate: FileNode[] = [
  {
    id: "video-project",
    name: "Video Project",
    type: "folder",
    children: [
      {
        id: "sample-video",
        name: "sample.mp4",
        type: "file",
        language: "video",
        content: "",
      },
      {
        id: "readme-md",
        name: "README.md",
        type: "file",
        language: "markdown",
        content: `# Video Editor Project

This project contains a video editor. Upload \`.mp4\`, \`.webm\`, or \`.ogg\` files to get started.

## Features
- Play/pause, skip, fullscreen
- Visual thumbnail timeline with scrubbing
- Draggable trim handles (Set In/Out)
- Playback speed control (0.5× – 2×)
- Volume control with mute
- Frame capture (download as PNG)
- Video info panel (resolution, duration)

## Getting Started
1. Use "Upload Files" in the file tree to add a video
2. Click the video file to open the editor
3. Use the timeline to scrub and trim
`,
      },
    ],
  },
];
