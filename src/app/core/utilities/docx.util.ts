// Client-side Microsoft Word (.docx) generator
// Operates 100% locally in the browser with zero server dependencies

function crc32(buf: Uint8Array): number {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return ~crc >>> 0;
}

interface ZipEntry {
  path: string;
  data: Uint8Array;
}

function createZip(entries: ZipEntry[]): Uint8Array {
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

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Creates a valid Microsoft Word (.docx) file Blob from text paragraphs
 */
export function createDocxBlob(text: string, title = 'Converted Document'): Blob {
  const encoder = new TextEncoder();

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  // Split text into paragraphs and wrap in OpenXML tags
  const paragraphs = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const paragraphsXml = paragraphs
    .map((p) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(p)}</w:t></w:r></w:p>`)
    .join('\n');

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="36"/>
          <w:color w:val="004AC6"/>
        </w:rPr>
        <w:t>${escapeXml(title)}</w:t>
      </w:r>
    </w:p>
    ${paragraphsXml}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const entries: ZipEntry[] = [
    { path: '[Content_Types].xml', data: encoder.encode(contentTypesXml) },
    { path: '_rels/.rels', data: encoder.encode(rootRelsXml) },
    { path: 'word/document.xml', data: encoder.encode(documentXml) },
  ];

  const zipBytes = createZip(entries);
  return new Blob([zipBytes as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}
