// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Route } from 'react-router-dom';
import { renderWithProviders } from '../../test/renderWithProviders';
import { CommandPalette } from './CommandPalette';

afterEach(cleanup);

describe('CommandPalette', () => {
  it('offers All Products next to Tracked Products and opens it', async () => {
    const onOpenChange = vi.fn();
    renderWithProviders(<CommandPalette open onOpenChange={onOpenChange} />, {
      path: '/',
      otherRoutes: <Route path="/products" element={<p>All products page</p>} />,
    });
    const options = screen.getAllByRole('option').map(option => option.textContent);
    expect(options.some(text => text?.startsWith('All Products'))).toBe(true);
    expect(options.some(text => text?.startsWith('Tracked Products'))).toBe(true);

    fireEvent.change(screen.getByRole('combobox', { name: 'Command' }), { target: { value: 'all products' } });
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Command' }), { key: 'Enter' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(await screen.findByText('All products page')).toBeTruthy();
  });
});
