import { defineMcp } from "@lovable.dev/mcp-js";
import searchPublicCanvases from "./tools/search-public-canvases";
import getFeaturedCanvases from "./tools/get-featured-canvases";
import getCanvasCount from "./tools/get-canvas-count";

export default defineMcp({
  name: "codecanvas-mcp",
  title: "CodeCanvas MCP",
  version: "0.1.0",
  instructions:
    "Tools for exploring public CodeCanvas projects. Use `search_public_canvases` to find canvases by keyword, `get_featured_canvases` for the top-starred canvases, and `get_canvas_count` for the total number of canvases on the platform.",
  tools: [searchPublicCanvases, getFeaturedCanvases, getCanvasCount],
});
