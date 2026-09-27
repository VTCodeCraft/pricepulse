import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { useId } from 'react';
import type { TrackedProduct } from '../../../types/product';

type StopTrackingDialogProps = {
  item: TrackedProduct | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (item: TrackedProduct) => void;
};

// `item` stays set while the dialog closes, so its text does not disappear during the exit transition.
export function StopTrackingDialog({ item, open, onClose, onConfirm }: StopTrackingDialogProps) {
  const titleId = useId();
  return (
    <Dialog open={open} onClose={onClose} aria-labelledby={titleId}>
      <DialogTitle id={titleId}>Stop tracking this option?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {item && `${item.productName} · ${item.optionLabel}`} will no longer be scraped. Its price history is kept, and
          tracking it again later continues it.
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          color="error"
          variant="contained"
          onClick={() => {
            if (item) onConfirm(item);
            onClose();
          }}
        >
          Stop tracking
        </Button>
      </DialogActions>
    </Dialog>
  );
}
