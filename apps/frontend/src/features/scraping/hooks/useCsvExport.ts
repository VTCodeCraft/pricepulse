import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { downloadExport, type CsvExport } from '../../../lib/api/export';

// The server builds the CSV; the browser saves the file it returns.
export function useCsvExport() {
  return useMutation({
    mutationFn: downloadExport,
    onSuccess: file => {
      saveFile(file);
      toast.success('Scrape history exported', { description: file.filename });
    },
    onError: error => toast.error(`The export failed: ${error.message}`),
  });
}

function saveFile({ blob, filename }: CsvExport) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000); // after the browser has taken the file
}
