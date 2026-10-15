import { Link } from "@mui/material";

const URL_PATTERN = /(https?:\/\/[^\s;,<>"')\]]+[^\s;,.<>"')\]])/g;

/**
 * Renders text with any http(s) URLs turned into links that open in a new tab.
 * Evidence sources and notes are free text - often several URLs separated by
 * "; " - so every URL in the string is linked, not just a whole-string one.
 */
export default function Linkified({ text }: { text: string }) {
  const parts = text.split(URL_PATTERN);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <Link key={i} href={part} target="_blank" rel="noopener noreferrer" underline="hover" sx={{ wordBreak: "break-word" }}>
            {part}
          </Link>
        ) : (
          part
        ),
      )}
    </>
  );
}
