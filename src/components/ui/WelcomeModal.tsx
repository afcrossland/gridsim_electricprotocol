import { Box, Button, Divider, Typography } from "@mui/material";

import { CHARTER } from "../../data/charter";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Opening screen carrying the Citizens Electrification Charter.
 *
 * The Charter is the argument the scoring rests on, so it goes in front of the
 * map rather than behind an about link. Dismissal is remembered, and the About
 * button in the navbar brings it back.
 */
export default function WelcomeModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <Box
      onClick={onClose}
      sx={{
        position: "fixed",
        inset: 0,
        // Above ScrollStory's own z-index (300) - the Charter can now open
        // on top of the still-running tour (its "Read the Citizens..."
        // pill), not just after the tour has ended.
        zIndex: 310,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
    >
      {/* Same dark top/bottom vignette as the onboarding tour's hero scene
          (see ScrollStory.tsx), rather than a flat tint - the Charter reads
          as a direct continuation of that opening screen, not a different
          kind of overlay. */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 45%)",
          pointerEvents: "none",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, transparent 25%)",
          pointerEvents: "none",
        }}
      />

      <Box
        onClick={(e) => e.stopPropagation()}
        sx={{
          position: "relative",
          // Frosted, matching the tour hero card's own CARD_BASE exactly.
          bgcolor: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.6)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
          borderRadius: 3,
          px: { xs: 3, sm: 5 },
          py: 4,
          maxWidth: 660,
          width: "100%",
          maxHeight: "90vh",
          // Header and button stay put; only the Charter text scrolls, so the
          // way out of the dialog is always visible.
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2, flexShrink: 0 }}>
          <Box
            component="img"
            src={`${import.meta.env.BASE_URL}favicon.png`}
            alt=""
            sx={{ height: 44, width: 44, flexShrink: 0 }}
          />
          <Box>
            <Typography variant="overline" sx={{ display: "block", lineHeight: 1.2 }}>
              Solar Policy Explorer
            </Typography>
            <Typography variant="h2">{CHARTER.title}</Typography>
          </Box>
        </Box>

        <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", pr: 1 }}>
          {CHARTER.intro.map((para) => (
            <Typography key={para.slice(0, 32)} variant="body1" sx={{ mb: 1.5 }}>
              {para}
            </Typography>
          ))}

          <Divider sx={{ my: 2.5 }} />

          {CHARTER.rights.map((right) => (
            <Box key={right.heading} sx={{ mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                {right.heading}
              </Typography>
              <Typography variant="body1">{right.body}</Typography>
            </Box>
          ))}

          <Divider sx={{ my: 2.5 }} />

          <Typography variant="body2">
            This site scores countries, states and provinces against the Electric
            Protocol - the detailed question set behind the Charter. Pick a
            jurisdiction on the map to see how it does, what the evidence is, and
            which changes would raise its score the most.
          </Typography>
        </Box>

        <Button
          variant="contained"
          size="large"
          onClick={onClose}
          fullWidth
          sx={{ mt: 3, flexShrink: 0 }}
        >
          Return
        </Button>
      </Box>
    </Box>
  );
}
