import { auth, defineMcp } from "@lovable.dev/mcp-js";

// Public discovery tools
import searchPublicCanvases from "./tools/search-public-canvases";
import getFeaturedCanvases from "./tools/get-featured-canvases";
import getCanvasCount from "./tools/get-canvas-count";

// User-scoped tools (require OAuth)
import whoami from "./tools/whoami";
import listMyCanvases from "./tools/list-my-canvases";
import getCanvas from "./tools/get-canvas";
import createCanvas from "./tools/create-canvas";
import deleteCanvas from "./tools/delete-canvas";
import updateCanvasMeta from "./tools/update-canvas-meta";
import forkCanvas from "./tools/fork-canvas";
import listFiles from "./tools/list-files";
import readFile from "./tools/read-file";
import writeFile from "./tools/write-file";
import deleteFile from "./tools/delete-file";
import searchInCanvas from "./tools/search-in-canvas";
import addComment from "./tools/add-comment";
import listComments from "./tools/list-comments";
import resolveComment from "./tools/resolve-comment";
import starCanvas from "./tools/star-canvas";
import bookmarkCanvas from "./tools/bookmark-canvas";
import requestReview from "./tools/request-review";
import listReviews from "./tools/list-reviews";
import runCode from "./tools/run-code";
import runShell from "./tools/run-shell";
import getPreviewUrl from "./tools/get-preview-url";
import createContainer from "./tools/create-container";
import containerExec from "./tools/container-exec";
import containerWriteFile from "./tools/container-write-file";
import containerReadFile from "./tools/container-read-file";
import containerListFiles from "./tools/container-list-files";
import destroyContainer from "./tools/destroy-container";
import listMessages from "./tools/list-messages";
import sendMessage from "./tools/send-message";
import createSnapshot from "./tools/create-snapshot";
import listHistory from "./tools/list-history";
import restoreSnapshot from "./tools/restore-snapshot";

// The OAuth issuer MUST be the direct Supabase host, constructed from the project
// ref (Vite inlines VITE_SUPABASE_PROJECT_ID as a literal at build time so this
// stays import-safe).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "codecanvas-mcp",
  title: "CodeCanvas MCP",
  version: "0.2.0",
  instructions:
    "CodeCanvas MCP: everything the in-app AI assistant can do — sign in via OAuth to browse and edit your canvases, read/write files, run code in the execution sandbox, create and manage persistent containers (isolated bash + filesystem that preserves state between commands!), leave code comments, request reviews, star/bookmark, and manage inbox messages. Public discovery tools (search_public_canvases, get_featured_canvases, get_canvas_count) work without auth.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    // Public
    searchPublicCanvases,
    getFeaturedCanvases,
    getCanvasCount,
    // Identity
    whoami,
    // Canvas management
    listMyCanvases,
    getCanvas,
    createCanvas,
    deleteCanvas,
    updateCanvasMeta,
    forkCanvas,
    // Files
    listFiles,
    readFile,
    writeFile,
    deleteFile,
    searchInCanvas,
    // Collaboration
    addComment,
    listComments,
    resolveComment,
    requestReview,
    listReviews,
    starCanvas,
    bookmarkCanvas,
    // Execution / preview
    runCode,
    runShell,
    getPreviewUrl,
    // Container sessions (persistent bash + isolated filesystem)
    createContainer,
    containerExec,
    containerWriteFile,
    containerReadFile,
    containerListFiles,
    destroyContainer,
    // Messaging
    listMessages,
    sendMessage,
    // History / snapshots
    createSnapshot,
    listHistory,
    restoreSnapshot,
  ],
});
