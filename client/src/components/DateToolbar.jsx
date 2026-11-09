import { getLocalDate } from '../utils/date';

// The "pick a date" row at the top of the reports pages.
function DateToolbar({ value, onChange }) {
  return (
    <div className="toolbar">
      <label htmlFor="report-date">Date</label>
      <input
        id="report-date"
        type="date"
        value={value}
        max={getLocalDate()}
        onChange={(event) => {
          // ignore the box being cleared, there is no report for "no date"
          if (event.target.value) onChange(event.target.value);
        }}
      />
    </div>
  );
}

export default DateToolbar;