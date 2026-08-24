import { useRef, useState } from "react";
import { Box, Button, Divider, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

import type { CountryScore } from "../../lib/types";
import { useProtocolStore } from "../../stores/protocolStore";
import JurisdictionSearch from "../map/JurisdictionSearch";
import CountryPanel, { WINDROSE, type CountryPanelTab } from "./CountryPanel";

interface Props {
  scores: CountryScore[];
  primaryCode: string;
  primaryScore: CountryScore;
  /** Null until a second jurisdiction has been picked - the right pane shows a search box instead. */
  compareCode: string | null;
  /** Hides the comparison and returns to the single-panel view of `primaryCode` - the compare pick is kept, so reopening compare restores it without picking again. */
  onHideCompare: () => void;
  /** Leaves the detail view entirely, back to the scoreboard - a different action from just hiding the comparison. */
  onBackToScoreboard: () => void;
  onPickCompare: (code: string) => void;
  onRemoveCompare: () => void;
}

/**
 * Two country pages side by side, full width (the map gives up its space
 * entirely - see App.tsx). Scrolling either pane scrolls the other to match,
 * so the same section stays aligned in both while reading down the page.
 *
 * The sync is a plain mutual scrollTop mirror rather than anything content-
 * aware (matching section headings, say) - the two countries can have
 * different tab/section selections already, so "the same pixel offset" is
 * the only definition of "matches" that holds regardless of what each pane
 * is actually showing.
 *
 * Two distinct ways out, not one: the header's "Hide comparison" button only
 * hides the comparison (the picked compare country is kept, so opening
 * Compare again restores it instantly); the back arrow leaves the detail
 * view entirely, back to the scoreboard. Conflating the two used to mean
 * there was no way to just collapse the comparison without losing the pick.
 *
 * Both panels share one tab and one section selection, driven from whichever
 * panel's own controls are clicked - both cover the same question set
 * regardless of which country each shows, so "section 4" or "the Windrose
 * tab" means the same thing on either side. A shared tab is also what makes
 * the scroll-position mirror above actually mean something; two panels on
 * different tabs have no shared notion of "the same place" to scroll to.
 */
export default function CompareView({
  scores,
  primaryCode,
  primaryScore,
  compareCode,
  onHideCompare,
  onBackToScoreboard,
  onPickCompare,
  onRemoveCompare,
}: Props) {
  const sections = useProtocolStore((s) => s.sections);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);
  const [tab, setTab] = useState<CountryPanelTab>(WINDROSE);
  const [sectionId, setSectionId] = useState<string>(sections[0]?.id ?? "");

  const mirror = (source: React.RefObject<HTMLDivElement | null>, target: React.RefObject<HTMLDivElement | null>) => () => {
    if (syncing.current) return;
    if (!source.current || !target.current) return;
    syncing.current = true;
    target.current.scrollTop = source.current.scrollTop;
    syncing.current = false;
  };

  const compareScore = compareCode ? scores.find((s) => s.code === compareCode) : undefined;

  return (
    <Box sx={{ height: "100%", display: "flex", overflow: "hidden" }}>
      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <CountryPanel
          code={primaryCode}
          score={primaryScore}
          onBack={onBackToScoreboard}
          contentRef={leftRef}
          onContentScroll={mirror(leftRef, rightRef)}
          tab={tab}
          onTabChange={setTab}
          sectionId={sectionId}
          onSectionChange={setSectionId}
          headerAction={
            <Button size="small" startIcon={<CloseIcon fontSize="small" />} onClick={onHideCompare}>
              Hide comparison
            </Button>
          }
        />
      </Box>

      <Divider orientation="vertical" flexItem />

      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {compareCode && compareScore ? (
          <CountryPanel
            code={compareCode}
            score={compareScore}
            contentRef={rightRef}
            onContentScroll={mirror(rightRef, leftRef)}
            tab={tab}
            onTabChange={setTab}
            sectionId={sectionId}
            onSectionChange={setSectionId}
            hideTabs
            headerAction={
              <Button size="small" startIcon={<CloseIcon fontSize="small" />} onClick={onRemoveCompare}>
                Remove from comparison
              </Button>
            }
          />
        ) : (
          <Box sx={{ p: 3 }}>
            <Typography variant="h2" gutterBottom>
              Compare with
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Pick a second jurisdiction to see it side by side with {primaryScore.name}.
            </Typography>
            <JurisdictionSearch scores={scores} selected={null} onSelect={onPickCompare} />
          </Box>
        )}
      </Box>
    </Box>
  );
}
