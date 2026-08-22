import { Box, Divider, IconButton, Paper, Slider, Tooltip, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { protocol, useProtocolStore } from "../../stores/protocolStore";

interface Props {
  onBack: () => void;
}

/**
 * Settings as a sidebar view rather than a full-screen takeover, so the map
 * stays visible (and clickable) while a setting is being changed - picking a
 * jurisdiction here has the same effect as picking one anywhere else.
 */
export default function SettingsPage({ onBack }: Props) {
  const thresholdValue = useProtocolStore((s) => s.threshold);
  const setThreshold = useProtocolStore((s) => s.setThreshold);
  const threshold = Math.round(thresholdValue * 100);

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ px: 3, py: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
        <Tooltip title="Back">
          <IconButton size="small" onClick={onBack}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Typography variant="h2">Settings</Typography>
      </Box>
      <Divider />

      <Box sx={{ flex: 1, overflowY: "auto", p: 3 }}>
        <Typography variant="body2" sx={{ mb: 2 }}>
          These affect how the map and scoreboard read the same underlying data - nothing here changes any answer.
        </Typography>

        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="h6" gutterBottom>
            Completeness threshold
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            How much of a jurisdiction's question weight needs an answer before it is
            coloured on the map and ranked on the scoreboard. Below this, a
            jurisdiction is shown grey and left out of the ranking.
          </Typography>

          <Box
            sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 0.5 }}
          >
            <Typography variant="overline">Threshold</Typography>
            <Typography variant="h5">{threshold}%</Typography>
          </Box>

          <Slider
            min={0}
            max={100}
            step={5}
            value={threshold}
            onChange={(_, v) => setThreshold((v as number) / 100)}
            marks={[
              {
                value: Math.round(protocol.completenessThreshold * 100),
                label: "Default",
              },
            ]}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `${v}%`}
          />
        </Paper>
      </Box>
    </Box>
  );
}
