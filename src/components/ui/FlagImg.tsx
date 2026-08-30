import { useEffect, useState } from "react";
import { Box } from "@mui/material";

import quebecFlag from "../../assets/flags/ca-qc.svg";

/**
 * Jurisdictions with a distinctive flag that flagcdn has no coverage for at
 * all - Canadian provinces are entirely absent from flagcdn (confirmed: every
 * ca-* subdivision 404s, not just some), so without this every province would
 * silently show Canada's flag regardless of the province asked for. Bundled
 * locally rather than pulled from another CDN, since the point is not
 * depending on a coverage gap in the first place. Add more entries here as
 * they come up rather than chasing a third-party flag source with better
 * coverage.
 */
const LOCAL_FLAGS: Record<string, string> = {
  "CA-QC": quebecFlag,
};

/**
 * Flag for a jurisdiction code.
 *
 * flagcdn carries subdivision flags for some countries but not others - US
 * states and the UK home nations have them, Australian states and every
 * Canadian province do not - so a subnational code is tried as-is (after the
 * local override above) and falls back to its parent country's flag when that
 * 404s. A missing flag renders as a neutral placeholder rather than a broken
 * image, which matters because most of the world has no data yet and will be
 * browsed anyway.
 */
export default function FlagImg({ code, size = 20 }: { code: string; size?: number }) {
  const [src, setSrc] = useState(() => LOCAL_FLAGS[code.toUpperCase()] ?? flagUrl(code));
  const [failed, setFailed] = useState(false);

  // The code changes as the list is filtered and re-rendered, so reset rather
  // than keeping a previous jurisdiction's fallback.
  useEffect(() => {
    setSrc(LOCAL_FLAGS[code.toUpperCase()] ?? flagUrl(code));
    setFailed(false);
  }, [code]);

  const height = Math.round(size * 0.75);

  if (!code || failed) {
    return (
      <Box
        sx={{
          width: size,
          height,
          borderRadius: 0.5,
          bgcolor: "action.selected",
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <img
      src={src}
      width={size}
      height={height}
      alt=""
      loading="lazy"
      onError={() => {
        const parent = parentOf(code);
        if (parent && src !== flagUrl(parent)) {
          setSrc(flagUrl(parent));
        } else {
          setFailed(true);
        }
      }}
      style={{
        display: "block",
        borderRadius: 3,
        objectFit: "cover",
        flexShrink: 0,
      }}
    />
  );
}

function flagUrl(code: string): string {
  return `https://flagcdn.com/${code.toLowerCase()}.svg`;
}

function parentOf(code: string): string | null {
  const dash = code.indexOf("-");
  return dash > 0 ? code.slice(0, dash) : null;
}
