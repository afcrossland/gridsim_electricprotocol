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
        bgcolor: "rgba(0,0,0,0.35)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
    >
      <Box
        onClick={(e) => e.stopPropagation()}
        sx={{
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 3,
          px: { xs: 3, sm: 5 },
          py: 4,
          maxWidth: 660,
          width: "100%",
          maxHeight: "90vh",
          boxShadow: 21,
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
              Solar Policy Wiki
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
          Explore the policy map
        </Button>
      </Box>
    </Box>
  );
}
