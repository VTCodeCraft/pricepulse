import { lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { NotFoundPage } from './NotFoundPage';

// Each page is its own chunk; AppLayout shows a skeleton while one loads.
const DashboardPage = lazy(() => import('../features/dashboard/pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const AllProductsPage = lazy(() => import('../features/products/pages/AllProductsPage').then(m => ({ default: m.AllProductsPage })));
const ProductsPage = lazy(() => import('../features/products/pages/ProductsPage').then(m => ({ default: m.ProductsPage })));
const ProductDetailsPage = lazy(() => import('../features/products/pages/ProductDetailsPage').then(m => ({ default: m.ProductDetailsPage })));
const AnalyticsPage = lazy(() => import('../features/analytics/pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const LogsPage = lazy(() => import('../features/scraping/pages/LogsPage').then(m => ({ default: m.LogsPage })));
const SettingsPage = lazy(() => import('../features/settings/pages/SettingsPage').then(m => ({ default: m.SettingsPage })));

// `handle.title` feeds the header's breadcrumb.
export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage />, handle: { title: 'Dashboard' } },
      {
        path: 'products',
        handle: { title: 'All Products' },
        children: [
          { index: true, element: <AllProductsPage /> },
          { path: ':id', element: <ProductDetailsPage />, handle: { title: 'Product details' } },
        ],
      },
      { path: 'tracked', element: <ProductsPage />, handle: { title: 'Tracked Products' } },
      { path: 'analytics', element: <AnalyticsPage />, handle: { title: 'Analytics' } },
      { path: 'logs', element: <LogsPage />, handle: { title: 'Scrape Logs' } },
      { path: 'settings', element: <SettingsPage />, handle: { title: 'Settings' } },
      { path: '*', element: <NotFoundPage />, handle: { title: 'Page not found' } },
    ],
  },
]);
