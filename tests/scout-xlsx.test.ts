import test from 'node:test';
import assert from 'node:assert/strict';
import {assertSmallWorkbook} from '../lib/scout/xlsx-limits.ts';
function zip(unpacked = 100) {
  const bytes = new ArrayBuffer(98), v = new DataView(bytes);
  v.setUint32(0, 0x04034b50, true);
  v.setUint32(30, 0x02014b50, true); v.setUint16(40, 8, true); v.setUint32(54, unpacked, true);
  v.setUint32(76, 0x06054b50, true); v.setUint16(84, 1, true); v.setUint16(86, 1, true); v.setUint32(88, 46, true); v.setUint32(92, 30, true);
  return bytes;
}
test('workbook ZIP metadata bounds decompression and rejects malformed or encrypted files', () => {
  assert.doesNotThrow(() => assertSmallWorkbook(zip()));
  assert.throws(() => assertSmallWorkbook(zip(9 * 1024 * 1024)));
  assert.throws(() => assertSmallWorkbook(new ArrayBuffer(5)));
  const encrypted = zip(); new DataView(encrypted).setUint16(38, 1, true);
  assert.throws(() => assertSmallWorkbook(encrypted));
  const truncated = zip().slice(0, 97); assert.throws(() => assertSmallWorkbook(truncated));
});
