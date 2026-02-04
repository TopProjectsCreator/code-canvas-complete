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
    case 'rust':
      return rustTemplate;
    case 'ruby':
      return rubyTemplate;
    case 'php':
      return phpTemplate;
    case 'swift':
      return swiftTemplate;
    case 'kotlin':
      return kotlinTemplate;
    case 'csharp':
      return csharpTemplate;
    case 'bash':
      return bashTemplate;
    case 'lua':
      return luaTemplate;
    case 'perl':
      return perlTemplate;
    case 'scala':
      return scalaTemplate;
    case 'r':
      return rTemplate;
    case 'haskell':
      return haskellTemplate;
    case 'elixir':
      return elixirTemplate;
    // New templates
    case 'react':
      return reactTemplate;
    case 'nodejs':
      return nodejsTemplate;
    case 'flask':
      return flaskTemplate;
    case 'django':
      return djangoTemplate;
    case 'sqlite':
      return sqliteTemplate;
    case 'clojure':
      return clojureTemplate;
    case 'dart':
      return dartTemplate;
    case 'julia':
      return juliaTemplate;
    case 'nim':
      return nimTemplate;
    case 'zig':
      return zigTemplate;
    case 'fortran':
      return fortranTemplate;
    case 'cobol':
      return cobolTemplate;
    case 'fsharp':
      return fsharpTemplate;
    case 'ocaml':
      return ocamlTemplate;
    case 'erlang':
      return erlangTemplate;
    case 'crystal':
      return crystalTemplate;
    case 'assembly':
      return assemblyTemplate;
    case 'lisp':
      return lispTemplate;
    case 'prolog':
      return prologTemplate;
    case 'racket':
      return racketTemplate;
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

const rustTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-repl',
    type: 'folder',
    children: [
      {
        id: 'main-rs',
        name: 'main.rs',
        type: 'file',
        language: 'rust',
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
}`
      },
      {
        id: 'cargo-toml',
        name: 'Cargo.toml',
        type: 'file',
        language: 'toml',
        content: `[package]
name = "my-repl"
version = "0.1.0"
edition = "2021"

[dependencies]`
      }
    ]
  }
];

const rubyTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-repl',
    type: 'folder',
    children: [
      {
        id: 'main-rb',
        name: 'main.rb',
        type: 'file',
        language: 'ruby',
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
3.times { |i| puts "Count: #{i + 1}" }`
      },
      {
        id: 'gemfile',
        name: 'Gemfile',
        type: 'file',
        language: 'ruby',
        content: `source 'https://rubygems.org'

# Add your gems here
# gem 'rails'`
      }
    ]
  }
];

const phpTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-repl',
    type: 'folder',
    children: [
      {
        id: 'index-php',
        name: 'index.php',
        type: 'file',
        language: 'php',
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
?>`
      }
    ]
  }
];

const swiftTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-repl',
    type: 'folder',
    children: [
      {
        id: 'main-swift',
        name: 'main.swift',
        type: 'file',
        language: 'swift',
        content: `// Welcome to Swift!
// Modern, safe, and fast

import Foundation

func greet(_ name: String) -> String {
    return "Hello, \\(name)!"
}

print(greet("World"))

// Array operations
let numbers = [1, 2, 3, 4, 5]
let doubled = numbers.map { $0 * 2 }
print("Doubled: \\(doubled)")

// Struct example
struct Greeter {
    let name: String
    
    func greet() {
        print("Hello, \\(name)!")
    }
}

let greeter = Greeter(name: "Swift Developer")
greeter.greet()

// Optional handling
let optionalName: String? = "Swift"
if let name = optionalName {
    print("Optional value: \\(name)")
}

// Enum example
enum Status {
    case success
    case failure(String)
}

let result: Status = .success
switch result {
case .success:
    print("Operation succeeded!")
case .failure(let message):
    print("Failed: \\(message)")
}`
      }
    ]
  }
];

const kotlinTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-repl',
    type: 'folder',
    children: [
      {
        id: 'main-kt',
        name: 'Main.kt',
        type: 'file',
        language: 'kotlin',
        content: `// Welcome to Kotlin!
// Concise, safe, and interoperable

fun greet(name: String): String = "Hello, \$name!"

fun main() {
    println(greet("World"))
    
    // List operations
    val numbers = listOf(1, 2, 3, 4, 5)
    val doubled = numbers.map { it * 2 }
    println("Doubled: \$doubled")
    
    // Data class
    data class User(val name: String, val email: String)
    val user = User("Kotlin Dev", "dev@example.com")
    println("User: \$user")
    
    // Class example
    val greeter = Greeter("Kotlin Developer")
    greeter.greet()
    
    // Null safety
    val nullableName: String? = "Kotlin"
    println("Length: \${nullableName?.length ?: 0}")
    
    // When expression
    val x = 2
    when (x) {
        1 -> println("One")
        2 -> println("Two")
        else -> println("Other")
    }
}

class Greeter(private val name: String) {
    fun greet() {
        println("Hello, \$name!")
    }
}`
      }
    ]
  }
];

const csharpTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-repl',
    type: 'folder',
    children: [
      {
        id: 'main-cs',
        name: 'Main.cs',
        type: 'file',
        language: 'csharp',
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

record User(string Name, string Email);`
      }
    ]
  }
];

const bashTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-repl',
    type: 'folder',
    children: [
      {
        id: 'script-sh',
        name: 'script.sh',
        type: 'file',
        language: 'bash',
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
echo "Files: \$(ls -la 2>/dev/null | head -5)"`
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
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
    cs: 'csharp',
    sh: 'bash',
    toml: 'toml',
    lua: 'lua',
    pl: 'perl',
    scala: 'scala',
    r: 'r',
    hs: 'haskell',
    ex: 'elixir',
    exs: 'elixir',
  };
  return languageMap[ext || ''] || 'text';
};

const luaTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-repl',
    type: 'folder',
    children: [
      {
        id: 'main-lua',
        name: 'main.lua',
        type: 'file',
        language: 'lua',
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
print("Count: " .. myCounter())  -- 3`
      }
    ]
  }
];

const perlTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-repl',
    type: 'folder',
    children: [
      {
        id: 'main-pl',
        name: 'main.pl',
        type: 'file',
        language: 'perl',
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
print "Words: ", join(", ", @words), "\\n";`
      }
    ]
  }
];

const scalaTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-repl',
    type: 'folder',
    children: [
      {
        id: 'main-scala',
        name: 'Main.scala',
        type: 'file',
        language: 'scala',
        content: `// Welcome to Scala!
// Functional and object-oriented programming combined

object Main extends App {
  println("Hello, World!")
  
  // Function definition
  def greet(name: String): String = s"Hello, $name! Welcome to Scala."
  
  println(greet("Scala Developer"))
  
  // List operations (functional style)
  val numbers = List(1, 2, 3, 4, 5)
  val doubled = numbers.map(_ * 2)
  val sum = numbers.reduce(_ + _)
  
  println(s"Doubled: $doubled")
  println(s"Sum: $sum")
  
  // Case class (immutable data)
  case class Person(name: String, age: Int)
  
  val person = Person("Alice", 28)
  println(s"Person: \${person.name}, Age: \${person.age}")
  
  // Pattern matching
  def describe(x: Any): String = x match {
    case i: Int if i > 0 => "positive number"
    case s: String => s"string: $s"
    case _ => "something else"
  }
  
  println(describe(42))
  println(describe("hello"))
}`
      }
    ]
  }
];

const rTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-repl',
    type: 'folder',
    children: [
      {
        id: 'main-r',
        name: 'main.R',
        type: 'file',
        language: 'r',
        content: `# Welcome to R!
# Statistical computing and data analysis

# Simple greeting
greet <- function(name) {
  paste("Hello,", name, "! Welcome to R.")
}

print(greet("World"))

# Vector operations
numbers <- c(1, 2, 3, 4, 5)
print(paste("Sum:", sum(numbers)))
print(paste("Mean:", mean(numbers)))
print(paste("SD:", sd(numbers)))

# Data frame (like a table)
df <- data.frame(
  name = c("Alice", "Bob", "Charlie"),
  age = c(25, 30, 35),
  score = c(85, 92, 78)
)

print("Data Frame:")
print(df)

# Summary statistics
print("Summary:")
print(summary(df))

# Simple plot (text-based representation)
cat("\\nScore distribution:\\n")
for (i in 1:nrow(df)) {
  cat(df$name[i], ": ", rep("*", df$score[i] / 10), "\\n", sep="")
}`
      }
    ]
  }
];

const haskellTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-repl',
    type: 'folder',
    children: [
      {
        id: 'main-hs',
        name: 'Main.hs',
        type: 'file',
        language: 'haskell',
        content: `-- Welcome to Haskell!
-- Pure functional programming

module Main where

-- Simple greeting function
greet :: String -> String
greet name = "Hello, " ++ name ++ "! Welcome to Haskell."

-- Factorial using recursion
factorial :: Integer -> Integer
factorial 0 = 1
factorial n = n * factorial (n - 1)

-- Fibonacci using pattern matching
fibonacci :: Int -> Int
fibonacci 0 = 0
fibonacci 1 = 1
fibonacci n = fibonacci (n - 1) + fibonacci (n - 2)

-- List operations
doubleAll :: [Int] -> [Int]
doubleAll = map (* 2)

sumList :: [Int] -> Int
sumList = foldr (+) 0

-- Main function
main :: IO ()
main = do
    putStrLn (greet "World")
    putStrLn $ "Factorial of 5: " ++ show (factorial 5)
    putStrLn $ "Fibonacci of 10: " ++ show (fibonacci 10)
    
    let numbers = [1, 2, 3, 4, 5]
    putStrLn $ "Doubled: " ++ show (doubleAll numbers)
    putStrLn $ "Sum: " ++ show (sumList numbers)
    
    -- List comprehension
    let evens = [x | x <- [1..20], even x]
    putStrLn $ "Evens 1-20: " ++ show evens`
      }
    ]
  }
];

const elixirTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-repl',
    type: 'folder',
    children: [
      {
        id: 'main-ex',
        name: 'main.exs',
        type: 'file',
        language: 'elixir',
        content: `# Welcome to Elixir!
# Functional, concurrent programming on the BEAM

defmodule Greeter do
  def greet(name) do
    "Hello, \#{name}! Welcome to Elixir."
  end
end

IO.puts Greeter.greet("World")

# Pattern matching
{a, b, c} = {1, 2, 3}
IO.puts "a=\#{a}, b=\#{b}, c=\#{c}"

# List operations
numbers = [1, 2, 3, 4, 5]
doubled = Enum.map(numbers, fn x -> x * 2 end)
sum = Enum.reduce(numbers, 0, fn x, acc -> x + acc end)

IO.puts "Doubled: \#{inspect(doubled)}"
IO.puts "Sum: \#{sum}"

# Pipe operator (Elixir's superpower!)
result = numbers
  |> Enum.filter(fn x -> rem(x, 2) == 0 end)
  |> Enum.map(fn x -> x * 10 end)
  |> Enum.sum()

IO.puts "Even numbers * 10, summed: \#{result}"

# Recursion with pattern matching
defmodule Math do
  def factorial(0), do: 1
  def factorial(n) when n > 0 do
    n * factorial(n - 1)
  end
end

IO.puts "Factorial of 5: \#{Math.factorial(5)}"`
      }
    ]
  }
];

// ============= NEW TEMPLATES =============

const reactTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-react-app',
    type: 'folder',
    children: [
      {
        id: 'app-jsx',
        name: 'App.jsx',
        type: 'file',
        language: 'javascript',
        content: `import { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="app">
      <h1>Hello React! ⚛️</h1>
      <div className="card">
        <button onClick={() => setCount(c => c + 1)}>
          Count is {count}
        </button>
        <p>Edit App.jsx and save to see changes</p>
      </div>
    </div>
  );
}

export default App;`
      },
      {
        id: 'index-jsx',
        name: 'index.jsx',
        type: 'file',
        language: 'javascript',
        content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`
      },
      {
        id: 'index-html',
        name: 'index.html',
        type: 'file',
        language: 'html',
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
    button { padding: 0.6rem 1.2rem; font-size: 1rem; border-radius: 8px; border: 1px solid transparent; background-color: #1a1a1a; cursor: pointer; transition: all 0.25s; }
    button:hover { border-color: #646cff; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="index.jsx"></script>
</body>
</html>`
      }
    ]
  }
];

const nodejsTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-express-app',
    type: 'folder',
    children: [
      {
        id: 'index-js',
        name: 'index.js',
        type: 'file',
        language: 'javascript',
        content: `// Simple Express.js server
const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Hello from Express! 🚀' });
});

app.get('/api/users', (req, res) => {
  res.json([
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' }
  ]);
});

app.post('/api/echo', (req, res) => {
  res.json({ received: req.body });
});

app.listen(PORT, () => {
  console.log(\`Server running at http://localhost:\${PORT}\`);
});`
      },
      {
        id: 'package-json',
        name: 'package.json',
        type: 'file',
        language: 'json',
        content: `{
  "name": "express-app",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}`
      }
    ]
  }
];

const flaskTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-flask-app',
    type: 'folder',
    children: [
      {
        id: 'app-py',
        name: 'app.py',
        type: 'file',
        language: 'python',
        content: `# Flask - Lightweight Python Web Framework
from flask import Flask, jsonify, request

app = Flask(__name__)

# Sample data
users = [
    {"id": 1, "name": "Alice"},
    {"id": 2, "name": "Bob"}
]

@app.route('/')
def home():
    return jsonify({"message": "Hello from Flask! 🐍"})

@app.route('/api/users', methods=['GET'])
def get_users():
    return jsonify(users)

@app.route('/api/users', methods=['POST'])
def create_user():
    data = request.get_json()
    new_user = {
        "id": len(users) + 1,
        "name": data.get("name", "Unknown")
    }
    users.append(new_user)
    return jsonify(new_user), 201

if __name__ == '__main__':
    print("Starting Flask server...")
    print("Visit http://localhost:5000")
    app.run(debug=True, port=5000)`
      },
      {
        id: 'requirements',
        name: 'requirements.txt',
        type: 'file',
        language: 'text',
        content: `flask==3.0.0`
      }
    ]
  }
];

const djangoTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-django-app',
    type: 'folder',
    children: [
      {
        id: 'manage-py',
        name: 'manage.py',
        type: 'file',
        language: 'python',
        content: `#!/usr/bin/env python
# Django project management script
import os
import sys

def main():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'settings')
    from django.core.management import execute_from_command_line
    execute_from_command_line(sys.argv)

if __name__ == '__main__':
    main()`
      },
      {
        id: 'views-py',
        name: 'views.py',
        type: 'file',
        language: 'python',
        content: `# Django Views
from django.http import JsonResponse
from django.views import View

class HomeView(View):
    def get(self, request):
        return JsonResponse({
            "message": "Hello from Django! 🎸",
            "framework": "Django",
            "version": "5.0"
        })

class UserListView(View):
    def get(self, request):
        users = [
            {"id": 1, "name": "Alice"},
            {"id": 2, "name": "Bob"}
        ]
        return JsonResponse({"users": users})`
      },
      {
        id: 'requirements',
        name: 'requirements.txt',
        type: 'file',
        language: 'text',
        content: `django==5.0`
      }
    ]
  }
];

const sqliteTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-sql-repl',
    type: 'folder',
    children: [
      {
        id: 'schema-sql',
        name: 'schema.sql',
        type: 'file',
        language: 'sql',
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
SELECT u.username, p.title FROM users u JOIN posts p ON u.id = p.user_id;`
      },
      {
        id: 'queries-sql',
        name: 'queries.sql',
        type: 'file',
        language: 'sql',
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
WHERE id IN (SELECT DISTINCT user_id FROM posts);`
      }
    ]
  }
];

const clojureTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-clojure-repl',
    type: 'folder',
    children: [
      {
        id: 'core-clj',
        name: 'core.clj',
        type: 'file',
        language: 'clojure',
        content: `; Welcome to Clojure!
; A modern Lisp for the JVM

(ns core)

; Basic functions
(defn greet [name]
  (str "Hello, " name "! Welcome to Clojure."))

(println (greet "World"))

; Immutable data structures
(def numbers [1 2 3 4 5])
(def doubled (map #(* 2 %) numbers))
(println "Doubled:" doubled)

; Higher-order functions
(def sum (reduce + numbers))
(println "Sum:" sum)

; Threading macro (pipes data through functions)
(def result
  (->> numbers
       (filter even?)
       (map #(* 10 %))
       (reduce +)))
(println "Even * 10, summed:" result)

; Recursion
(defn factorial [n]
  (if (<= n 1)
    1
    (* n (factorial (dec n)))))

(println "Factorial of 5:" (factorial 5))`
      }
    ]
  }
];

const dartTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-dart-app',
    type: 'folder',
    children: [
      {
        id: 'main-dart',
        name: 'main.dart',
        type: 'file',
        language: 'dart',
        content: `// Welcome to Dart!
// The language behind Flutter

void main() {
  print('Hello, Dart! 🎯');
  
  // Variables
  var name = 'Dart Developer';
  final greeting = greet(name);
  print(greeting);
  
  // Lists
  var numbers = [1, 2, 3, 4, 5];
  var doubled = numbers.map((n) => n * 2).toList();
  print('Doubled: \$doubled');
  
  // Classes
  var person = Person('Alice', 25);
  person.introduce();
  
  // Async/await
  fetchData().then((data) => print('Fetched: \$data'));
}

String greet(String name) {
  return 'Hello, \$name! Welcome to Dart.';
}

class Person {
  String name;
  int age;
  
  Person(this.name, this.age);
  
  void introduce() {
    print('I am \$name, \$age years old.');
  }
}

Future<String> fetchData() async {
  await Future.delayed(Duration(seconds: 1));
  return 'Data loaded!';
}`
      }
    ]
  }
];

const juliaTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-julia-repl',
    type: 'folder',
    children: [
      {
        id: 'main-jl',
        name: 'main.jl',
        type: 'file',
        language: 'julia',
        content: `# Welcome to Julia!
# High-performance scientific computing

println("Hello, Julia! 🔬")

# Function definition
function greet(name)
    return "Hello, \$name! Welcome to Julia."
end

println(greet("World"))

# Arrays and broadcasting
numbers = [1, 2, 3, 4, 5]
squared = numbers .^ 2  # Element-wise squaring
println("Squared: ", squared)

# Sum and statistics
println("Sum: ", sum(numbers))
println("Mean: ", sum(numbers) / length(numbers))

# Matrix operations
A = [1 2; 3 4]
B = [5 6; 7 8]
println("Matrix product:")
println(A * B)

# Multiple dispatch (Julia's superpower!)
area(r::Float64) = π * r^2  # Circle
area(w::Float64, h::Float64) = w * h  # Rectangle

println("Circle area (r=2): ", area(2.0))
println("Rectangle area (3x4): ", area(3.0, 4.0))

# Comprehensions
evens = [x for x in 1:10 if x % 2 == 0]
println("Even numbers: ", evens)`
      }
    ]
  }
];

const nimTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-nim-app',
    type: 'folder',
    children: [
      {
        id: 'main-nim',
        name: 'main.nim',
        type: 'file',
        language: 'nim',
        content: `# Welcome to Nim!
# Efficient and expressive compiled language

echo "Hello, Nim! 👑"

# Procedures
proc greet(name: string): string =
  result = "Hello, " & name & "! Welcome to Nim."

echo greet("World")

# Variables
var mutableVar = 10
let immutableVar = 20
const compileTimeConst = 30

# Sequences (dynamic arrays)
var numbers = @[1, 2, 3, 4, 5]
let doubled = numbers.mapIt(it * 2)
echo "Doubled: ", doubled

# Object types
type
  Person = object
    name: string
    age: int

proc introduce(p: Person) =
  echo "I am ", p.name, ", ", p.age, " years old."

let alice = Person(name: "Alice", age: 25)
alice.introduce()

# Control flow
for i in 1..5:
  if i mod 2 == 0:
    echo i, " is even"
  else:
    echo i, " is odd"`
      }
    ]
  }
];

const zigTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-zig-app',
    type: 'folder',
    children: [
      {
        id: 'main-zig',
        name: 'main.zig',
        type: 'file',
        language: 'zig',
        content: `// Welcome to Zig!
// Modern systems programming language

const std = @import("std");

pub fn main() !void {
    const stdout = std.io.getStdOut().writer();
    
    try stdout.print("Hello, Zig! ⚡\\n", .{});
    
    // Variables
    const message = "Welcome to Zig";
    var counter: i32 = 0;
    
    // Arrays and slices
    const numbers = [_]i32{ 1, 2, 3, 4, 5 };
    
    var sum: i32 = 0;
    for (numbers) |num| {
        sum += num;
        counter += 1;
    }
    
    try stdout.print("Sum of {d} numbers: {d}\\n", .{ counter, sum });
    
    // Structs
    const Point = struct {
        x: f32,
        y: f32,
        
        fn distance(self: @This()) f32 {
            return @sqrt(self.x * self.x + self.y * self.y);
        }
    };
    
    const p = Point{ .x = 3.0, .y = 4.0 };
    try stdout.print("Distance from origin: {d}\\n", .{p.distance()});
}`
      }
    ]
  }
];

const fortranTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-fortran-app',
    type: 'folder',
    children: [
      {
        id: 'main-f90',
        name: 'main.f90',
        type: 'file',
        language: 'fortran',
        content: `! Welcome to Fortran!
! Numeric and scientific computing

program hello
    implicit none
    
    integer :: i, n
    real :: sum, mean
    real, dimension(5) :: numbers
    
    print *, "Hello, Fortran! 🔢"
    
    ! Initialize array
    numbers = [1.0, 2.0, 3.0, 4.0, 5.0]
    n = size(numbers)
    
    ! Calculate sum
    sum = 0.0
    do i = 1, n
        sum = sum + numbers(i)
    end do
    
    mean = sum / real(n)
    
    print *, "Numbers:", numbers
    print *, "Sum:", sum
    print *, "Mean:", mean
    
    ! Call subroutine
    call greet("Fortran Developer")
    
contains
    subroutine greet(name)
        character(len=*), intent(in) :: name
        print *, "Hello, ", trim(name), "!"
    end subroutine greet
    
end program hello`
      }
    ]
  }
];

const cobolTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-cobol-app',
    type: 'folder',
    children: [
      {
        id: 'main-cob',
        name: 'main.cob',
        type: 'file',
        language: 'cobol',
        content: `       IDENTIFICATION DIVISION.
       PROGRAM-ID. HELLO-WORLD.
       AUTHOR. REPLIT.
       
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01 WS-NAME PIC A(20) VALUE "COBOL Developer".
       01 WS-NUM1 PIC 9(3) VALUE 100.
       01 WS-NUM2 PIC 9(3) VALUE 50.
       01 WS-RESULT PIC 9(4) VALUE 0.
       
       PROCEDURE DIVISION.
       MAIN-PROCEDURE.
           DISPLAY "Hello, COBOL! 📼".
           DISPLAY "Welcome, " WS-NAME.
           
           ADD WS-NUM1 TO WS-NUM2 GIVING WS-RESULT.
           DISPLAY "Sum of " WS-NUM1 " and " WS-NUM2 " = " WS-RESULT.
           
           MULTIPLY WS-NUM1 BY WS-NUM2 GIVING WS-RESULT.
           DISPLAY "Product = " WS-RESULT.
           
           STOP RUN.`
      }
    ]
  }
];

const fsharpTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-fsharp-app',
    type: 'folder',
    children: [
      {
        id: 'program-fs',
        name: 'Program.fs',
        type: 'file',
        language: 'fsharp',
        content: `// Welcome to F#!
// Functional-first .NET language

printfn "Hello, F#! 🔷"

// Functions
let greet name = sprintf "Hello, %s! Welcome to F#." name
printfn "%s" (greet "World")

// Immutable by default
let numbers = [1; 2; 3; 4; 5]
let doubled = numbers |> List.map (fun x -> x * 2)
printfn "Doubled: %A" doubled

// Piping and composition
let result = 
    numbers 
    |> List.filter (fun x -> x % 2 = 0)
    |> List.map (fun x -> x * 10)
    |> List.sum
printfn "Even * 10, summed: %d" result

// Pattern matching
let describe x =
    match x with
    | 0 -> "zero"
    | 1 -> "one"
    | n when n < 0 -> "negative"
    | _ -> "positive"

printfn "5 is %s" (describe 5)

// Records
type Person = { Name: string; Age: int }
let alice = { Name = "Alice"; Age = 25 }
printfn "%s is %d years old" alice.Name alice.Age`
      }
    ]
  }
];

const ocamlTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-ocaml-app',
    type: 'folder',
    children: [
      {
        id: 'main-ml',
        name: 'main.ml',
        type: 'file',
        language: 'ocaml',
        content: `(* Welcome to OCaml! *)
(* Powerful functional programming *)

let () = print_endline "Hello, OCaml! 🐫"

(* Functions *)
let greet name = 
  Printf.sprintf "Hello, %s! Welcome to OCaml." name

let () = print_endline (greet "World")

(* Lists and higher-order functions *)
let numbers = [1; 2; 3; 4; 5]
let doubled = List.map (fun x -> x * 2) numbers

let () = 
  print_string "Doubled: ";
  List.iter (Printf.printf "%d ") doubled;
  print_newline ()

(* Pattern matching *)
let describe x = match x with
  | 0 -> "zero"
  | 1 -> "one"
  | n when n < 0 -> "negative"
  | _ -> "positive"

let () = Printf.printf "5 is %s\\n" (describe 5)

(* Recursive functions *)
let rec factorial n = 
  if n <= 1 then 1 
  else n * factorial (n - 1)

let () = Printf.printf "Factorial of 5: %d\\n" (factorial 5)

(* Algebraic data types *)
type shape = 
  | Circle of float
  | Rectangle of float * float

let area = function
  | Circle r -> Float.pi *. r *. r
  | Rectangle (w, h) -> w *. h

let () = Printf.printf "Circle area (r=2): %.2f\\n" (area (Circle 2.0))`
      }
    ]
  }
];

const erlangTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-erlang-app',
    type: 'folder',
    children: [
      {
        id: 'main-erl',
        name: 'main.erl',
        type: 'file',
        language: 'erlang',
        content: `%% Welcome to Erlang!
%% Concurrent and distributed systems

-module(main).
-export([start/0, greet/1, factorial/1]).

start() ->
    io:format("Hello, Erlang! ☎️~n"),
    io:format("~s~n", [greet("World")]),
    
    %% List operations
    Numbers = [1, 2, 3, 4, 5],
    Doubled = lists:map(fun(X) -> X * 2 end, Numbers),
    io:format("Doubled: ~p~n", [Doubled]),
    
    Sum = lists:foldl(fun(X, Acc) -> X + Acc end, 0, Numbers),
    io:format("Sum: ~p~n", [Sum]),
    
    %% Pattern matching
    io:format("Factorial of 5: ~p~n", [factorial(5)]).

greet(Name) ->
    lists:concat(["Hello, ", Name, "! Welcome to Erlang."]).

%% Recursion with pattern matching
factorial(0) -> 1;
factorial(N) when N > 0 -> N * factorial(N - 1).`
      }
    ]
  }
];

const crystalTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-crystal-app',
    type: 'folder',
    children: [
      {
        id: 'main-cr',
        name: 'main.cr',
        type: 'file',
        language: 'crystal',
        content: `# Welcome to Crystal!
# Ruby-like syntax with C performance

puts "Hello, Crystal! 💎"

# Functions
def greet(name : String) : String
  "Hello, #{name}! Welcome to Crystal."
end

puts greet("World")

# Arrays
numbers = [1, 2, 3, 4, 5]
doubled = numbers.map { |n| n * 2 }
puts "Doubled: #{doubled}"

sum = numbers.reduce(0) { |acc, n| acc + n }
puts "Sum: #{sum}"

# Classes
class Person
  property name : String
  property age : Int32
  
  def initialize(@name, @age)
  end
  
  def introduce
    puts "I am #{@name}, #{@age} years old."
  end
end

alice = Person.new("Alice", 25)
alice.introduce

# Pattern matching with case
def describe(x)
  case x
  when 0 then "zero"
  when 1 then "one"
  when .< 0 then "negative"
  else "positive"
  end
end

puts "5 is #{describe(5)}"`
      }
    ]
  }
];

const assemblyTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-asm-app',
    type: 'folder',
    children: [
      {
        id: 'main-asm',
        name: 'main.asm',
        type: 'file',
        language: 'assembly',
        content: `; Welcome to Assembly!
; x86-64 Linux Assembly (NASM syntax)

section .data
    hello db "Hello, Assembly! 🔩", 10, 0
    hello_len equ $ - hello

section .text
    global _start

_start:
    ; Write "Hello, Assembly!" to stdout
    mov rax, 1          ; syscall: write
    mov rdi, 1          ; file descriptor: stdout
    mov rsi, hello      ; pointer to message
    mov rdx, hello_len  ; message length
    syscall
    
    ; Exit program
    mov rax, 60         ; syscall: exit
    xor rdi, rdi        ; exit code: 0
    syscall`
      },
      {
        id: 'makefile',
        name: 'Makefile',
        type: 'file',
        language: 'makefile',
        content: `# Assembly Makefile

main: main.asm
\tnasm -f elf64 main.asm -o main.o
\tld main.o -o main

clean:
\trm -f main main.o

run: main
\t./main`
      }
    ]
  }
];

const lispTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-lisp-repl',
    type: 'folder',
    children: [
      {
        id: 'main-lisp',
        name: 'main.lisp',
        type: 'file',
        language: 'lisp',
        content: `;;; Welcome to Common Lisp!
;;; The original programmable programming language

(format t "Hello, Lisp! 🌀~%")

;; Function definition
(defun greet (name)
  (format nil "Hello, ~a! Welcome to Lisp." name))

(format t "~a~%" (greet "World"))

;; Lists and higher-order functions
(defvar *numbers* '(1 2 3 4 5))

(defvar *doubled* (mapcar (lambda (x) (* x 2)) *numbers*))
(format t "Doubled: ~a~%" *doubled*)

(defvar *sum* (reduce #'+ *numbers*))
(format t "Sum: ~a~%" *sum*)

;; Recursion
(defun factorial (n)
  (if (<= n 1)
      1
      (* n (factorial (- n 1)))))

(format t "Factorial of 5: ~a~%" (factorial 5))

;; Macros (Lisp's superpower!)
(defmacro when-positive (x &body body)
  \`(when (> ,x 0) ,@body))

(when-positive 5
  (format t "5 is positive!~%"))

;; Symbols and property lists
(setf (get 'alice 'age) 25)
(setf (get 'alice 'name) "Alice")
(format t "~a is ~a years old.~%" (get 'alice 'name) (get 'alice 'age))`
      }
    ]
  }
];

const prologTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-prolog-repl',
    type: 'folder',
    children: [
      {
        id: 'main-pl',
        name: 'main.pl',
        type: 'file',
        language: 'prolog',
        content: `%% Welcome to Prolog!
%% Logic programming for AI

%% Facts
parent(tom, bob).
parent(tom, liz).
parent(bob, ann).
parent(bob, pat).
parent(pat, jim).

male(tom).
male(bob).
male(jim).
female(liz).
female(ann).
female(pat).

%% Rules
father(X, Y) :- parent(X, Y), male(X).
mother(X, Y) :- parent(X, Y), female(X).
grandparent(X, Z) :- parent(X, Y), parent(Y, Z).
sibling(X, Y) :- parent(Z, X), parent(Z, Y), X \\= Y.

%% List operations
sum_list([], 0).
sum_list([H|T], Sum) :-
    sum_list(T, Rest),
    Sum is H + Rest.

%% Fibonacci
fib(0, 0).
fib(1, 1).
fib(N, F) :-
    N > 1,
    N1 is N - 1,
    N2 is N - 2,
    fib(N1, F1),
    fib(N2, F2),
    F is F1 + F2.

%% Query examples:
%% ?- parent(tom, X).
%% ?- grandparent(tom, X).
%% ?- sum_list([1,2,3,4,5], Sum).
%% ?- fib(10, F).`
      }
    ]
  }
];

const racketTemplate: FileNode[] = [
  {
    id: 'root',
    name: 'my-racket-repl',
    type: 'folder',
    children: [
      {
        id: 'main-rkt',
        name: 'main.rkt',
        type: 'file',
        language: 'racket',
        content: `#lang racket

;; Welcome to Racket!
;; Language-oriented programming

(displayln "Hello, Racket! 🎾")

;; Functions
(define (greet name)
  (string-append "Hello, " name "! Welcome to Racket."))

(displayln (greet "World"))

;; Lists and higher-order functions
(define numbers '(1 2 3 4 5))

(define doubled (map (λ (x) (* x 2)) numbers))
(printf "Doubled: ~a~n" doubled)

(define sum (foldl + 0 numbers))
(printf "Sum: ~a~n" sum)

;; Pattern matching
(define (describe x)
  (match x
    [0 "zero"]
    [1 "one"]
    [(? negative?) "negative"]
    [_ "positive"]))

(printf "5 is ~a~n" (describe 5))

;; Structs
(struct person (name age) #:transparent)

(define alice (person "Alice" 25))
(printf "~a is ~a years old.~n" (person-name alice) (person-age alice))

;; Recursion
(define (factorial n)
  (if (<= n 1)
      1
      (* n (factorial (- n 1)))))

(printf "Factorial of 5: ~a~n" (factorial 5))`
      }
    ]
  }
];
