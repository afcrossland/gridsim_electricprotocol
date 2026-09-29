import { useState } from "react";
import { Box, Button, Dialog, IconButton, TextField, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

import { tryLogin } from "../lib/membership";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Fires once the password is actually correct - the caller flips its own `member` state on this, so unlocked content updates immediately without a reload. */
  onSuccess: () => void;
}

/**
 * The password popup behind each app's own "Login" button - a client-side
 * gate, not real auth (see `shared/lib/membership.ts`'s own doc comment).
 * Styled in the same GSC identity every app's tour hero card and header use
 * (the logo mark, aqua title, Eastman Grotesque via the shared theme) so it
 * reads as the same product, not a generic browser-style prompt. One shared
 * component - each app just renders it behind its own "Login" `AuthButton`
 * and flips its own local `member` state in `onSuccess`.
 */
export default function LoginModal({ open, onClose, onSuccess }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  const submit = () => {
    if (tryLogin(password)) {
      setPassword("");
      setError(false);
      onSuccess();
      onClose();
    } else {
      setError(true);
    }
  };

  const handleClose = () => {
    setPassword("");
    setError(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <Box sx={{ position: "relative", p: 4, textAlign: "center" }}>
        <IconButton
          onClick={handleClose}
          size="small"
          aria-label="Close"
          sx={{ position: "absolute", top: 8, right: 8, color: "text.secondary" }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>

        <Box
          component="img"
          src={`${import.meta.env.BASE_URL}favicon.png`}
          alt=""
          sx={{ height: 44, width: 44, display: "block", mx: "auto", mb: 1.5 }}
        />
        <Typography sx={{ fontWeight: 800, fontSize: "1.375rem", color: "primary.main", letterSpacing: "-0.01em", mb: 0.5 }}>
          GSC member login
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Enter the member password to unlock member-only content.
        </Typography>

        <TextField
          type="password"
          label="Password"
          fullWidth
          autoFocus
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          error={error}
          helperText={error ? "Incorrect password" : " "}
          sx={{ mb: 1 }}
        />
        <Button
          variant="contained"
          fullWidth
          onClick={submit}
          startIcon={<LockOutlinedIcon fontSize="small" />}
          sx={{ borderRadius: "22px", py: 1 }}
        >
          Log in
        </Button>
      </Box>
    </Dialog>
  );
}
