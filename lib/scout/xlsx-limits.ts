// Inspect ZIP metadata before the workbook library allocates decompressed XML.
// XLSX imports deliberately exclude ZIP64, encryption and multi-volume archives.
export function assertSmallWorkbook(bytes: ArrayBuffer) {
  const v = new DataView(bytes), size = bytes.byteLength;
  const fail = () => { throw Error('ملف Excel غير صالح أو يتجاوز حدود القراءة الآمنة'); };
  if (size < 22 || size > 1024 * 1024 || v.getUint32(0, true) !== 0x04034b50) fail();
  let end = -1;
  for (let i = size - 22; i >= Math.max(0, size - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50 && i + 22 + v.getUint16(i + 20, true) === size) { end = i; break; }
  }
  if (end < 0) fail();
  const count = v.getUint16(end + 10, true), start = v.getUint32(end + 16, true), length = v.getUint32(end + 12, true);
  if (v.getUint16(end + 4, true) || v.getUint16(end + 6, true) || count !== v.getUint16(end + 8, true) || !count || count > 300 || start + length !== end) fail();
  let cursor = start, total = 0;
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || v.getUint32(cursor, true) !== 0x02014b50) fail();
    const flags = v.getUint16(cursor + 8, true), method = v.getUint16(cursor + 10, true), unpacked = v.getUint32(cursor + 24, true), offset = v.getUint32(cursor + 42, true);
    if ((flags & 1) || ![0, 8].includes(method) || unpacked > 4 * 1024 * 1024 || offset + 30 > start || v.getUint32(offset, true) !== 0x04034b50) fail();
    total += unpacked;
    if (total > 8 * 1024 * 1024) fail();
    cursor += 46 + v.getUint16(cursor + 28, true) + v.getUint16(cursor + 30, true) + v.getUint16(cursor + 32, true);
  }
  if (cursor !== end) fail();
}
