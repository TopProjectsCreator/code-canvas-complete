import { useEffect } from "react";

const REDACTOR_HREF = "/redactor-favicon.ico";

export function RedactorFavicon() {
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"][type="image/png"]');
    const prev = link?.getAttribute("href");
    if (link) link.setAttribute("href", REDACTOR_HREF);
    return () => {
      if (link && prev) link.setAttribute("href", prev);
    };
  }, []);
  return null;
}
