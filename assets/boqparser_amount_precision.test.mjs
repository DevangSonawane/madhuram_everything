import assert from 'node:assert/strict';
import { parseBoq } from './boqparser.js';

// Lodha-style row: ensure trailing zeros are preserved in *_text fields
{
  const raw = [
    '1.01 PLUMBING WORK',
    '1.01.1 Test item description 998322 NOS 10 5 50.00',
  ].join('\n');

  const out = parseBoq(raw);
  assert.equal(out.name, 'Lodha');
  assert.equal(out.items.length, 1);
  assert.equal(out.items[0].amount, 50);
  assert.equal(out.items[0].amount_text, '50.00');
  assert.equal(out.items[0].rate_text, '5.00');
}

// Hiranandani-style row: ensure trailing zeros are preserved in *_text fields
{
  const raw = [
    '1 Plumbing',
    '(1) Sac: 995462 - Test service 2 M 213.75 10,687.50',
  ].join('\n');

  const out = parseBoq(raw);
  assert.equal(out.name, 'Hiranandani');
  assert.equal(out.items.length, 1);
  assert.equal(out.items[0].amount, 10687.5);
  assert.equal(out.items[0].amount_text, '10687.50');
  assert.equal(out.items[0].rate_text, '213.75');
}

// Hiranandani variant label: "SAC Code :"
{
  const raw = [
    '1 Plumbing',
    '(1) SAC Code : 995462 - Test service 2 M 213.75 10,687.50',
  ].join('\n');

  const out = parseBoq(raw);
  assert.equal(out.name, 'Hiranandani');
  assert.equal(out.items.length, 1);
  assert.equal(out.items[0].sac_code, '995462');
}

// Hiranandani variant label: "SAC Code" without delimiter
{
  const raw = [
    '1 Plumbing',
    '(1) SAC Code 995462 - Test service 2 M 213.75 10,687.50',
  ].join('\n');

  const out = parseBoq(raw);
  assert.equal(out.name, 'Hiranandani');
  assert.equal(out.items.length, 1);
  assert.equal(out.items[0].sac_code, '995462');
}

console.log('ok');
