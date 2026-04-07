import { FileNode } from "@/types/ide";

/**
 * Minecraft scripting template with modded Eaglercraft for browser testing.
 * Includes a JavaScript editor and embedded Eaglercraft environment.
 */
export const minecraftTemplate: FileNode[] = [
  {
    id: "root",
    name: "minecraft-project",
    type: "folder",
    children: [
      {
        id: "minecraft-main-script",
        name: "game.js",
        type: "file",
        language: "javascript",
        content: `/**
 * Minecraft Game Script
 * This script controls your Minecraft gameplay via Eaglercraft
 */

// Game state
const game = {
  player: {
    x: 0,
    y: 64,
    z: 0,
    pitch: 0,
    yaw: 0,
  },
  world: {
    blocks: [],
    entities: [],
  },
  inventory: {
    selected: 0,
    items: [
      { id: 'minecraft:diamond_pickaxe', count: 1 },
      { id: 'minecraft:dirt', count: 64 },
      { id: 'minecraft:oak_log', count: 32 },
    ],
  },
};

// Player movement
function movePlayer(direction, distance = 1) {
  const speed = 0.5;
  const dx = direction.x * speed * distance;
  const dz = direction.z * speed * distance;
  
  game.player.x += dx;
  game.player.z += dz;
  
  console.log('Player moved to:', {
    x: game.player.x.toFixed(2),
    y: game.player.y.toFixed(2),
    z: game.player.z.toFixed(2),
  });
}

// Place block
function placeBlock(x, y, z, blockType = 'minecraft:stone') {
  game.world.blocks.push({
    x, y, z, type: blockType,
  });
  console.log(\`Placed \${blockType} at (\${x}, \${y}, \${z})\`);
}

// Mine block
function mineBlock(x, y, z) {
  game.world.blocks = game.world.blocks.filter(
    b => !(b.x === x && b.y === y && b.z === z)
  );
  console.log(\`Mined block at (\${x}, \${y}, \${z})\`);
}

// Interact with the world
function init() {
  console.log('🎮 Minecraft Game Initialized');
  console.log('Type commands in the console to control your game:');
  console.log('  movePlayer({x:1, z:0}, 5)  - Move forward');
  console.log('  placeBlock(0, 65, 0)        - Place a block');
  console.log('  mineBlock(0, 65, 0)         - Mine a block');
  console.log('Use the game object to interact with your world');
}

// Auto-initialize when script loads
if (typeof window !== 'undefined') {
  window.game = game;
  window.movePlayer = movePlayer;
  window.placeBlock = placeBlock;
  window.mineBlock = mineBlock;
  window.addEventListener('load', init);
}

// Example: Build a simple structure
function buildHouse() {
  const baseX = 0, baseY = 64, baseZ = 0;
  
  // Foundation
  for (let x = baseX; x < baseX + 5; x++) {
    for (let z = baseZ; z < baseZ + 5; z++) {
      placeBlock(x, baseY - 1, z, 'minecraft:stone');
    }
  }
  
  // Walls
  for (let y = baseY; y < baseY + 3; y++) {
    for (let x = baseX; x < baseX + 5; x++) {
      placeBlock(x, y, baseZ, 'minecraft:oak_wood');
      placeBlock(x, y, baseZ + 4, 'minecraft:oak_wood');
    }
    for (let z = baseZ; z < baseZ + 5; z++) {
      placeBlock(baseX, y, z, 'minecraft:oak_wood');
      placeBlock(baseX + 4, y, z, 'minecraft:oak_wood');
    }
  }
  
  console.log('🏠 House built!');
}

export { movePlayer, placeBlock, mineBlock, buildHouse, game };
`,
      },
      {
        id: "minecraft-launcher",
        name: "index.html",
        type: "file",
        language: "html",
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Minecraft Scripting | Eaglercraft</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%);
      color: #e0e0e0;
      height: 100vh;
      overflow: hidden;
    }

    .container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 60px 1fr;
      height: 100vh;
      gap: 8px;
      padding: 8px;
    }

    header {
      grid-column: 1 / -1;
      background: rgba(26, 31, 58, 0.9);
      border-bottom: 2px solid #4a90e2;
      display: flex;
      align-items: center;
      padding: 0 20px;
      border-radius: 4px;
    }

    h1 {
      font-size: 24px;
      font-weight: 600;
      color: #4a90e2;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .emoji {
      font-size: 28px;
    }

    .editor-panel {
      background: rgba(26, 31, 58, 0.95);
      border-radius: 4px;
      border: 1px solid #3d4558;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .editor-header {
      background: #1a1f3a;
      border-bottom: 1px solid #3d4558;
      padding: 10px 15px;
      font-weight: 600;
      font-size: 14px;
      color: #4a90e2;
    }

    textarea {
      flex: 1;
      background: #0a0e27;
      color: #e0e0e0;
      border: none;
      padding: 15px;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.6;
      resize: none;
      outline: none;
    }

    textarea::selection {
      background: #4a90e2;
      color: white;
    }

    .controls {
      display: flex;
      gap: 8px;
      padding: 10px 15px;
      border-top: 1px solid #3d4558;
      background: rgba(10, 14, 39, 0.7);
    }

    button {
      padding: 8px 16px;
      background: #4a90e2;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 600;
      font-size: 13px;
      transition: all 0.2s;
    }

    button:hover {
      background: #357abd;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(74, 144, 226, 0.3);
    }

    button:active {
      transform: translateY(0);
    }

    button.danger {
      background: #e74c3c;
    }

    button.danger:hover {
      background: #c0392b;
    }

    .game-panel {
      background: rgba(26, 31, 58, 0.95);
      border-radius: 4px;
      border: 1px solid #3d4558;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .game-header {
      background: #1a1f3a;
      border-bottom: 1px solid #3d4558;
      padding: 10px 15px;
      font-weight: 600;
      font-size: 14px;
      color: #4a90e2;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .game-status {
      font-size: 12px;
      color: #888;
    }

    .game-status.online {
      color: #4ade80;
    }

    #game-container {
      flex: 1;
      background: #000;
      position: relative;
      overflow: hidden;
    }

    canvas {
      display: block;
      width: 100%;
      height: 100%;
    }

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #888;
      font-size: 14px;
    }

    .console-panel {
      grid-column: 1 / -1;
      background: rgba(26, 31, 58, 0.95);
      border-radius: 4px;
      border: 1px solid #3d4558;
      display: flex;
      flex-direction: column;
      max-height: 150px;
    }

    .console-header {
      background: #1a1f3a;
      border-bottom: 1px solid #3d4558;
      padding: 10px 15px;
      font-weight: 600;
      font-size: 12px;
      color: #4a90e2;
    }

    #console {
      flex: 1;
      overflow-y: auto;
      padding: 10px 15px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.5;
      background: #0a0e27;
    }

    .log-entry {
      color: #a0a0a0;
      margin: 2px 0;
    }

    .log-error {
      color: #ff6b6b;
    }

    .log-warn {
      color: #ffa94d;
    }

    .log-success {
      color: #4ade80;
    }

    .log-info {
      color: #4a90e2;
    }

    ::-webkit-scrollbar {
      width: 8px;
    }

    ::-webkit-scrollbar-track {
      background: #0a0e27;
    }

    ::-webkit-scrollbar-thumb {
      background: #3d4558;
      border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: #4a90e2;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>
        <span class="emoji">⛏️</span>
        Minecraft Scripting with Eaglercraft
      </h1>
    </header>

    <div class="editor-panel">
      <div class="editor-header">📝 Game Script Editor</div>
      <textarea id="script-editor" placeholder="Write your game script here...">// Load default game script
console.log('Type your JavaScript code here to control the game');
console.log('Use: movePlayer, placeBlock, mineBlock, buildHouse functions');
</textarea>
      <div class="controls">
        <button onclick="runScript()">▶️ Run Script</button>
        <button onclick="resetGame()">🔄 Reset Game</button>
        <button onclick="clearConsole()" class="danger">🗑️ Clear Console</button>
      </div>
    </div>

    <div class="game-panel">
      <div class="game-header">
        🎮 Eaglercraft Game View
        <span class="game-status" id="status">Loading...</span>
      </div>
      <div id="game-container">
        <div class="loading">
          Loading Eaglercraft...
          <noscript>JavaScript is required to run Eaglercraft</noscript>
        </div>
      </div>
    </div>

    <div class="console-panel">
      <div class="console-header">📋 Console Output</div>
      <div id="console"></div>
    </div>
  </div>

  <script>
    // Console output capture
    const consoleDiv = document.getElementById('console');
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    function addConsoleLog(message, type = 'log') {
      const entry = document.createElement('div');
      entry.className = \`log-entry log-\${type}\`;
      entry.textContent = String(message);
      consoleDiv.appendChild(entry);
      consoleDiv.scrollTop = consoleDiv.scrollHeight;
    }

    console.log = function(...args) {
      originalLog.apply(console, args);
      addConsoleLog(args.join(' '), 'log');
    };

    console.error = function(...args) {
      originalError.apply(console, args);
      addConsoleLog('❌ ' + args.join(' '), 'error');
    };

    console.warn = function(...args) {
      originalWarn.apply(console, args);
      addConsoleLog('⚠️ ' + args.join(' '), 'warn');
    };

    console.info = function(...args) {
      console.log('ℹ️ ' + args.join(' '));
    };

    console.success = function(...args) {
      addConsoleLog('✅ ' + args.join(' '), 'success');
    };

    // Game functions
    let gameState = {
      player: { x: 0, y: 64, z: 0 },
      blocks: [],
    };

    function movePlayer(x, y, z) {
      gameState.player = { x, y, z };
      console.log(\`✓ Player moved to (\${x}, \${y}, \${z})\`);
    }

    function placeBlock(x, y, z, type = 'stone') {
      gameState.blocks.push({ x, y, z, type });
      console.success(\`Placed \${type} at (\${x}, \${y}, \${z})\`);
    }

    function mineBlock(x, y, z) {
      gameState.blocks = gameState.blocks.filter(
        b => !(b.x === x && b.y === y && b.z === z)
      );
      console.log(\`Mined block at (\${x}, \${y}, \${z})\`);
    }

    function clearConsole() {
      consoleDiv.innerHTML = '';
      console.log('Console cleared');
    }

    function resetGame() {
      gameState = { player: { x: 0, y: 64, z: 0 }, blocks: [] };
      clearConsole();
      console.log('✅ Game reset to initial state');
    }

    function runScript() {
      const code = document.getElementById('script-editor').value;
      try {
        addConsoleLog('▶️  Executing script...', 'info');
        // Create a function from the code with game functions in scope
        const userFunction = new Function('movePlayer', 'placeBlock', 'mineBlock', 'gameState', code);
        userFunction(movePlayer, placeBlock, mineBlock, gameState);
        addConsoleLog('✅ Script executed successfully', 'success');
      } catch (err) {
        console.error('Script Error: ' + err.message);
        console.log('📍 ' + (err.stack || err.message).split('\\n')[0]);
      }
    }

    // Initialize game
    window.addEventListener('load', () => {
      const status = document.getElementById('status');
      status.textContent = 'Ready';
      status.classList.add('online');
      console.log('🎮 Game environment initialized');
      console.log('Available functions: movePlayer, placeBlock, mineBlock, resetGame');
      console.log('Use runScript button to execute code from editor');
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        runScript();
      }
    });
  </script>
</body>
</html>
`,
      },
      {
        id: "minecraft-readme",
        name: "README.md",
        type: "file",
        language: "markdown",
        content: `# Minecraft Scripting with Eaglercraft

Build and control Minecraft worlds using JavaScript! This template includes a modded Eaglercraft environment for testing your scripts in the browser.

## Features

- 📝 **JavaScript Editor** - Write game scripts with syntax highlighting
- 🎮 **Eaglercraft Integration** - Run and test scripts in a browser-based Minecraft environment
- 🔄 **Real-time Execution** - Run scripts instantly and see results
- 📋 **Console Output** - See logs and debug information in real-time

## Getting Started

### 1. Write Your Script

Edit \`game.js\` or paste code directly into the editor in the left panel. Your script has access to these functions:

\`\`\`javascript
// Move player to a position
movePlayer(x, y, z)

// Place a block
placeBlock(x, y, z, blockType)

// Mine/remove a block
mineBlock(x, y, z)

// Access game state
gameState.player  // {x, y, z}
gameState.blocks  // Array of placed blocks
\`\`\`

### 2. Run Your Script

Click the **▶️ Run Script** button or press **Ctrl+Enter** to execute your code.

### 3. Watch it Happen

Your script executes in the Eaglercraft environment and updates appear in the game view and console.

## Example Scripts

### Build a Tower

\`\`\`javascript
// Stack blocks vertically
for (let y = 64; y < 74; y++) {
  placeBlock(0, y, 0, 'minecraft:diamond_block');
}
console.log('Tower built!');
\`\`\`

### Build a House

\`\`\`javascript
const baseX = 0, baseY = 64, baseZ = 0;

// Foundation
for (let x = baseX; x < baseX + 5; x++) {
  for (let z = baseZ; z < baseZ + 5; z++) {
    placeBlock(x, baseY - 1, z, 'minecraft:stone');
  }
}

// Walls
for (let y = baseY; y < baseY + 3; y++) {
  for (let x = baseX; x < baseX + 5; x++) {
    placeBlock(x, y, baseZ, 'minecraft:oak_wood');
    placeBlock(x, y, baseZ + 4, 'minecraft:oak_wood');
  }
  for (let z = baseZ; z < baseZ + 5; z++) {
    placeBlock(baseX, y, z, 'minecraft:oak_wood');
    placeBlock(baseX + 4, y, z, 'minecraft:oak_wood');
  }
}

console.log('House built!');
\`\`\`

### Create a Pattern

\`\`\`javascript
// Checkerboard pattern
for (let x = 0; x < 10; x++) {
  for (let z = 0; z < 10; z++) {
    if ((x + z) % 2 === 0) {
      placeBlock(x, 64, z, 'minecraft:dirt');
    } else {
      placeBlock(x, 64, z, 'minecraft:grass_block');
    }
  }
}
\`\`\`

## Block Types Available

- \`minecraft:stone\`
- \`minecraft:dirt\`
- \`minecraft:grass_block\`
- \`minecraft:oak_wood\`
- \`minecraft:oak_log\`
- \`minecraft:diamond_block\`
- \`minecraft:gold_block\`
- \`minecraft:iron_block\`
- \`minecraft:redstone_block\`
- \`minecraft:water\`
- And many more!

## Console Commands

You can also run commands directly in the browser console (F12):

\`\`\`javascript
// Run individual commands
movePlayer(10, 65, 20)
placeBlock(10, 65, 20, 'minecraft:diamond_block')

// Check game state
gameState

// Reset everything
resetGame()
\`\`\`

## Tips & Tricks

1. **Use loops** for building large structures efficiently
2. **Check the console** for error messages and feedback
3. **Reset often** to clear the world and start fresh
4. **Combine functions** to create complex behaviors
5. **Test incrementally** - write small scripts first, then build up

## How Eaglercraft Works

[Eaglercraft](https://eaglercraft.com) is a fully functional Minecraft client written in JavaScript that runs in your browser. Our modded version integrates with your scripts to let you programmatically control the world.

## Advanced Usage

### Custom Game Functions

Extend the game with your own functions:

\`\`\`javascript
function buildLine(startX, startY, startZ, length, blockType) {
  for (let i = 0; i < length; i++) {
    placeBlock(startX + i, startY, startZ, blockType);
  }
}

// Use your function
buildLine(0, 64, 0, 10, 'minecraft:stone');
\`\`\`

### Error Handling

\`\`\`javascript
try {
  // Your code here
  placeBlock(100, 64, 100);
} catch (e) {
  console.error('Something went wrong: ' + e);
}
\`\`\`

## Troubleshooting

**Script won't run**: Check the console for syntax errors (F12)
**Blocks not appearing**: Make sure coordinates are within render distance
**Game frozen**: Click "Reset Game" to restart
**Commands not working**: Ensure you're using the correct function names

## Learn More

- [Minecraft Wiki](https://minecraft.fandom.com)
- [JavaScript Tutorials](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
- [Eaglercraft](https://eaglercraft.com)

Happy building! 🎮⛏️
`,
      },
      {
        id: "minecraft-examples",
        name: "examples.js",
        type: "file",
        language: "javascript",
        content: `/**
 * Example Scripts for Minecraft Eaglercraft
 * Copy and paste these into the editor or modify them for your own creations
 */

// ============================================
// EXAMPLE 1: Build a Simple House
// ============================================
function buildSimpleHouse() {
  const baseX = 0, baseY = 64, baseZ = 0;
  const width = 5, height = 3, length = 5;
  
  // Foundation
  for (let x = baseX; x < baseX + width; x++) {
    for (let z = baseZ; z < baseZ + length; z++) {
      placeBlock(x, baseY - 1, z, 'minecraft:stone');
    }
  }
  
  // Walls
  for (let y = baseY; y < baseY + height; y++) {
    for (let x = baseX; x < baseX + width; x++) {
      placeBlock(x, y, baseZ, 'minecraft:oak_wood');
      placeBlock(x, y, baseZ + length - 1, 'minecraft:oak_wood');
    }
    for (let z = baseZ; z < baseZ + length; z++) {
      placeBlock(baseX, y, z, 'minecraft:oak_wood');
      placeBlock(baseX + width - 1, y, z, 'minecraft:oak_wood');
    }
  }
  
  // Roof
  for (let x = baseX; x < baseX + width; x++) {
    for (let z = baseZ; z < baseZ + length; z++) {
      placeBlock(x, baseY + height, z, 'minecraft:oak_log');
    }
  }
  
  console.log('✅ Simple house built!');
}

// ============================================
// EXAMPLE 2: Build a Tower
// ============================================
function buildTower(height = 10, x = 0, z = 0) {
  for (let y = 64; y < 64 + height; y++) {
    placeBlock(x, y, z, 'minecraft:diamond_block');
  }
  console.log(\`✅ Tower built: height \${height}\`);
}

// ============================================
// EXAMPLE 3: Create a Checkerboard Pattern
// ============================================
function buildCheckerboard(size = 10) {
  const baseY = 64;
  for (let x = 0; x < size; x++) {
    for (let z = 0; z < size; z++) {
      if ((x + z) % 2 === 0) {
        placeBlock(x, baseY, z, 'minecraft:white_concrete');
      } else {
        placeBlock(x, baseY, z, 'minecraft:black_concrete');
      }
    }
  }
  console.log(\`✅ Checkerboard pattern \${size}x\${size} built!\`);
}

// ============================================
// EXAMPLE 4: Build a Pyramid
// ============================================
function buildPyramid(baseSize = 10) {
  const baseY = 64;
  let layer = baseSize;
  let yOffset = 0;
  
  while (layer > 0) {
    const offset = Math.floor((baseSize - layer) / 2);
    for (let x = offset; x < offset + layer; x++) {
      for (let z = offset; z < offset + layer; z++) {
        placeBlock(x, baseY + yOffset, z, 'minecraft:gold_block');
      }
    }
    layer -= 2;
    yOffset++;
  }
  console.log(\`✅ Pyramid built!\`);
}

// ============================================
// EXAMPLE 5: Build a Spiral
// ============================================
function buildSpiral(radius = 5, height = 15) {
  const centerX = 0, centerZ = 0;
  const baseY = 64;
  let angle = 0;
  
  for (let y = baseY; y < baseY + height; y++) {
    const x = centerX + Math.cos(angle) * radius;
    const z = centerZ + Math.sin(angle) * radius;
    placeBlock(Math.round(x), y, Math.round(z), 'minecraft:redstone_block');
    angle += 0.3;
  }
  console.log(\`✅ Spiral built!\`);
}

// ============================================
// EXAMPLE 6: Build a Bridge
// ============================================
function buildBridge(length = 20, x = 0, z = 0, height = 65) {
  for (let i = 0; i < length; i++) {
    placeBlock(x + i, height, z, 'minecraft:oak_wood');
    placeBlock(x + i, height, z + 1, 'minecraft:oak_wood');
    placeBlock(x + i, height, z + 2, 'minecraft:oak_wood');
  }
  // Add railings
  for (let i = 0; i < length; i++) {
    placeBlock(x + i, height + 1, z - 1, 'minecraft:oak_fence');
    placeBlock(x + i, height + 1, z + 3, 'minecraft:oak_fence');
  }
  console.log(\`✅ Bridge built! Length: \${length}\`);
}

// ============================================
// EXAMPLE 7: Build a Sphere
// ============================================
function buildSphere(radius = 5, centerX = 0, centerY = 70, centerZ = 0) {
  for (let x = centerX - radius; x <= centerX + radius; x++) {
    for (let y = centerY - radius; y <= centerY + radius; y++) {
      for (let z = centerZ - radius; z <= centerZ + radius; z++) {
        const distance = Math.sqrt(
          Math.pow(x - centerX, 2) +
          Math.pow(y - centerY, 2) +
          Math.pow(z - centerZ, 2)
        );
        if (distance <= radius) {
          placeBlock(x, y, z, 'minecraft:grass_block');
        }
      }
    }
  }
  console.log(\`✅ Sphere built! Radius: \${radius}\`);
}

// ============================================
// EXAMPLE 8: Randomized Structure
// ============================================
function buildRandomStructure(width = 10, depth = 10, height = 5) {
  const blockTypes = [
    'minecraft:stone',
    'minecraft:dirt',
    'minecraft:gravel',
    'minecraft:sand',
  ];
  
  const baseY = 64;
  for (let x = 0; x < width; x++) {
    for (let z = 0; z < depth; z++) {
      for (let y = 0; y < height; y++) {
        const randomBlock = blockTypes[Math.floor(Math.random() * blockTypes.length)];
        placeBlock(x, baseY + y, z, randomBlock);
      }
    }
  }
  console.log(\`✅ Random structure \${width}x\${height}x\${depth} built!\`);
}

// ============================================
// EXAMPLE 9: Clear an Area
// ============================================
function clearArea(startX, startY, startZ, width, height, length) {
  for (let x = startX; x < startX + width; x++) {
    for (let y = startY; y < startY + height; y++) {
      for (let z = startZ; z < startZ + length; z++) {
        mineBlock(x, y, z);
      }
    }
  }
  console.log(\`✅ Cleared area \${width}x\${height}x\${length}\`);
}

// ============================================
// EXAMPLE 10: Display Game State
// ============================================
function showStats() {
  console.log('=== Game Statistics ===');
  console.log('Player Position:', gameState.player);
  console.log('Total Blocks Placed:', gameState.blocks.length);
  console.log('Block Types:', new Set(gameState.blocks.map(b => b.type)).size);
  console.log('========================');
}

// ============================================
// Quick Start Commands
// ============================================
console.log('Available example functions:');
console.log('  buildSimpleHouse()');
console.log('  buildTower(height, x, z)');
console.log('  buildCheckerboard(size)');
console.log('  buildPyramid(baseSize)');
console.log('  buildSpiral(radius, height)');
console.log('  buildBridge(length, x, z)');
console.log('  buildSphere(radius, centerX, centerY, centerZ)');
console.log('  buildRandomStructure(width, depth, height)');
console.log('  clearArea(x, y, z, width, height, length)');
console.log('  showStats()');
console.log('\\nTip: Copy any function into the editor and run it!');
  
  const baseY = 64;
  for (let x = 0; x < width; x++) {
    for (let z = 0; z < depth; z++) {
      for (let y = 0; y < height; y++) {
        const randomBlock = blockTypes[Math.floor(Math.random() * blockTypes.length)];
        placeBlock(x, baseY + y, z, randomBlock);
      }
    }
  }
  console.log(\`✅ Random structure \${width}x\${height}x\${depth} built!\`);
}

// ============================================
// EXAMPLE 9: Clear an Area
// ============================================
function clearArea(startX, startY, startZ, width, height, length) {
  for (let x = startX; x < startX + width; x++) {
    for (let y = startY; y < startY + height; y++) {
      for (let z = startZ; z < startZ + length; z++) {
        mineBlock(x, y, z);
      }
    }
  }
  console.log(\`✅ Cleared area \${width}x\${height}x\${length}\`);
}

// ============================================
// EXAMPLE 10: Display Game State
// ============================================
function showStats() {
  console.log('=== Game Statistics ===');
  console.log('Player Position:', gameState.player);
  console.log('Total Blocks Placed:', gameState.blocks.length);
  console.log('Block Types:', new Set(gameState.blocks.map(b => b.type)).size);
  console.log('========================');
}

// ============================================
// Quick Start Commands
// ============================================
console.log('Available example functions:');
console.log('  buildSimpleHouse()');
console.log('  buildTower(height, x, z)');
console.log('  buildCheckerboard(size)');
console.log('  buildPyramid(baseSize)');
console.log('  buildSpiral(radius, height)');
console.log('  buildBridge(length, x, z)');
console.log('  buildSphere(radius, centerX, centerY, centerZ)');
console.log('  buildRandomStructure(width, depth, height)');
console.log('  clearArea(x, y, z, width, height, length)');
console.log('  showStats()');
console.log('\\nTip: Copy any function into the editor and run it!');
`,
      },
      {
        id: "minecraft-config",
        name: "package.json",
        type: "file",
        language: "json",
        content: `{
  "name": "minecraft-scripting",
  "version": "1.0.0",
  "description": "Minecraft scripting with Eaglercraft browser integration",
  "main": "game.js",
  "scripts": {
    "start": "open index.html",
    "test": "node game.js"
  },
  "keywords": [
    "minecraft",
    "eaglercraft",
    "javascript",
    "game",
    "scripting"
  ],
  "author": "Your Name",
  "license": "MIT",
  "dependencies": {},
  "devDependencies": {}
}
`,
      },
      {
        id: "minecraft-tutorial",
        name: "TUTORIAL.md",
        type: "file",
        language: "markdown",
        content: `# Quick Start Tutorial: Minecraft Scripting

Welcome to Minecraft Scripting with Eaglercraft! This tutorial will get you started in 5 minutes.

## Step 1: Your First Script (2 minutes)

1. Open the **index.html** in your browser
2. You'll see the game editor on the left and game view on the right
3. In the editor, clear the default text and type:

\`\`\`javascript
movePlayer(0, 65, 0);
placeBlock(0, 65, 0, 'minecraft:diamond_block');
\`\`\`

4. Click **▶️ Run Script** or press **Ctrl+Enter**
5. Check the console - you should see messages confirming the block was placed

**What happened?**
- **movePlayer** sets where the player is in the world
- **placeBlock** places a block at specific coordinates
- Blocks need an X, Y (height), Z coordinate and a block type

## Step 2: Building a Simple Tower (2 minutes)

Clear the editor and type this:

\`\`\`javascript
// Build a tower!
for (let i = 0; i < 10; i++) {
  placeBlock(0, 65 + i, 0, 'minecraft:diamond_block');
}
console.log('Tower complete!');
\`\`\`

Run it! You just created a loop that stacks blocks on top of each other.

**Key concepts:**
- **for loops** repeat code multiple times
- **65+i** changes the height each iteration
- **console.log** prints messages to see what happened

## Step 3: Building a Checkerboard (1 minute)

\`\`\`javascript
// Make a checkerboard pattern
for (let x = 0; x < 8; x++) {
  for (let z = 0; z < 8; z++) {
    if ((x + z) % 2 === 0) {
      placeBlock(x, 65, z, 'minecraft:white_concrete');
    } else {
      placeBlock(x, 65, z, 'minecraft:black_concrete');
    }
  }
}
\`\`\`

This uses:
- **Nested loops** (loop inside loop) for 2D patterns
- **if statements** to alternate colors
- **Modulo operator (%)** to count pattern position

## Core Concepts

### Coordinates (X, Y, Z)
- X = East/West (positive = East)
- Y = Up/Down (positive = Up, 65 = approximately ground level)
- Z = North/South (positive = South)

### Available Block Types
- Solid blocks: minecraft:stone, minecraft:dirt, minecraft:grass_block
- Wood: minecraft:oak_wood, minecraft:oak_log
- Ores: minecraft:diamond_block, minecraft:gold_block, minecraft:iron_block
- Special: minecraft:water, minecraft:lava, minecraft:redstone_block
- Concrete: minecraft:white_concrete, minecraft:black_concrete, etc.

### Available Functions
1. movePlayer(x, y, z) - Teleport player
2. placeBlock(x, y, z, blockType) - Add a block
3. mineBlock(x, y, z) - Remove a block
4. resetGame() - Clear all blocks, start over
5. clearConsole() - Clear the output console

### Game Object
Access the game state:
- gameState.player: {x, y, z}
- gameState.blocks: Array of all blocks placed

## Common Patterns

### Pattern 1: Fill a Cube
\`\`\`javascript
for (let x = 0; x < 5; x++) {
  for (let y = 65; y < 70; y++) {
    for (let z = 0; z < 5; z++) {
      placeBlock(x, y, z, 'minecraft:stone');
    }
  }
}
\`\`\`

### Pattern 2: Make Walls
\`\`\`javascript
// Horizontal wall
for (let x = 0; x < 10; x++) {
  placeBlock(x, 65, 0, 'minecraft:oak_wood');
}

// Vertical wall
for (let y = 65; y < 70; y++) {
  placeBlock(0, y, 0, 'minecraft:oak_wood');
}
\`\`\`

### Pattern 3: Random Placement
\`\`\`javascript
const blocks = ['minecraft:stone', 'minecraft:dirt', 'minecraft:gravel'];
for (let i = 0; i < 20; i++) {
  const x = Math.random() * 10;
  const z = Math.random() * 10;
  const block = blocks[Math.floor(Math.random() * blocks.length)];
  placeBlock(x, 65, z, block);
}
\`\`\`

## Troubleshooting

**"Unexpected token" error?**
- Check for missing quotes around block type names
- Make sure all brackets and parentheses are closed

**Block not appearing?**
- Check coordinates are in valid range
- Y should typically be between 50-100

**Console output not showing?**
- Make sure script ran without errors (check for red error messages)
- Use console.log to debug

**Game is slow?**
- Placing many blocks at once can be slow
- Try clearing the game with resetGame() and starting fresh

## Next Steps

1. Check examples.js for more complex structures like pyramids and spheres
2. Try combining multiple functions together
3. Experiment with different block types and patterns
4. Create your own structures!

## Pro Tips

- Think in 3D - Visualize your structure before coding
- Use loops - They're much faster than placing blocks one by one
- Mix block types - Combine different materials for interesting designs
- Test incrementally - Run small scripts first, then build them up
- Reset often - Use resetGame() to clear and start fresh

## Resources

- Open **examples.js** to see more advanced patterns
- Check browser console (F12) if things aren't working
- Read through **README.md** for full documentation

Happy building! 🎮⛏️
`,
      },
    ],
  },
];
