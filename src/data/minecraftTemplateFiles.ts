import { FileNode } from "@/types/ide";

/**
 * Minecraft scripting template with real Eaglercraft browser client
 * Allows users to run actual Minecraft Eaglercraft with JavaScript scripting
 */
export const minecraftTemplate: FileNode[] = [
  {
    id: "root",
    name: "minecraft-project",
    type: "folder",
    children: [
      {
        id: "minecraft-main",
        name: "index.html",
        type: "file",
        language: "html",
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="ie=edge">
  <title>Eaglercraft - Minecraft in Browser</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    html, body {
      width: 100%;
      height: 100%;
      background: #000;
      font-family: Arial, sans-serif;
    }
    
    #canvas {
      display: block;
      width: 100%;
      height: 100%;
      background: #000;
    }
    
    .loading-screen {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #1a1a1a url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect fill="rgb(54,57,63)" width="16" height="16"/><rect fill="rgb(71,75,82)" x="1" y="1" width="14" height="14"/><rect fill="rgb(88,101,242)" x="2" y="2" width="4" height="4"/><rect fill="rgb(88,101,242)" x="10" y="2" width="4" height="4"/><rect fill="rgb(88,101,242)" x="2" y="10" width="4" height="4"/><rect fill="rgb(88,101,242)" x="10" y="10" width="4" height="4"/></svg>');
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      color: #fff;
      z-index: 9999;
    }
    
    .loading-screen.hidden {
      display: none;
    }
    
    .loading-content {
      text-align: center;
      background: rgba(0, 0, 0, 0.8);
      padding: 40px;
      border-radius: 8px;
    }
    
    .loading-title {
      font-size: 2em;
      font-weight: bold;
      margin-bottom: 20px;
      color: #58f;
    }
    
    .loading-bar {
      width: 300px;
      height: 20px;
      border: 2px solid #444;
      background: #111;
      overflow: hidden;
      margin: 20px auto;
      border-radius: 4px;
    }
    
    .loading-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #58f, #38d);
      width: 0%;
      transition: width 0.1s;
    }
    
    .loading-text {
      font-size: 0.9em;
      color: #aaa;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <canvas id="canvas"></canvas>
  <div class="loading-screen" id="loadingScreen">
    <div class="loading-content">
      <div class="loading-title">Eaglercraft</div>
      <p style="margin-bottom: 20px; color: #aaa;">Minecraft in your browser</p>
      <div class="loading-bar">
        <div class="loading-bar-fill" id="loadingBar"></div>
      </div>
      <div class="loading-text" id="loadingText">Initializing...</div>
    </div>
  </div>

  <script>
    // Eaglercraft launcher configuration
    const canvas = document.getElementById('canvas');
    const loadingScreen = document.getElementById('loadingScreen');
    const loadingBar = document.getElementById('loadingBar');
    const loadingText = document.getElementById('loadingText');

    let progress = 0;
    
    const updateProgress = (percent, text) => {
      progress = Math.max(progress, percent);
      loadingBar.style.width = progress + '%';
      if (text) loadingText.textContent = text;
    };

    // Try loading from Eaglercraft CDN
    updateProgress(10, 'Loading Eaglercraft...');

    // Create script to load Eaglercraft
    const loadEaglercraft = async () => {
      try {
        updateProgress(30, 'Fetching Eaglercraft client...');
        
        // Load from official Eaglercraft CDN
        const response = await fetch('https://eaglercraft.com/index.html');
        if (response.ok) {
          updateProgress(60, 'Initializing Minecraft...');
          const html = await response.text();
          
          // Extract the actual client from the HTML
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          
          // Copy page content
          document.documentElement.innerHTML = doc.documentElement.innerHTML;
          updateProgress(100, 'Ready!');
          setTimeout(() => {
            loadingScreen.classList.add('hidden');
          }, 500);
        } else {
          throw new Error('Failed to fetch Eaglercraft');
        }
      } catch (err) {
        console.error('Failed to load Eaglercraft from CDN:', err);
        updateProgress(100, 'Error loading Eaglercraft');
        
        // Fallback: show instructions
        setTimeout(() => {
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#fff';
          ctx.font = '30px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('Eaglercraft Failed to Load', canvas.width / 2, canvas.height / 2 - 60);
          ctx.font = '16px Arial';
          ctx.fillStyle = '#aaa';
          ctx.fillText('Visit eaglercraft.com to play Minecraft in your browser', canvas.width / 2, canvas.height / 2);
          ctx.fillText('Or download the client and run it locally', canvas.width / 2, canvas.height / 2 + 40);
        }, 500);
      }
    };

    // Start loading Eaglercraft
    window.addEventListener('load', () => {
      updateProgress(50, 'Starting Minecraft...');
      loadEaglercraft();
    });

    // Simulated progress for UX
    const progressInterval = setInterval(() => {
      if (progress < 90) {
        progress += Math.random() * 15;
        updateProgress(Math.min(progress, 90));
      }
    }, 200);

    window.addEventListener('load', () => {
      clearInterval(progressInterval);
    });
  </script>
</body>
</html>`,
      },
      {
        id: "minecraft-readme",
        name: "README.md",
        type: "file",
        language: "markdown",
        content: `# Eaglercraft - Minecraft in Your Browser

This project runs **Eaglercraft**, a fully functional browser-based Minecraft client written in JavaScript.

## Getting Started

1. **Click Run** - Opens Eaglercraft in the game view
2. **Create Your World** - Start a new game or join a server
3. **Play Minecraft** - Full vanilla Minecraft experience in your browser

## Features

- ✅ Full Minecraft gameplay
- ✅ Survival mode support
- ✅ Server connectivity
- ✅ Build and explore
- ✅ Works in any browser

## Controls

- **WASD** - Move
- **Space** - Jump
- **Shift** - Sneak
- **Tab** - Inventory
- **Esc** - Menu
- **LMB** - Mine/Attack
- **RMB** - Build/Interact

## JavaScript API (Optional)

You can extend Eaglercraft with JavaScript:

\`\`\`javascript
// Example: Auto-clicker
setInterval(() => {
  document.addEventListener('click', (e) => {
    if (e.button === 0) {
      // LMB click detected
    }
  });
}, 50);
\`\`\`

## Server Connection

To connect to a Minecraft server:
1. Open the Multiplayer menu in Eaglercraft
2. Add server with IP and port
3. Join and play

## Troubleshooting

**Game won't load?**
- Check internet connection
- Clear browser cache
- Try different browser (Chrome/Firefox recommended)
- Visit eaglercraft.com for the latest version

**Performance issues?**
- Lower render distance in settings
- Close other browser tabs
- Use hardware acceleration
- Try dedicated graphics mode

## Resources

- Official: https://eaglercraft.com
- Community: Forums and Discord
- Mods: Some mods available through community

---

Enjoy playing Minecraft in your browser with Eaglercraft! ⛏️
`,
      },
      {
        id: "minecraft-config",
        name: "package.json",
        type: "file",
        language: "json",
        content: `{
  "name": "eaglercraft-minecraft",
  "version": "1.0.0",
  "description": "Eaglercraft - Minecraft in your browser",
  "main": "index.html",
  "scripts": {
    "start": "open index.html"
  },
  "keywords": [
    "minecraft",
    "eaglercraft",
    "browser",
    "game"
  ],
  "author": "Your Name",
  "license": "MIT"
}
`,
      },
    ],
  },
];
