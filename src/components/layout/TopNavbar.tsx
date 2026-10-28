import { useCallback, useState } from "react";
import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";

import AppHeader from "../../../shared/components/AppHeader";
import AuthButton from "../../../shared/components/AuthButton";
import NavItem from "../../../shared/components/NavItem";
import { canEdit, useEditorStore } from "../../lib/editorAuth";
import { useProtocolStore } from "../../stores/protocolStore";
import EditorSignInDialog from "./EditorSignInDialog";

/**
 * Ported onto the shared `AppHeader`/`NavItem`/`AuthButton`
 * (`shared/components/`) 2026-09-19, per Andrew's own instruction
 * ("header buttons/features... should be the same and common") - the
 * identity block, dark-mode toggle, and nav-link/auth-button *look* are
 * now shared; this app's own store-coupling (no props - reads
 * `useProtocolStore` directly) and its own actual page-navigation
 * behaviour (Tour/Help/Admin console all really do something here, not
 * placeholders like the other two apps' equivalents) stay exactly as they
 * were.
 */
export default function TopNavbar() {
  const { t } = useTranslation();
  const setTourSeen = useProtocolStore((s) => s.setTourSeen);
  const page = useProtocolStore((s) => s.page);
  const setPage = useProtocolStore((s) => s.setPage);
  const mode = useProtocolStore((s) => s.mode);
  const setMode = useProtocolStore((s) => s.setMode);
  const editorStatus = useEditorStore((s) => s.status);
  const [signInOpen, setSignInOpen] = useState(false);

  // On builds that edit the shared database the console needs an editor's
  // sign-in first (lib/editorAuth.ts); elsewhere it opens straight away.
  const toggleAdmin = () => {
    if (page === "admin") setPage("map");
    else if (canEdit({ status: editorStatus })) setPage("admin");
    else setSignInOpen(true);
  };
  const onSignedIn = useCallback(() => {
    setSignInOpen(false);
    setPage("admin");
  }, [setPage]);

  // The logo leaves this app entirely, back to the Electric Futures
  // Playbook splash - the site root now (this app itself moved to
  // /policy/, see vite.config.ts). A real page navigation, not SPA state,
  // since that page is a separate static file outside React's own
  // routing. BASE_URL (not a hardcoded "/") so this still resolves
  // correctly under GitHub Pages' repo-name subpath as well as a custom
  // domain served at the root.
  const goHome = () => {
    window.location.href = import.meta.env.BASE_URL;
  };

  return (
    <AppHeader
      title={t("appName")}
      byline={
        <>
          {t("byGsc")}&ensp;·&ensp;
          <Box component="span" sx={{ color: "#FBB114", fontStyle: "italic", fontWeight: 600 }}>
            {t("tagline")}
          </Box>
        </>
      }
      mode={mode}
      setMode={setMode}
      onLogoClick={goHome}
      darkModeTooltip={{ toLight: t("theme.switchToLight"), toDark: t("theme.switchToDark") }}
    >
      <Box sx={{ display: "flex", alignItems: "stretch", height: "100%" }}>
        <Box data-tour="nav-links" sx={{ display: "flex", alignItems: "center" }}>
          {/* Tour and Help merged into this one button 2026-09-20 ("combine
              the tour and help... Click help, get the welcome to screen and
              then have a new button which is 'read documentation'") -
              clicking it reopens the tour's own hero scene (`setTourSeen`
              false), which has its own "Read documentation" pill
              (`onReadDocs` above) for a visitor who wants the Help page's
              written topics instead of the guided walkthrough. */}
          {page !== "admin" && (
            <NavItem active={page === "help"} onClick={() => setTourSeen(false)}>
              {t("nav.help")}
            </NavItem>
          )}

          {/* Opens the admin console - behind an editor's Google sign-in on
              builds that edit the shared database (EditorSignInDialog), open
              to anyone on builds that only keep edits in this browser. A
              quiet text link rather than the filled button: it's for the
              few people editing answers, not the public reading them. */}
          <AuthButton label={t("nav.adminConsole")} mode={mode} variant="text" tooltip={t("nav.adminConsole")} onClick={toggleAdmin} />
        </Box>
      </Box>
      <EditorSignInDialog open={signInOpen} onClose={() => setSignInOpen(false)} onSignedIn={onSignedIn} />
    </AppHeader>
  );
}
