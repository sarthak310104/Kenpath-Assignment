import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// take rendered components off the page after every test
afterEach(() => {
  cleanup();
});