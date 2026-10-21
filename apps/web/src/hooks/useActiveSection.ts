import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Tracks which in-page section is currently in view so the sidebar can highlight it.
 * Sections that share a row (e.g. Assistant and Tasks on desktop) start at the same offset,
 * so the section the user last chose wins ties; otherwise the first in document order does.
 */
export function useActiveSection(ids: readonly string[]) {
  const [active, setActive] = useState<string>(ids[0] ?? "");
  const chosen = useRef<string | undefined>(undefined);
  const key = ids.join("|");

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const threshold = window.innerHeight * 0.4;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      const tops = ids.map((id) => ({ id, top: document.getElementById(id)?.getBoundingClientRect().top ?? Infinity }));
      const reached = tops.filter((t) => t.top <= threshold);
      let next = ids[0] ?? "";
      if (reached.length) {
        const nearest = Math.max(...reached.map((t) => t.top));
        const tied = reached.filter((t) => nearest - t.top < 12).map((t) => t.id);
        next = chosen.current && tied.includes(chosen.current) ? chosen.current : (tied[0] ?? next);
      }
      if (atBottom && window.scrollY > 0) {
        const last = ids[ids.length - 1];
        const lastVisible = last ? tops.find((t) => t.id === last) : undefined;
        if (lastVisible && lastVisible.top < window.innerHeight) next = lastVisible.id;
      }
      setActive(next);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [key]);

  const choose = useCallback((id: string) => {
    chosen.current = id;
    setActive(id);
  }, []);

  return { active, choose };
}
