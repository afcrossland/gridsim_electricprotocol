import { Box, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";

interface Props {
  sx?: SxProps<Theme>;
}

/**
 * "Data from [Ember logo]" credit, factored out 2026-09-10 so it can sit in
 * two places without duplicating the markup: inline in TopNavbar.tsx's own
 * header row on desktop, and as its own row in App.tsx's mobile footer
 * (moved there from a separate row below the header, per Andrew's
 * instruction the same day - the header was getting crowded).
 */
export default function EmberBadge({ sx }: Props) {
  const { t } = useTranslation();
  return (
    <Box
      component="a"
      href="https://ember-energy.org/"
      target="_blank"
      rel="noopener noreferrer"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.75,
        textDecoration: "none",
        "&:hover": { opacity: 0.8 },
        ...sx,
      }}
    >
      <Typography sx={{ fontSize: "0.7rem", color: "text.secondary" }}>{t("ember.dataFrom")}</Typography>
      {/* Ember's logo is dark navy text on a transparent background -
          unreadable against a dark-mode surface. A small white chip behind
          it (rather than a different asset - Ember doesn't publish a white
          variant we can verify/link to) keeps it legible in both themes;
          harmless in light mode too, where the surface is already white. */}
      <Box sx={{ bgcolor: "#fff", borderRadius: "4px", px: 0.75, py: 0.375, display: "flex" }}>
        <Box
          component="img"
          src={`${import.meta.env.BASE_URL}ember-logo.svg`}
          alt="Ember"
          sx={{ height: 14, display: "block" }}
        />
      </Box>
    </Box>
  );
}
