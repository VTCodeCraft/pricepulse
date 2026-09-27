import SearchOutlined from '@mui/icons-material/SearchOutlined';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import { EmptyState } from '../../../components/common/EmptyState';

const STEPS = ['Find product', 'Choose option', 'Review'];

// Entry point only: catalogue search, option choice and the tracking request are added in F3.
export function TrackProductDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="track-product-title">
      <DialogTitle id="track-product-title">Track a product</DialogTitle>
      <DialogContent>
        <Stepper activeStep={0} alternativeLabel sx={{ mt: 1 }}>
          {STEPS.map(label => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        <EmptyState icon={SearchOutlined} title="Product search is not available yet" description="Searching the store catalogue and choosing an option are the next part of this build." />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
