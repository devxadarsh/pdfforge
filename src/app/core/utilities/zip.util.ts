// Client-side ZIP archive builder
// Runs 100% locally in the browser with zero external dependencies.

export interface ZipEntry {
  readonly path: string;
  readonly data: Uint8Array;
}

export function crc32(buf: Uint8Array): number {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return ~crc >>> 0;
}

/**
 * Creates a valid standard ZIP archive Uint8Array from an array of file entries using STORE mode.
 */
export function createZip(entries: ZipEntry[]): Uint8Array {
  const textEncoder = new TextEncoder();
  const localHeaders: Uint8Array[] = [];
  const centralHeaders: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = textEncoder.encode(entry.path);
    const data = entry.data;
    const crc = crc32(data);
    const size = data.length;

    // Local Header (30 bytes + name length)
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // Signature
    lv.setUint16(4, 20, true); // Version needed
    lv.setUint16(6, 0, true); // General flags
    lv.setUint16(8, 0, true); // Compression: STORE (0)
    lv.setUint16(10, 0, true); // Mod time
    lv.setUint16(12, 0, true); // Mod date
    lv.setUint32(14, crc, true); // CRC32
    lv.setUint32(18, size, true); // Compressed size
    lv.setUint32(22, size, true); // Uncompressed size
    lv.setUint16(26, nameBytes.length, true); // Filename length
    lv.setUint16(28, 0, true); // Extra field length
    local.set(nameBytes, 30);

    localHeaders.push(local);
    localHeaders.push(data);

    // Central Directory Header (46 bytes + name length)
    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); // Signature
    cv.setUint16(4, 20, true); // Version made by
    cv.setUint16(6, 20, true); // Version needed
    cv.setUint16(8, 0, true); // General flags
    cv.setUint16(10, 0, true); // Compression: STORE (0)
    cv.setUint16(12, 0, true); // Mod time
    cv.setUint16(14, 0, true); // Mod date
    cv.setUint32(16, crc, true); // CRC32
    cv.setUint32(20, size, true); // Compressed size
    cv.setUint32(24, size, true); // Uncompressed size
    cv.setUint16(28, nameBytes.length, true); // Filename length
    cv.setUint16(30, 0, true); // Extra length
    cv.setUint16(32, 0, true); // Comment length
    cv.setUint16(34, 0, true); // Disk number
    cv.setUint16(36, 0, true); // Internal attributes
    cv.setUint32(38, 0, true); // External attributes
    cv.setUint32(42, offset, true); // Offset of local header
    central.set(nameBytes, 46);

    centralHeaders.push(central);
    offset += local.length + data.length;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const c of centralHeaders) {
    centralDirSize += c.length;
  }

  // End of Central Directory (22 bytes)
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); // Signature
  ev.setUint16(4, 0, true); // Disk number
  ev.setUint16(6, 0, true); // Start disk
  ev.setUint16(8, entries.length, true); // Records on this disk
  ev.setUint16(10, entries.length, true); // Total records
  ev.setUint32(12, centralDirSize, true); // Central dir size
  ev.setUint32(16, centralDirOffset, true); // Central dir offset
  ev.setUint16(20, 0, true); // Comment length

  const totalLength = centralDirOffset + centralDirSize + eocd.length;
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const part of [...localHeaders, ...centralHeaders, eocd]) {
    result.set(part, pos);
    pos += part.length;
  }
  return result;
}

/**
 * Creates a downloadable ZIP archive Blob from entries
 */
export function createZipBlob(entries: ZipEntry[]): Blob {
  const bytes = createZip(entries);
  return new Blob([bytes as BlobPart], { type: 'application/zip' });
}
