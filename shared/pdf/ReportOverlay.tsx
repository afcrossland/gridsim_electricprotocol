import { useEffect, useRef, useState } from "react";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import PdfPreview from "./PdfPreview";

export interface ReportOverlayLabels {
  preview: string;
  making: string;
  ready: string;
  failed: string;
  openTab: string;
  /** "Page {n} of {total}" - names each page for assistive technology. */
  pageOf: (n: number, total: number) => string;
  download: string;
  close: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Makes the PDF. Called once each time the overlay opens. */
  build: () => Promise<Blob>;
  fileName: string;
  labels: ReportOverlayLabels;
  /** Save the file as soon as it is ready instead of only showing the preview. */
  autoDownload?: boolean;
}

type State = { status: "making" } | { status: "failed" } | { status: "ready"; url: string; blob: Blob };

/**
 * Report preview, shared by every Electric Protocol app. The report is a real, tagged PDF made in the browser: the
 * preview is that same file, and Download saves it. Nothing is sent anywhere.
 */
export default function ReportOverlay({ open, onClose, build, fileName, labels, autoDownload = false }: Props) {
  const [state, setState] = useState<State>({ status: "making" });
  const link = useRef<HTMLAnchorElement>(null);
  const saved = useRef(false);
  // The inputs cannot change while the (modal) dialog is open, so the file is made once each time it opens.
  const latestBuild = useRef(build);
  latestBuild.current = build;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let url: string | null = null;
    saved.current = false;
    setState({ status: "making" });
    latestBuild
      .current()
      .then((blob) => {
        url = URL.createObjectURL(blob);
        if (cancelled) URL.revokeObjectURL(url);
        else setState({ status: "ready", url, blob });
      })
      .catch((error) => {
        console.error("The report could not be made", error);
        if (!cancelled) setState({ status: "failed" });
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [open]);

  useEffect(() => {
    if (state.status !== "ready" || !autoDownload || saved.current) return;
    saved.current = true;
    link.current?.click();
  }, [state, autoDownload]);

  return (
    <Dialog open={open} onClose={onClose} fullScreen aria-labelledby="report-title">
      <DialogTitle id="report-title">{labels.preview}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 1, pb: 1 }}>
        <Typography role="status" variant="body2" color="text.secondary">
          {state.status === "making" ? labels.making : state.status === "ready" ? labels.ready : ""}
        </Typography>
        {state.status === "failed" && <Alert severity="error">{labels.failed}</Alert>}
        {state.status === "ready" && (
          <>
            <PdfPreview blob={state.blob} pageLabel={labels.pageOf} />
            <Typography variant="body2">
              <a href={state.url} target="_blank" rel="noreferrer">
                {labels.openTab}
              </a>
            </Typography>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          ref={link}
          component="a"
          variant="contained"
          disableElevation
          startIcon={<DownloadIcon />}
          href={state.status === "ready" ? state.url : undefined}
          download={state.status === "ready" ? fileName : undefined}
          disabled={state.status !== "ready"}
        >
          {labels.download}
        </Button>
        <Button variant="outlined" color="inherit" onClick={onClose}>
          {labels.close}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
