import { Box, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

interface Props {
  onBack: () => void;
}

/**
 * Simple, plain-language reference page - matches ep_policymap's
 * HelpPage.tsx structure exactly (back arrow + h2 header, a centered
 * max-width column of topic sections). Content rewritten 2026-09-11 to
 * Andrew's own wording verbatim (previously a looser, more conversational
 * paraphrase) - sections now mix bullet lists, bold terms, and a formula
 * line, so each is its own hand-written block rather than driven by a
 * single plain-string `Topic[]` the way the old copy was; that shape
 * couldn't express bullets/bold/a formula without turning `body` into
 * marked-up HTML, which was more machinery than five sections warranted.
 */
export default function HelpPage({ onBack }: Props) {
  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", minWidth: 0 }}>
      <Box
        sx={{
          px: 3,
          py: 2,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Tooltip title="Back">
          <IconButton size="small" onClick={onBack}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Typography variant="h2">How this works</Typography>
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", p: 3, display: "flex", justifyContent: "center" }}>
        <Stack spacing={3} sx={{ maxWidth: 720, width: "100%" }}>
          <Box>
            <Typography variant="h6" gutterBottom>
              What this tool shows
            </Typography>
            <Typography variant="body2">
              This map shows the scale of solar power across countries using three measures:
            </Typography>
            <Box component="ul" sx={{ my: 1, pl: 3 }}>
              <Typography component="li" variant="body2">
                <strong>Installed capacity</strong> — total solar capacity installed
              </Typography>
              <Typography component="li" variant="body2">
                <strong>Capacity per person</strong> — installed capacity relative to population
              </Typography>
              <Typography component="li" variant="body2">
                <strong>Solar share of electricity</strong> — proportion of electricity generation from solar
              </Typography>
            </Box>
            <Typography variant="body2">Use the controls at the bottom of the map to switch between views.</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              All countries are available on the free tier. Members can access additional measures.
            </Typography>
          </Box>

          <Box>
            <Typography variant="h6" gutterBottom>
              Exploring the map
            </Typography>
            <Typography variant="body2">
              Select a country on the map, or search by name, to view its data and historical trend.
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Use the arrow to return to the country list. The <strong>Filter</strong> button allows you to restrict
              the map to particular continents.
            </Typography>
          </Box>

          <Box>
            <Typography variant="h6" gutterBottom>
              Data and methodology
            </Typography>
            <Typography variant="body2">
              Data is sourced from{" "}
              <Box
                component="a"
                href="https://ember-energy.org/"
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: "primary.main", fontWeight: 700 }}
              >
                Ember
              </Box>{" "}
              and the{" "}
              <Box
                component="a"
                href="https://data.worldbank.org/"
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: "primary.main", fontWeight: 700 }}
              >
                World Bank
              </Box>
              .
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Installed solar capacity and solar's share of electricity are taken directly from Ember's published
              datasets. Population data used for the per-person measure comes from the World Bank.
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              The only measure calculated by this tool is <strong>capacity per person</strong>:
            </Typography>
            <Typography
              variant="body2"
              sx={{
                my: 1,
                py: 1,
                px: 1.5,
                borderRadius: 1,
                bgcolor: "action.hover",
                fontFamily: "monospace",
                textAlign: "center",
              }}
            >
              installed solar capacity ÷ population
            </Typography>
            <Typography variant="body2">
              All other figures are reproduced from the source datasets without modification.
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              The datasets are published under the <strong>Creative Commons Attribution 4.0 licence</strong>.
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              <Box
                component="a"
                href="https://creativecommons.org/licenses/by/4.0/"
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: "primary.main" }}
              >
                Creative Commons Attribution 4.0 licence
              </Box>
            </Typography>
          </Box>

          <Box>
            <Typography variant="h6" gutterBottom>
              Data availability
            </Typography>
            <Typography variant="body2">
              Data availability varies between countries and measures. If you have additional data or identify an
              error, please contact us.
            </Typography>
          </Box>

          <Box>
            <Typography variant="h6" gutterBottom>
              Data updates
            </Typography>
            <Typography variant="body2">
              Figures reflect the data available when this tool was last updated. The update date is shown within
              the tool.
            </Typography>
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}
