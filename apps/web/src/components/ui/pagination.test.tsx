import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from './pagination';

describe('Pagination', () => {
  it('renders nothing when there is only one page', () => {
    const { container } = render(<Pagination page={1} count={1} onChange={() => {}} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('offers first, previous, next and last navigation alongside page numbers', () => {
    render(<Pagination page={2} count={3} onChange={() => {}} />);

    for (const name of [
      'Go to first page',
      'Go to previous page',
      'Go to next page',
      'Go to last page',
      'Go to page 1',
      'Go to page 2',
      'Go to page 3',
    ]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('marks only the active page as current', () => {
    render(<Pagination page={2} count={3} onChange={() => {}} />);

    expect(screen.getByRole('button', { name: 'Go to page 2' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('button', { name: 'Go to page 1' })).not.toHaveAttribute(
      'aria-current'
    );
  });

  it('disables backward navigation on the first page', () => {
    render(<Pagination page={1} count={3} onChange={() => {}} />);

    expect(screen.getByRole('button', { name: 'Go to first page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Go to previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Go to next page' })).toBeEnabled();
  });

  it('disables forward navigation on the last page', () => {
    render(<Pagination page={3} count={3} onChange={() => {}} />);

    expect(screen.getByRole('button', { name: 'Go to next page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Go to last page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Go to previous page' })).toBeEnabled();
  });

  it('reports the page the user picked', async () => {
    const onChange = vi.fn();
    render(<Pagination page={2} count={5} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Go to page 3' }));
    await userEvent.click(screen.getByRole('button', { name: 'Go to last page' }));

    expect(onChange.mock.calls).toEqual([[3], [5]]);
  });

  it('lists every page without an ellipsis when there are only two', () => {
    render(<Pagination page={1} count={2} onChange={() => {}} />);

    expect(screen.getByRole('button', { name: 'Go to page 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to page 2' })).toBeInTheDocument();
    expect(screen.queryByText('…')).not.toBeInTheDocument();
  });

  it('elides the run of pages between distant page numbers', () => {
    render(<Pagination page={5} count={10} onChange={() => {}} />);

    expect(screen.queryByRole('button', { name: 'Go to page 3' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to page 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to page 10' })).toBeInTheDocument();
  });
});
