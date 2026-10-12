import { useEffect, useState } from "react";
import type { PaletteMode } from "@mui/material/styles";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { alreadyUnlocked, gateConfigured, lock, tryUnlock } from "./lib/gate";
import PolicyPanel from "./panels/PolicyPanel";
import DeploymentPanel from "./panels/DeploymentPanel";
import CalculatorPanel from "./panels/CalculatorPanel";
import FgsPanel from "./panels/FgsPanel";

const TEAL = "#01ADBF";
const base = import.meta.env.BASE_URL;

const TABS = [
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

// /klute: the data behind each explorer, and where it has gaps. Behind a password (see
// lib/gate.ts for what that does and does not protect).
export default function App({ mode, setMode }: Props) {
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<TabId>("fgs");

  useEffect(() => {
    document.title = "Data explorer";
    alreadyUnlocked().then((ok) => {
      setUnlocked(ok);
      setChecking(false);
    });
  }, []);

  if (checking) return null;
  if (!unlocked) return <Gate onUnlock={() => setUnlocked(true)} />;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", color: "text.primary" }}>
      <Box component="header" sx={{ display: "flex", alignItems: "center", gap: 2, px: 3, py: 1.5, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="h6" component="h1" sx={{ fontWeight: 600 }}>
          Data explorer
        </Typography>
        <Link href={base} underline="hover" sx={{ color: TEAL }}>
          ← Electric Futures
        </Link>
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          startIcon={<LockOutlinedIcon />}
          onClick={() => {
            lock();
            setUnlocked(false);
          }}
        >
          Lock
        </Button>
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
        {tab === "fgs" && <FgsPanel />}
        {tab === "policy" && <PolicyPanel />}
        {tab === "deployment" && <DeploymentPanel />}
        {tab === "calculator" && <CalculatorPanel />}
      </Box>
    </Box>
  );
}

function Gate({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const configured = gateConfigured();
  const submit = async () => {
    if (await tryUnlock(password)) onUnlock();
    else setError(configured ? "Wrong password." : "The data explorer is not configured.");
  };
  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "background.default", p: 2 }}>
      <Paper sx={{ p: 4, width: 360, maxWidth: "100%", textAlign: "center" }}>
        <LockOutlinedIcon sx={{ color: TEAL, fontSize: 36 }} />
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
          Data explorer
        </Typography>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <TextField
            autoFocus
            fullWidth
            type="password"
            label="Password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            error={Boolean(error)}
            helperText={error ?? " "}
          />
          <Button type="submit" variant="contained" fullWidth sx={{ bgcolor: TEAL, "&:hover": { bgcolor: "#0195A5" } }}>
            Unlock
          </Button>
        </form>
      </Paper>
    </Box>
  );
}
