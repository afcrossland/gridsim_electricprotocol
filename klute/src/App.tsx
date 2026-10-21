import { useEffect, useState } from "react";
import type { PaletteMode } from "@mui/material/styles";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import LogoutIcon from "@mui/icons-material/Logout";
import PolicyPanel from "./panels/PolicyPanel";
import DeploymentPanel from "./panels/DeploymentPanel";
import CalculatorPanel from "./panels/CalculatorPanel";
import FgsPanel from "./panels/FgsPanel";
import OverviewPanel from "./panels/OverviewPanel";

const TEAL = "#01ADBF";
const base = import.meta.env.BASE_URL;

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "fgs", label: "Future Grid Simulator" },
  { id: "policy", label: "Policy Explorer" },
  { id: "deployment", label: "Deployment Explorer" },
  { id: "calculator", label: "Solar Homes Calculator" },
] as const;
type TabId = (typeof TABS)[number]["id"];

interface Props {
  mode: PaletteMode;
  setMode: (m: PaletteMode) => void;
}

// /klute: the data behind each explorer, and where it has gaps. Sign-in happens before this
// page is served at all: the sign-in gate (klute/gate/) only hands it to allowed Google accounts.
export default function App({ mode, setMode }: Props) {
  const [tab, setTab] = useState<TabId>("overview");
  // Who the gate signed in; stays null on the local dev server, which has no gate.
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Data explorer";
    fetch("/klute/whoami")
      .then((res) => (res.ok ? res.json() : null))
      .then((d: { email?: string } | null) => setEmail(d?.email ?? null))
      .catch(() => setEmail(null));
  }, []);

  const signOut = async () => {
    await fetch("/klute/logout", { method: "POST" });
    window.location.reload();
  };

  // shared/index.css locks html/body to the viewport (the other apps are full-screen maps), so
  // this page scrolls inside its own container instead of the document.
  return (
    <Box sx={{ height: "100vh", overflowY: "auto", bgcolor: "background.default", color: "text.primary" }}>
      <Box component="header" sx={{ display: "flex", alignItems: "center", gap: 2, px: 3, py: 1.5, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="h6" component="h1" sx={{ fontWeight: 600 }}>
          Data explorer
        </Typography>
        <Link href={base} underline="hover" sx={{ color: TEAL }}>
          ← Electric Futures
        </Link>
        <Box sx={{ flex: 1 }} />
        {email && (
          <>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {email}
            </Typography>
            <Button size="small" startIcon={<LogoutIcon />} onClick={signOut}>
              Sign out
            </Button>
          </>
        )}
        <IconButton aria-label="Toggle light/dark mode" onClick={() => setMode(mode === "dark" ? "light" : "dark")}>
          {mode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
        </IconButton>
      </Box>
      <Box sx={{ px: 3, pt: 2, pb: 6, maxWidth: 1800, mx: "auto" }}>
        <Tabs
          value={tab}
          onChange={(_, v: TabId) => setTab(v)}
          variant="scrollable"
          slotProps={{ indicator: { sx: { bgcolor: TEAL } } }}
          sx={{ borderBottom: 1, borderColor: "divider", "& .MuiTab-root": { textTransform: "none", backgroundColor: "transparent", color: "text.secondary" }, "& .MuiTab-root.Mui-selected": { color: TEAL, backgroundColor: "transparent" } }}
        >
          {TABS.map((t) => (
            <Tab key={t.id} value={t.id} label={t.label} />
          ))}
        </Tabs>
        {tab === "overview" && <OverviewPanel onOpenExplorer={setTab} />}
        {tab === "fgs" && <FgsPanel />}
        {tab === "policy" && <PolicyPanel />}
        {tab === "deployment" && <DeploymentPanel />}
        {tab === "calculator" && <CalculatorPanel />}
      </Box>
    </Box>
  );
}
