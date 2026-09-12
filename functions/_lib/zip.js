const encoder = new TextEncoder();

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function updateCrc(crc, bytes) {
  let c = crc >>> 0;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return c >>> 0;
}

function finalCrc(crc) {
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(dateValue) {
  const date = dateValue ? new Date(dateValue) : new Date();
  const safe = Number.isNaN(date.getTime()) ? new Date() : date;
  const year = Math.max(1980, safe.getFullYear());
  const time = ((safe.getHours() & 0x1f) << 11) | ((safe.getMinutes() & 0x3f) << 5) | ((Math.floor(safe.getSeconds() / 2)) & 0x1f);
  const day = ((year - 1980) << 9) | (((safe.getMonth() + 1) & 0x0f) << 5) | (safe.getDate() & 0x1f);
  return { time, day };
}

function bytesWriter(length) {
  const bytes = new Uint8Array(length);
  const view = new DataView(bytes.buffer);
  return { bytes, view };
}

function localHeader(nameBytes, flags, time, day, crc = 0, size = 0) {
  const { bytes, view } = bytesWriter(30 + nameBytes.length);
  let o = 0;
  view.setUint32(o, 0x04034b50, true); o += 4;
  view.setUint16(o, 20, true); o += 2;
  view.setUint16(o, flags, true); o += 2;
  view.setUint16(o, 0, true); o += 2;
  view.setUint16(o, time, true); o += 2;
  view.setUint16(o, day, true); o += 2;
  view.setUint32(o, crc >>> 0, true); o += 4;
  view.setUint32(o, size >>> 0, true); o += 4;
  view.setUint32(o, size >>> 0, true); o += 4;
  view.setUint16(o, nameBytes.length, true); o += 2;
  view.setUint16(o, 0, true); o += 2;
  bytes.set(nameBytes, o);
  return bytes;
}

function dataDescriptor(crc, size) {
  const { bytes, view } = bytesWriter(16);
  view.setUint32(0, 0x08074b50, true);
  view.setUint32(4, crc >>> 0, true);
  view.setUint32(8, size >>> 0, true);
  view.setUint32(12, size >>> 0, true);
  return bytes;
}

function centralHeader({ nameBytes, flags, time, day, crc, size, offset, directory }) {
  const { bytes, view } = bytesWriter(46 + nameBytes.length);
  let o = 0;
  view.setUint32(o, 0x02014b50, true); o += 4;
  view.setUint16(o, 20, true); o += 2;
  view.setUint16(o, 20, true); o += 2;
  view.setUint16(o, flags, true); o += 2;
  view.setUint16(o, 0, true); o += 2;
  view.setUint16(o, time, true); o += 2;
  view.setUint16(o, day, true); o += 2;
  view.setUint32(o, crc >>> 0, true); o += 4;
  view.setUint32(o, size >>> 0, true); o += 4;
  view.setUint32(o, size >>> 0, true); o += 4;
  view.setUint16(o, nameBytes.length, true); o += 2;
  view.setUint16(o, 0, true); o += 2;
  view.setUint16(o, 0, true); o += 2;
  view.setUint16(o, 0, true); o += 2;
  view.setUint16(o, 0, true); o += 2;
  view.setUint32(o, directory ? 0x10 : 0, true); o += 4;
  view.setUint32(o, offset >>> 0, true); o += 4;
  bytes.set(nameBytes, o);
  return bytes;
}

function endRecord(entryCount, centralSize, centralOffset) {
  const { bytes, view } = bytesWriter(22);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, entryCount, true);
  view.setUint16(10, entryCount, true);
  view.setUint32(12, centralSize >>> 0, true);
  view.setUint32(16, centralOffset >>> 0, true);
  view.setUint16(20, 0, true);
  return bytes;
}

export function sanitizeZipSegment(value, fallback = 'khong-ten') {
  const cleaned = String(value || '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
    .replace(/[. ]+$/g, '')
    .trim();
  return cleaned || fallback;
}

export function createZipStream({ directories = [], files = [] }) {
  return new ReadableStream({
    start(controller) {
      (async () => {
        const central = [];
        let offset = 0;
        let entryCount = 0;
        const utf8Flag = 0x0800;
        const streamedFlag = 0x0008;

        const push = bytes => {
          controller.enqueue(bytes);
          offset += bytes.byteLength;
        };

        for (const dir of directories) {
          const name = dir.endsWith('/') ? dir : `${dir}/`;
          const nameBytes = encoder.encode(name);
          const { time, day } = dosDateTime();
          const startOffset = offset;
          const header = localHeader(nameBytes, utf8Flag, time, day, 0, 0);
          push(header);
          central.push(centralHeader({ nameBytes, flags: utf8Flag, time, day, crc: 0, size: 0, offset: startOffset, directory: true }));
          entryCount++;
        }

        for (const file of files) {
          const nameBytes = encoder.encode(file.path);
          const { time, day } = dosDateTime(file.date);
          const flags = utf8Flag | streamedFlag;
          const startOffset = offset;
          push(localHeader(nameBytes, flags, time, day, 0, 0));

          const object = await file.getObject();
          if (!object?.body) throw new Error(`Không đọc được file R2: ${file.path}`);

          const reader = object.body.getReader();
          let crc = 0xffffffff;
          let size = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
            crc = updateCrc(crc, chunk);
            size += chunk.byteLength;
            push(chunk);
          }

          crc = finalCrc(crc);
          push(dataDescriptor(crc, size));
          central.push(centralHeader({ nameBytes, flags, time, day, crc, size, offset: startOffset, directory: false }));
          entryCount++;
        }

        const centralOffset = offset;
        let centralSize = 0;
        for (const entry of central) {
          controller.enqueue(entry);
          offset += entry.byteLength;
          centralSize += entry.byteLength;
        }
        controller.enqueue(endRecord(entryCount, centralSize, centralOffset));
        controller.close();
      })().catch(error => controller.error(error));
    }
  });
}
