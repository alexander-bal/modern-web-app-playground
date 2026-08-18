import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CountBadge } from './count-badge';

describe('CountBadge', () => {
  it('renders the count alongside its child', () => {
    render(
      <CountBadge count={3}>
        <span>Cart</span>
      </CountBadge>
    );

    expect(screen.getByText('Cart')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('hides the bubble at zero so an empty cart shows no count', () => {
    render(
      <CountBadge count={0}>
        <span>Cart</span>
      </CountBadge>
    );

    expect(screen.getByText('Cart')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});
