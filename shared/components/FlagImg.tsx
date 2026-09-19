import { useEffect, useState } from "react";
import { Box } from "@mui/material";

/**
 * Flag for a jurisdiction code, from flagcdn. Confirmed 2026-09-19 that
 * deployment's and calculator's own copies were an intentional *subset* of
 * this one (their own doc comments said so - "simplified... no subnational-
 * code fallback chain or bundled local overrides, since this app is
 * country-level only"), not a different design: with no `localFlags` and no
 * dashed subnational codes ever passed in, this component's extra behaviour
 * below is simply inert for those two apps, so one copy now covers all
 * three. `localFlags` stays a prop rather than a baked-in constant because
 * only policy has subnational jurisdictions with a bundled override
 * (Quebec) - the asset itself stays in that app, not here.
 *
 * flagcdn carries subdivision flags for some countries but not others - US
 * states and the UK home nations have them, Australian states and every
 * Canadian province do not - so a subnational code is tried as-is (after any
 * local override) and falls back to its parent country's flag when that
 * 404s. A missing flag renders as a neutral placeholder rather than a broken
 * image, which matters because most of the world has no data yet and will be
 * browsed anyway.
 */
export default function FlagImg({
  code,
  size = 20,
  localFlags = {},
}: {
  code: string;
  size?: number;
  localFlags?: Record<string, string>;
}) {
  const [src, setSrc] = useState(() => localFlags[code.toUpperCase()] ?? flagUrl(code));
  const [failed, setFailed] = useState(false);

  // The code changes as the list is filtered and re-rendered, so reset rather
  // than keeping a previous jurisdiction's fallback.
  useEffect(() => {
    setSrc(localFlags[code.toUpperCase()] ?? flagUrl(code));
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
