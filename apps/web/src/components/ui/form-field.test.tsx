import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { FormField } from './form-field';

function ControlledField({ error }: { error?: string }) {
  const [value, setValue] = useState('');
  return (
    <FormField
      id="city"
      label="City"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      error={error}
    />
  );
}

describe('FormField', () => {
  it('associates the label with the input so it is reachable by its label text', async () => {
    render(<FormField id="city" label="City" value="" onChange={() => {}} />);

    const input = screen.getByLabelText('City');
    expect(input).toBe(screen.getByRole('textbox'));
    expect(input).toHaveAttribute('id', 'city');
  });

  it('round-trips typed text through the caller-owned value', async () => {
    render(<ControlledField />);

    await userEvent.type(screen.getByLabelText('City'), 'Berlin');

    expect(screen.getByLabelText('City')).toHaveValue('Berlin');
  });

  it('keeps the required marker out of the accessible name', () => {
    render(<FormField id="city" label="City" value="" onChange={() => {}} required />);

    // The marker sits outside <label> so the label's text content stays exactly
    // 'City'; the Playwright suites query these fields by exact label text.
    expect(screen.getByLabelText('City')).toBeRequired();
    expect(screen.getByText('*')).toHaveAttribute('aria-hidden');
  });

  it('omits the required marker on a disabled field, which the user cannot fill', () => {
    render(<FormField id="city" label="City" value="" onChange={() => {}} required disabled />);

    expect(screen.queryByText('*')).not.toBeInTheDocument();
  });

  it('marks the input invalid and points it at the message when an error is given', () => {
    render(
      <FormField id="city" label="City" value="" onChange={() => {}} error="City is required" />
    );

    const input = screen.getByLabelText('City');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('City is required');
  });

  it('leaves the input valid with no description when there is no error', () => {
    render(<FormField id="city" label="City" value="" onChange={() => {}} />);

    const input = screen.getByLabelText('City');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAccessibleDescription();
  });
});
