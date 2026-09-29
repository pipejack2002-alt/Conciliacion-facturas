import { memo } from "react";

interface HighlightedTextProps {
  text: string | null | undefined;
  query?: string;
  className?: string;
}

export const HighlightedText = memo(function HighlightedText({
  text,
  query,
  className = "",
}: HighlightedTextProps) {
  if (!text) return null;
  if (!query || !query.trim()) {
    return <span className={className}>{text}</span>;
  }

  const cleanQuery = query.trim();
  const escaped = cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);

  return (
    <span className={className}>
      {parts.map((part, index) =>
        regex.test(part) ? (
          <mark
            key={index}
            className="rounded-sm bg-teal-500/25 text-inherit font-black px-0.5 py-0 shadow-2xs"
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  );
});
