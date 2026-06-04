export type PreviewType =
  | "image" | "markdown" | "svg" | "video" | "audio"
  | "csv" | "office" | "cad" | "rtf" | "zip" | "sqlite"
  | "mermaid" | "ipynb" | "draw" | "pdf" | "tex" | "scratch"
  | "font" | null;

const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "ico", "bmp"];
const VIDEO_EXTS = ["mp4", "webm", "mov", "avi", "mkv", "ogv", "ogg"];
const AUDIO_EXTS = ["mp3", "wav", "flac", "aac", "m4a"];
const CAD_EXTS = ["stl", "obj", "stp", "step", "iges", "igs", "dxf", "fcstd", "3mf", "amf", "ply", "fbx", "dae", "usd", "usda", "usdc", "usdz", "vrml", "x3d", "3ds", "jt", "blend"];
const FONT_EXTS = ["ttf", "otf", "woff", "woff2"];

export const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'mdx', 'markdown', 'js', 'ts', 'tsx', 'jsx',
  'json', 'html', 'css', 'scss', 'xml', 'yml', 'yaml', 'csv',
  'env', 'gitignore', 'py', 'java', 'c', 'cpp', 'h', 'hpp',
  'rs', 'go', 'php', 'rb', 'sh', 'sql', 'mmd', 'mermaid',
]);

export function getPreviewType(fileName: string): PreviewType {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "tex" || ext === "latex" || ext === "ltx") return "tex";
  if (ext === "draw") return "draw";
  if (ext === "rtf") return "rtf";
  if (ext === "svg") return "svg";
  if (ext === "mmd" || ext === "mermaid") return "mermaid";
  if (ext === "md" || ext === "mdx" || ext === "markdown") return "markdown";
  if (ext === "csv") return "csv";
  if (IMAGE_EXTS.includes(ext || "")) return "image";
  if (VIDEO_EXTS.includes(ext || "")) return "video";
  if (AUDIO_EXTS.includes(ext || "")) return "audio";
  if (["docx", "xlsx", "pptx"].includes(ext || "")) return "office";
  if (["zip"].includes(ext || "")) return "zip";
  if (["db", "sqlite", "sqlite3"].includes(ext || "")) return "sqlite";
  if (["ipynb"].includes(ext || "")) return "ipynb";
  if (CAD_EXTS.includes(ext || "")) return "cad";
  if (FONT_EXTS.includes(ext || "")) return "font";
  if (["sb3", "sb2", "sb"].includes(ext || "")) return "scratch";
  return null;
}

export function getExt(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() || "";
}
