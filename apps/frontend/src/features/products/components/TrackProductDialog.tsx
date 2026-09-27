import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Skeleton from '@mui/material/Skeleton';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import type { Theme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useId, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ErrorState } from '../../../components/common/ErrorState';
import { ApiError } from '../../../lib/api/client';
import type { CatalogProduct, Product, TrackedProduct } from '../../../types/product';
import { useProduct } from '../hooks/useCatalog';
import { useTrackProduct, useTrackedProducts } from '../hooks/useTrackedProducts';
import { productPath, trackedOptionsOf } from '../productInfo';
import { firstScrapeNote, trackFormSchema, type TrackFormValues } from '../trackForm';
import { OptionSelector } from './OptionSelector';
import { ProductSearch } from './ProductSearch';

type Step = 0 | 1 | 2;
const STEPS = ['Find product', 'Choose option', 'Review'];

type TrackProductDialogProps = { open: boolean; onClose: () => void; product?: CatalogProduct };

// Without `product` the user searches first; with it (All Products) the dialog opens at that product's options.
export function TrackProductDialog({ open, onClose, product: chosen }: TrackProductDialogProps) {
  const [product, setProduct] = useState<CatalogProduct | null>(chosen ?? null);
  const [step, setStep] = useState<Step>(chosen ? 1 : 0);
  const fullScreen = useMediaQuery((theme: Theme) => theme.breakpoints.down('sm'));
  const titleId = useId();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      fullScreen={fullScreen}
      aria-labelledby={titleId}
      // Start over only once the dialog has finished closing, so its content does not jump while it fades out.
      slotProps={{ transition: { onExited: () => { setProduct(chosen ?? null); setStep(chosen ? 1 : 0); } } }}
    >
      <DialogTitle id={titleId}>Track a product</DialogTitle>
      {step === 0 || !product ? (
        <>
          <DialogContent>
            <Steps active={0} />
            <ProductSearch autoFocus onSelect={selected => { setProduct(selected); setStep(1); }} />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={onClose}>Cancel</Button>
          </DialogActions>
        </>
      ) : (
        <OptionSteps key={product.storeProductId} product={product} step={step} onStep={setStep} onDone={onClose} />
      )}
    </Dialog>
  );
}

function Steps({ active }: { active: Step }) {
  return (
    <Stepper activeStep={active} alternativeLabel sx={{ mb: 3 }}>
      {STEPS.map(label => (
        <Step key={label}>
          <StepLabel>{label}</StepLabel>
        </Step>
      ))}
    </Stepper>
  );
}

type OptionStepsProps = { product: CatalogProduct; step: Step; onStep: (step: Step) => void; onDone: () => void };

// Loads the product live from the store (its options must be current), then shows the option and review steps.
function OptionSteps({ product, step, onStep, onDone }: OptionStepsProps) {
  const details = useProduct(product.storeProductId);
  const tracked = useTrackedProducts();

  if (details.data && tracked.data) {
    return (
      <TrackForm
        product={details.data}
        tracked={trackedOptionsOf(tracked.data, product.storeProductId)}
        step={step}
        onStep={onStep}
        onDone={onDone}
      />
    );
  }

  const failed = details.isError || tracked.isError;
  const notFound = details.error instanceof ApiError && details.error.code === 'product_not_found';
  return (
    <>
      <DialogContent>
        <Steps active={1} />
        {failed ? (
          <ErrorState
            title={notFound ? 'This product is no longer in the store' : 'Unable to load the product’s options'}
            message={notFound ? undefined : (details.error ?? tracked.error)?.message}
            onRetry={notFound ? undefined : () => (details.isError ? details.refetch() : tracked.refetch())}
          />
        ) : (
          <Box role="status" aria-busy="true" aria-label="Loading options" sx={{ display: 'grid', gap: 1 }}>
            <Skeleton width="40%" />
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} variant="rounded" height={44} />
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={() => onStep(0)}>Back</Button>
      </DialogActions>
    </>
  );
}

type TrackFormProps = {
  product: Product;
  tracked: Map<string, TrackedProduct>;
  step: Step;
  onStep: (step: Step) => void;
  onDone: () => void;
};

function TrackForm({ product, tracked, step, onStep, onDone }: TrackFormProps) {
  const navigate = useNavigate();
  const trackProduct = useTrackProduct();
  const form = useForm<TrackFormValues>({
    resolver: zodResolver(trackFormSchema(product.options, new Set(tracked.keys()))),
    defaultValues: { storeProductId: product.storeProductId, optionId: '' },
  });
  const optionId = useWatch({ control: form.control, name: 'optionId' });
  const option = product.options.find(o => o.id === optionId);
  const allTracked = product.options.every(o => tracked.has(o.id));

  const submit = form.handleSubmit(values =>
    trackProduct.mutate(values, {
      onSuccess: response => {
        toast.success(`Tracking ${product.name} · ${option?.label}`, {
          description: firstScrapeNote(response),
          action: { label: 'View', onClick: () => navigate(productPath(product.storeProductId, values.optionId)) },
        });
        onDone();
      },
    }),
  );

  return (
    <Box component="form" onSubmit={submit} noValidate sx={{ display: 'contents' }}>
      <DialogContent>
        <Steps active={step} />
        <Typography variant="h3" component="p">
          {product.name}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
          {[product.brand, product.category, product.sku].filter(Boolean).join(' · ')}
        </Typography>

        {step === 1 && (
          <>
            {allTracked && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Every option of this product is already tracked.
              </Alert>
            )}
            <Controller
              name="optionId"
              control={form.control}
              render={({ field, fieldState }) => (
                <OptionSelector
                  label={`Choose one ${product.optionAxis.toLowerCase()} to track`}
                  options={product.options}
                  value={field.value}
                  onChange={field.onChange}
                  tracked={tracked}
                  disableTracked
                  error={fieldState.error?.message}
                />
              )}
            />
          </>
        )}

        {step === 2 && option && (
          <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 3, rowGap: 1.25, m: 0 }}>
            <Typography component="dt" variant="body2" sx={{ color: 'text.secondary' }}>
              {product.optionAxis}
            </Typography>
            <Typography component="dd" variant="body2" sx={{ m: 0, fontWeight: 600 }}>
              {option.label}
            </Typography>
            <Typography component="dt" variant="body2" sx={{ color: 'text.secondary' }}>
              Store product
            </Typography>
            <Typography component="dd" variant="body2" sx={{ m: 0 }}>
              #{product.storeProductId}
            </Typography>
            <Typography component="dt" variant="body2" sx={{ color: 'text.secondary' }}>
              Schedule
            </Typography>
            <Typography component="dd" variant="body2" sx={{ m: 0 }}>
              Checked every 2 hours. The first price is fetched right after you start tracking.
            </Typography>
          </Box>
        )}

        {trackProduct.isError && (
          <Alert severity="error" sx={{ mt: 2.5 }}>
            {trackProduct.error.message}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={() => onStep((step - 1) as Step)} disabled={trackProduct.isPending}>
          Back
        </Button>
        {step === 1 ? (
          <Button
            variant="contained"
            onClick={async () => {
              if (await form.trigger('optionId')) onStep(2);
            }}
          >
            Continue
          </Button>
        ) : (
          <Button type="submit" variant="contained" loading={trackProduct.isPending}>
            Start tracking
          </Button>
        )}
      </DialogActions>
    </Box>
  );
}
