import { useMemo } from "react";
import { FileNode } from "@/types/ide";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { AlertCircle, Cpu, MessageSquare, Zap, BookOpen } from "lucide-react";

interface MinecraftEditorProps {
  files: FileNode[];
  currentFile: FileNode | null;
  onFileChange?: (fileId: string) => void;
}

/**
 * Minecraft Editor Component
 * Provides a specialized interface for Minecraft scripting with Eaglercraft
 * Shows the game environment alongside the code editor and provides examples
 */
export function MinecraftEditor({
  files,
  currentFile,
}: MinecraftEditorProps) {
  // Find key files in the minecraft project
  const minecraftFiles = useMemo(() => {
    const gameJs = files.find((f) => f.name === "game.js");
    const indexHtml = files.find((f) => f.name === "index.html");
    const examplesJs = files.find((f) => f.name === "examples.js");
    const readme = files.find((f) => f.name === "README.md");
    const tutorial = files.find((f) => f.name === "TUTORIAL.md");

    return {
      gameJs,
      indexHtml,
      examplesJs,
      readme,
      tutorial,
    };
  }, [files]);

  return (
    <div className="w-full h-full flex flex-col gap-4 p-4 bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="text-2xl">⛏️🎮</div>
        <div>
          <h1 className="text-xl font-bold text-white">Minecraft Scripting</h1>
          <p className="text-sm text-slate-400">
            Control your Minecraft world with JavaScript
          </p>
        </div>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="editor" className="flex-1 flex flex-col">
        <TabsList className="bg-slate-700 border-b border-slate-600">
          <TabsTrigger value="editor" className="flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            Editor
          </TabsTrigger>
          <TabsTrigger value="examples" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Examples
          </TabsTrigger>
          <TabsTrigger value="help" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Help
          </TabsTrigger>
        </TabsList>

        {/* Editor Tab */}
        <TabsContent value="editor" className="flex-1">
          <Card className="bg-slate-800 border-slate-700 h-full">
            <div className="p-4 h-full flex flex-col">
              <div className="mb-4 p-3 bg-blue-900/30 border border-blue-700 rounded flex items-start gap-3">
                <Zap className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-200">
                  <p className="font-semibold">Pro Tip:</p>
                  <p>
                    The game preview is shown in the right panel. Use{" "}
                    <code className="bg-slate-900 px-2 py-1 rounded text-xs">
                      movePlayer()
                    </code>
                    ,{" "}
                    <code className="bg-slate-900 px-2 py-1 rounded text-xs">
                      placeBlock()
                    </code>
                    , and{" "}
                    <code className="bg-slate-900 px-2 py-1 rounded text-xs">
                      mineBlock()
                    </code>{" "}
                    functions to control the world.
                  </p>
                </div>
              </div>

              <div className="flex-1 min-h-0 bg-slate-900 rounded border border-slate-600 overflow-auto">
                <div className="p-4 font-mono text-sm text-slate-400">
                  {currentFile?.language === "javascript" ? (
                    <div>
                      <p className="text-green-400">// {currentFile.name}</p>
                      <p className="mt-2 text-slate-300">
                        Edit the code in the left panel and click "Run" to see
                        changes in the game view.
                      </p>
                      <p className="mt-4 text-yellow-400">
                        Available functions:
                      </p>
                      <ul className="mt-2 space-y-1 text-slate-400">
                        <li>• movePlayer(x, y, z)</li>
                        <li>• placeBlock(x, y, z, blockType)</li>
                        <li>• mineBlock(x, y, z)</li>
                        <li>• resetGame()</li>
                      </ul>
                    </div>
                  ) : (
                    <p className="text-slate-400">
                      Select a JavaScript file to edit
                    </p>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Examples Tab */}
        <TabsContent value="examples" className="flex-1">
          <Card className="bg-slate-800 border-slate-700 h-full overflow-auto">
            <div className="p-4 space-y-4">
              <h3 className="font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Popular Examples
              </h3>

              {minecraftFiles.examplesJs && (
                <div className="space-y-3">
                  <ExampleCard
                    title="Build a House"
                    code="buildSimpleHouse()"
                    description="Create a simple 5x5 house structure with walls and foundation"
                  />
                  <ExampleCard
                    title="Build a Tower"
                    code="buildTower(10, 0, 0)"
                    description="Stack blocks vertically to create a tall structure"
                  />
                  <ExampleCard
                    title="Create Checkerboard"
                    code="buildCheckerboard(10)"
                    description="Create a checkerboard pattern on the ground"
                  />
                  <ExampleCard
                    title="Build Pyramid"
                    code="buildPyramid(10)"
                    description="Build a step pyramid structure"
                  />
                  <ExampleCard
                    title="Build Sphere"
                    code="buildSphere(5, 0, 70, 0)"
                    description="Create a 3D sphere of blocks"
                  />
                </div>
              )}

              <div className="text-xs text-slate-500 pt-4 border-t border-slate-700">
                Copy code snippets and paste them into the editor to run them.
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Help Tab */}
        <TabsContent value="help" className="flex-1">
          <Card className="bg-slate-800 border-slate-700 h-full overflow-auto">
            <div className="p-4 space-y-4">
              <h3 className="font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Getting Started
              </h3>

              <div className="space-y-4 text-sm text-slate-400">
                <div>
                  <h4 className="font-semibold text-white mb-2">
                    Step 1: Write Code
                  </h4>
                  <p>
                    Open <code className="bg-slate-900 px-1 rounded">game.js</code> and write JavaScript code using
                    these functions:
                  </p>
                  <ul className="mt-2 space-y-1 ml-4">
                    <li>
                      • <code className="text-green-400">movePlayer(x, y, z)</code>
                    </li>
                    <li>
                      • <code className="text-green-400">
                        placeBlock(x, y, z, type)
                      </code>
                    </li>
                    <li>
                      • <code className="text-green-400">mineBlock(x, y, z)</code>
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-white mb-2">
                    Step 2: Run Your Script
                  </h4>
                  <p>
                    Click the <strong>Run</strong> button in the preview panel
                    to execute your code.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold text-white mb-2">
                    Step 3: See Results
                  </h4>
                  <p>
                    Watch the game view update in real-time as you build your
                    Minecraft structures!
                  </p>
                </div>

                <div className="bg-slate-900/50 border border-slate-700 rounded p-3 mt-4">
                  <p className="font-semibold text-white mb-2">Common Coordinates</p>
                  <p className="text-xs">
                    Y=64 is approximately ground level. X and Z are horizontal.
                    Try starting at (0, 64, 0)
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ExampleCard({
  title,
  code,
  description,
}: {
  title: string;
  code: string;
  description: string;
}) {
  return (
    <div className="bg-slate-700/50 border border-slate-600 rounded p-3 hover:bg-slate-700/70 transition cursor-pointer">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <h4 className="font-semibold text-white text-sm">{title}</h4>
          <p className="text-xs text-slate-400 mt-1">{description}</p>
          <code className="text-xs bg-slate-900 text-green-400 px-2 py-1 rounded inline-block mt-2">
            {code}
          </code>
        </div>
      </div>
    </div>
  );
}
