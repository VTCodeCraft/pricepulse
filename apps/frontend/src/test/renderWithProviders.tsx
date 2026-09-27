import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { theme } from '../theme/theme';

// jsdom lacks these browser APIs; MUI's media queries and the pagination's scroll-to-top call them.
window.matchMedia ??= (query: string) =>
  ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }) as MediaQueryList;
window.scrollTo = () => {};

type Options = { route?: string; path?: string; otherRoutes?: ReactNode };

// The app's providers around one element, rendered at `route`. Queries never retry, so failures show at once.
export function renderWithProviders(ui: ReactElement, { route = '/', path = '*', otherRoutes }: Options = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path={path} element={ui} />
            {otherRoutes}
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}
