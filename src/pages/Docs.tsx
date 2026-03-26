import { useEffect } from "react";
import { useParams } from "react-router-dom";

/**
 * Redirects to the external Mintlify-hosted documentation site.
 * The old in-app docs hub has been replaced.
 */
export default function Docs() {
  const { slug } = useParams<{ slug: string }>();

  useEffect(() => {
    const base = "https://code-canvas-docs.mintlify.app";
    const target = slug ? `${base}/${slug}` : base;
    window.location.replace(target);
  }, [slug]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <p className="text-muted-foreground">Redirecting to docs…</p>
    </div>
  );
}
