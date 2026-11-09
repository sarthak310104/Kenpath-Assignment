// The four time slots, in the order they happen during the day.
export const SLOTS = [
  { value: 'morning', label: 'Morning (fasting)' },
  { value: 'after_breakfast', label: 'After breakfast' },
  { value: 'after_lunch', label: 'After lunch' },
  { value: 'after_dinner', label: 'After dinner' },
];

export const SLOT_LABELS = Object.fromEntries(
  SLOTS.map((slot) => [slot.value, slot.label])
);