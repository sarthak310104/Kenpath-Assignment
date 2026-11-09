import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ReadingForm from './ReadingForm';
import { readingsAPI } from '../api/readings';
import { getLocalDate } from '../utils/date';

// The real API is not called in these tests.
vi.mock('../api/readings', () => ({
  readingsAPI: { create: vi.fn() },
}));

function setup() {
  const onReadingAdded = vi.fn();
  const user = userEvent.setup();

  render(<ReadingForm onReadingAdded={onReadingAdded} />);

  return {
    user,
    onReadingAdded,
    dateInput: screen.getByLabelText('Date'),
    slotSelect: screen.getByLabelText('Time slot'),
    valueInput: screen.getByLabelText('Glucose value (mg/dl)'),
    submit: screen.getByRole('button', { name: 'Add reading' }),
  };
}

describe('ReadingForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('starts with today, the morning slot and an empty value', () => {
    const { dateInput, slotSelect, valueInput } = setup();

    expect(dateInput).toHaveValue(getLocalDate());
    expect(slotSelect).toHaveValue('morning');
    expect(valueInput).toHaveValue(null);
  });

  test('offers the four time slots', () => {
    setup();

    const labels = screen.getAllByRole('option').map((option) => option.textContent);

    expect(labels).toEqual([
      'Morning (fasting)',
      'After breakfast',
      'After lunch',
      'After dinner',
    ]);
  });

  test('sends an empty value as null so the server can ask for it', async () => {
    readingsAPI.create.mockRejectedValue(new Error('Please enter a glucose value.'));
    const { user, submit } = setup();

    await user.click(submit);

    expect(readingsAPI.create).toHaveBeenCalledWith({
      reading_date: getLocalDate(),
      slot: 'morning',
      value: null,
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Please enter a glucose value.');
  });

  test('sends the value as a number, even when it is out of range', async () => {
    readingsAPI.create.mockRejectedValue(
      new Error('Value must be between 40 and 600 mg/dl.')
    );
    const { user, valueInput, submit } = setup();

    await user.type(valueInput, '700');
    await user.click(submit);

    // the browser must not block this: the message comes from the server
    expect(readingsAPI.create).toHaveBeenCalledWith(
      expect.objectContaining({ value: 700 })
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Value must be between 40 and 600 mg/dl.'
    );
  });

  test.each([
    'Date cannot be in the future.',
    'You already have an After lunch reading for this date.',
    'You can add only 4 readings per day.',
  ])('shows the server message: %s', async (message) => {
    readingsAPI.create.mockRejectedValue(new Error(message));
    const { user, valueInput, submit } = setup();

    await user.type(valueInput, '110');
    await user.click(submit);

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });

  test('sends the date, slot and value that were chosen', async () => {
    readingsAPI.create.mockResolvedValue({});
    const { user, dateInput, slotSelect, valueInput, submit } = setup();

    fireEvent.change(dateInput, { target: { value: '2026-10-15' } });
    await user.selectOptions(slotSelect, 'after_lunch');
    await user.type(valueInput, '135');
    await user.click(submit);

    expect(readingsAPI.create).toHaveBeenCalledWith({
      reading_date: '2026-10-15',
      slot: 'after_lunch',
      value: 135,
    });
  });

  test('after saving: confirms, tells the page, keeps the date, moves to the next slot', async () => {
    readingsAPI.create.mockResolvedValue({});
    const { user, onReadingAdded, dateInput, slotSelect, valueInput, submit } = setup();

    fireEvent.change(dateInput, { target: { value: '2026-10-15' } });
    await user.type(valueInput, '110');
    await user.click(submit);

    expect(await screen.findByRole('status')).toHaveTextContent('Reading added.');
    expect(onReadingAdded).toHaveBeenCalledTimes(1);
    expect(dateInput).toHaveValue('2026-10-15');
    expect(slotSelect).toHaveValue('after_breakfast');
    expect(valueInput).toHaveValue(null);
  });

  test('wraps from the last slot back to the morning', async () => {
    readingsAPI.create.mockResolvedValue({});
    const { user, slotSelect, valueInput, submit } = setup();

    await user.selectOptions(slotSelect, 'after_dinner');
    await user.type(valueInput, '120');
    await user.click(submit);

    await screen.findByRole('status');
    expect(slotSelect).toHaveValue('morning');
  });

  test('does not call the page when saving fails', async () => {
    readingsAPI.create.mockRejectedValue(new Error('Something went wrong.'));
    const { user, onReadingAdded, valueInput, submit } = setup();

    await user.type(valueInput, '110');
    await user.click(submit);

    await screen.findByRole('alert');
    expect(onReadingAdded).not.toHaveBeenCalled();
    expect(valueInput).toHaveValue(110);
  });

  test('disables the button while saving', async () => {
    readingsAPI.create.mockReturnValue(new Promise(() => {})); // never finishes
    const { user, valueInput, submit } = setup();

    await user.type(valueInput, '110');
    await user.click(submit);

    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
  });
});