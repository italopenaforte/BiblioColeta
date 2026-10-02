import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const extension = join(root, 'extension');
const output = join(root, 'BiblioColeta-Chrome.zip');
const allowed = new Set(['.json', '.html', '.css', '.js', '.png', '.svg']);

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function listFiles(directory = extension, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await listFiles(join(directory, entry.name), name));
    else if (entry.isFile() && allowed.has(extname(entry.name))) files.push(name);
  }
  return files.sort();
}

function makeZip(files) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const { name, bytes } of files) {
    const path = Buffer.from(name, 'utf8');
    const size = bytes.length;
    if (size > 0xffffffff || offset > 0xffffffff) throw new Error('Arquivo grande demais para ZIP.');
    const checksum = crc32(bytes);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0800, 6);
    header.writeUInt16LE(0x0021, 12); // 1980-01-01; pacote reproduzível.
    header.writeUInt32LE(checksum, 14);
    header.writeUInt32LE(size, 18);
    header.writeUInt32LE(size, 22);
    header.writeUInt16LE(path.length, 26);
    local.push(header, path, bytes);

    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0x0800, 8);
    directory.writeUInt16LE(0x0021, 14);
    directory.writeUInt32LE(checksum, 16);
    directory.writeUInt32LE(size, 20);
    directory.writeUInt32LE(size, 24);
    directory.writeUInt16LE(path.length, 28);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, path);
    offset += header.length + path.length + size;
  }
  const centralSize = central.reduce((total, part) => total + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...central, end]);
}

if (!(await stat(join(extension, 'manifest.json')).catch(() => null))?.isFile()) {
  throw new Error('Manifesto da extensão ausente.');
}
const names = await listFiles();
if (names.length > 65535) throw new Error('Arquivos demais para ZIP.');
const files = await Promise.all(names.map(async (name) => ({ name, bytes: await readFile(join(extension, name)) })));
await writeFile(output, makeZip(files));
console.log(`Pacote pronto: ${output} (${files.length} arquivos)`);
