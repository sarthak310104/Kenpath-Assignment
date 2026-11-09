const crypto = require('crypto');

// Look-alikes are left out (no I, O, 0 or 1) because someone has to read the
// code out or type it in.
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';

function pick(from) {
  return from[crypto.randomInt(from.length)];
}

// 5 letters and 3 digits in a random order, e.g. K7QMA2XD
function makeDoctorCode() {
  const chars = [];

  for (let i = 0; i < 5; i++) chars.push(pick(LETTERS));
  for (let i = 0; i < 3; i++) chars.push(pick(DIGITS));

  // shuffle so the digits don't always sit at the end
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

module.exports = { makeDoctorCode };