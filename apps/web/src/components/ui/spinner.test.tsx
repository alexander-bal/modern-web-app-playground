import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Spinner } from './spinner';

describe('Spinner', () => {
  it('exposes itself as a named progressbar so loading states are locatable', () => {
    render(<Spinner />);

    expect(screen.getByRole('progressbar')).toHaveAccessibleName('Loading');
  });
});
