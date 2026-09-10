import { useEffect, useState } from "react";
import { Box } from "@mui/material";

/**
 * Flag for a country code, from flagcdn - simplified from
 * ep_policymap/src/components/ui/FlagImg.tsx (no subnational-code fallback
 * chain or bundled local overrides, since this app is country-level only).
 * A missing/failed flag renders as a neutral placeholder rather than a
 * broken image.
 */
export default function FlagImg({ code, size = 20 }: { code: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [code]);

  const height = Math.round(size * 0.75);

  if (!code || failed) {
    return <Box sx={{ width: size, height, borderRadius: 0.5, bgcolor: "action.selected", flexShrink: 0 }} />;
  }

  return (
    <img
      src={`https://flagcdn.com/${code.toLowerCase()}.svg`}
      width={size}
      height={height}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      style={{ display: "block", borderRadius: 3, objectFit: "cover", flexShrink: 0 }}
    />
  );
}
