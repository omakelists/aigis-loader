import { DataViewReader, Origin } from './DataViewReader';
import { gunzipSync } from 'fflate';
import type { Lz4 } from 'lz4-asm';

const decoder = new TextDecoder();

export type ALContext = {
  lz4: Lz4
};

export class AL {
  Head: string;
  constructor(head: string) {
    this.Head = head;
  }
}

export class DefaultAL extends AL {
  constructor() {
    super('DefaultAL');
  }
  static parse(context: ALContext, buffer: Uint8Array, level: number): DefaultAL {
    const head = decoder.decode(buffer.slice(0, 4));
    console.log(`${"  ".repeat(level)}- ${head}`);
    return new DefaultAL();
  }
}
export class ALText extends AL {
  Text = '';
  constructor(text: string) {
    super("ALText");
    this.Text = text;
  }
  static parse(context: ALContext, buffer: Uint8Array, _level: number): ALText {
    const text = decoder.decode(buffer);
    return new ALText(text);
  }
}

export class ALL4 extends AL {
  Dst: Uint8Array;
  constructor(dst: Uint8Array) {
    super('ALL4');
    this.Dst = dst;
  }
  static parse(context: ALContext, buffer: Uint8Array, level: number): ALL4 {
    console.log(`${"  ".repeat(level)}- ALL4 (AL Compress)`);
    const head = decoder.decode(buffer.slice(0, 4));
    if (head !== 'ALL4') {
      throw new Error(`Block signature is not as expected: ${head} != ALL4`);
    }
    const jump = buffer.slice(12);
    const uncompress = context.lz4.decompress(jump);
    return new ALL4(uncompress);
  }
}

export class ALLZ extends AL {
  Dst: Uint8Array;
  constructor(dst: Uint8Array) {
    super('ALLZ');
    this.Dst = dst;
  }

  static parse(context: ALContext, buffer: Uint8Array, level: number): ALLZ {
    console.log(`${"  ".repeat(level)}- ALLZ (AL Compress)`);
    const br = new DataViewReader(buffer);

    const head = br.ReadString(4);
    if (head !== 'ALLZ') {
      throw new Error(`Block signature is not as expected: ${head} != ALLZ`);
    }

    const _vers = br.ReadByte();
    const minBitsLength = br.ReadByte();
    const minBitsOffset = br.ReadByte();
    const minBitsLiteral = br.ReadByte();
    const dstSize = br.ReadDword();
    const dst = new Uint8Array(dstSize);
    const _size = 0;
    let dstOffset = 0;

    const readControl = (minBits: number) => {
      const u = br.ReadUnary();
      const n = br.ReadBits(u + minBits);
      if (u > 0) {
        return n + (((1 << u) - 1) << minBits);
      } else {
        return n;
      }
    };

    const readControlLength = () => 3 + readControl(minBitsLength);

    const readControlOffset = () => -1 - readControl(minBitsOffset);

    const readControlLiteral = () => 1 + readControl(minBitsLiteral);

    const copyWord = (offset: number, length: number) => {
      let trueOffset = offset;
      for (let i = 0; i < length; i++) {
        if (offset < 0) trueOffset = dstOffset + offset;
        dst[dstOffset] = dst[trueOffset];
        dstOffset++;
      }
    };

    const copyLiteral = (control: number) => {
      br.Copy(new Uint8Array(dst.buffer), dstOffset, control);
      dstOffset += control;
    };

    copyLiteral(readControlLiteral());
    let wordOffset = readControlOffset();
    let wordLength = readControlLength();
    let literalLength = 0;

    let finishFlag = 'overflow';

    while (!br.Overflow) {
      if (dstOffset + wordLength >= dstSize) {
        finishFlag = 'word';
        break;
      }
      if (br.ReadBit() === 0) {
        literalLength = readControlLiteral();
        if (dstOffset + wordLength + literalLength >= dstSize) {
          finishFlag = 'literal';
          break;
        }
        copyWord(wordOffset, wordLength);
        copyLiteral(literalLength);
        wordOffset = readControlOffset();
        wordLength = readControlLength();
      } else {
        copyWord(wordOffset, wordLength);
        wordOffset = readControlOffset();
        wordLength = readControlLength();
      }
    }
    switch (finishFlag) {
      case 'word':
        copyWord(wordOffset, wordLength);
        break;
      case 'literal':
        copyWord(wordOffset, wordLength);
        copyLiteral(literalLength);
        break;
      case 'overflow':
        throw Error('Overflow in ALLZ');
    }

    return new ALLZ(dst);
  }
}

export class ALRD extends AL {
  Headers: Array<AlrdHeader>;
  constructor(headers: Array<AlrdHeader>) {
    super('ALRD');
    this.Headers = headers;
  }
  static parse(context: ALContext, buffer: Uint8Array, level: number): ALRD {
    console.log(`${"  ".repeat(level)}- ALRD (AL Record Prop)`);
    const br = new DataViewReader(buffer);
    const head = br.ReadString(4);
    if (head !== 'ALRD') {
      throw new Error(`Block signature is not as expected: ${head} != ALRD`);
    }
    const _vers = br.ReadWord();
    const count = br.ReadWord();
    const _size = br.ReadWord();
    const headers = new Array<AlrdHeader>();
    for (let i = 0; i < count; i++) {
      const header = {} as AlrdHeader;
      header.offset = br.ReadWord();
      header.type = br.ReadByte();
      const emptyLength = br.ReadByte();
      const _lengthEN = br.ReadByte();
      const _lengthJP = br.ReadByte();
      header.nameEN = br.ReadString();
      header.nameJP = br.ReadString();
      br.Align(4);
      br.Seek(emptyLength, Origin.Current);
      br.Align(4);
      headers.push(header);
    }
    return new ALRD(headers);
  }
}
export type AlrdHeader = {
  offset: number;
  type: number;
  nameEN: string;
  nameJP: string;
};

export class ALTB extends AL {
  Label: string | undefined;
  Name: string | undefined;
  Headers: Array<AlrdHeader>;
  Contents: Array<{ [k: string]: number | string }>;
  constructor(label: string | undefined, name: string | undefined, headers: Array<AlrdHeader>, contents: Array<{ [k: string]: number | string }>) {
    super('ALTB');
    this.Label = label;
    this.Name = name;
    this.Headers = headers;
    this.Contents = contents;
  }
  static parse(context: ALContext, buffer: Uint8Array, level: number): ALTB {
    console.log(`${"  ".repeat(level)}- ALTB (AL Table)`);
    const br = new DataViewReader(buffer);
    const head = br.ReadString(4);
    if (head !== 'ALTB') {
      throw new Error(`Block signature is not as expected: ${head} != ALTB`);
    }

    const _vers = br.ReadByte();
    const form = br.ReadByte();
    const count = br.ReadWord();
    const _unknown1 = br.ReadWord();
    const tableEntry = br.ReadWord();
    const size = br.ReadDword();

    let name: string | undefined;
    const stringField: {[key: number]: string} = {};
    const stringOffsetList: number[] = [];
    let _nameStartAddressOffset: number | undefined;
    let nameStartAddress: number | undefined;
    let label: string | undefined;
    const contents: { [k: string]: number | string }[] = new Array<{ [k: string]: number | string }>();
    if (form === 0x14 || form === 0x1e || form === 0x04) {
      const _stringFieldSizePosition = br.Position;
      const stringFieldSize = br.ReadDword();
      const stringFieldEntry = br.ReadDword();

      const nowPosition = br.Position;
      br.Seek(stringFieldEntry, Origin.Begin);
      while (br.Position < stringFieldEntry + stringFieldSize) {
        const offset = br.Position - stringFieldEntry;
        const s = br.ReadString();
        stringField[offset] = s;
        stringOffsetList.push(offset);
      }
      br.Seek(nowPosition, Origin.Begin);
    }
    if (form === 0x1e) {
      _nameStartAddressOffset = br.Position;
      nameStartAddress = br.ReadDword();
    }
    if (form !== 0x04) {
      label = br.ReadString(4);
    }
    const alrdBuffer = br.ReadBytes(tableEntry - br.Position);
    br.Seek(tableEntry, Origin.Begin);
    const alrd = ALRD.parse(context, alrdBuffer, level + 1);
    for (let i = 0; i < count; i++) {
      br.Seek(tableEntry + size * i, Origin.Begin);
      const row: { [k: string]: number | string } = {};
      for (let j = 0; j < alrd.Headers.length; j++) {
        const header = alrd.Headers[j];
        const offset = br.Position;
        const dv = new DataView(buffer.buffer);
        switch (header.type) {
          case 1:
            row[header.nameEN] = dv.getInt32(offset + header.offset, true);
            break;
          case 4:
            row[header.nameEN] = dv.getFloat32(offset + header.offset, true);
            break;
          case 5:
            row[header.nameEN] = dv.getUint8(offset + header.offset);
            break;
          case 0x20:
          {
            const stringOffset = dv.getUint32(offset + header.offset, true);
            row[header.nameEN] = stringField[stringOffset];
          }
            break;
        }
      }
      contents.push(row);
    }
    if (nameStartAddress !== undefined) {
      br.Seek(nameStartAddress, Origin.Begin);
      const _unknownNames = br.ReadDword();
      const nameLength = br.ReadByte();
      name = br.ReadString(nameLength);
    }
    return new ALTB(label, name, alrd.Headers, contents);
  }
}

export class ALAR extends AL {
  Files: AlarEntry[];
  static *parseFiles(context: ALContext, buffer: Uint8Array, level: number, vers: number, count: number, reader: DataViewReader) {
    // FIXME ファイルのオフセットでアクセスしたい
    // for (const offset of this.TocOffsetList) {
    //   const b = new DataViewReader(this.Buffer.slice(offset));
    //   const entry = this.parseTocEntry(b);
    for (let i = 0; i < count; i++) {
      const entry = this.parseTocEntry(vers, reader, level);
      console.log(`${"  ".repeat(level)}  Entry name: ${entry.name}`);
      const ext = entry.name.split('.').pop() ?? '';
      if (ext[0] === 'a') {
        try {
          entry.content = parseObject(context,
            buffer.slice(entry.address, entry.address + entry.size),
            level + 1
          );
        } catch (e) {
          console.error(e);
          entry.content = DefaultAL.parse(
            context,
            buffer.slice(entry.address, entry.address + entry.size),
            level + 1
          );
        }
      } else if (ext === 'txt') {
        entry.content = ALText.parse(
          context,
          buffer.slice(entry.address, entry.address + entry.size),
          level + 1
        );
      } else {
        console.warn(`Unknown Entry ${entry.name}`);
        entry.content = DefaultAL.parse(
          context,
          buffer.slice(entry.address, entry.address + entry.size),
          level + 1
        );
      }
      yield entry;
    }
  }
  constructor(files: AlarEntry[]) {
    super('ALAR');
    this.Files = files;
  }
  static parse(context: ALContext, buffer: Uint8Array, level: number): ALAR {
    console.log(`${"  ".repeat(level)}- ALAR (AL Archive)`);
    const br = new DataViewReader(buffer);
    const head = br.ReadString(4);
    if (head !== 'ALAR') {
      throw new Error(`Block signature is not as expected: ${head} != ALAR`);
    }

    const _files = [];
    const tocOffsetList = [];
    const vers = br.ReadByte();
    const _unknown = br.ReadByte();
    let count: number;

    switch (vers) {
      case 2: {
        count = br.ReadWord();
        const _unknownBytes = br.ReadBytes(8);
        break;
      }
      case 3: {
        count = br.ReadWord();
        const _unknown1 = br.ReadWord();
        const _unknown2 = br.ReadWord();
        const _unknownBytes = br.ReadBytes(4);
        const _dataOffset = br.ReadWord();
        for (let i = 0; i < count; i++) {
          tocOffsetList.push(br.ReadWord());
        }
        break;
      }
      default:
        throw Error('ALAR VERSION ERROR');
    }
    //
    br.Align(4);
    const PayloadDataViewReader = new DataViewReader(buffer.slice(br.Position));
    return new ALAR([...this.parseFiles(context, buffer, level, vers, count, PayloadDataViewReader)]);
  }

  private static parseTocEntry(vers: number, br: DataViewReader, _level: number) {
    const entry = {} as AlarEntry;
    switch (vers) {
      case 2:
        {
          entry.index = br.ReadWord();
          entry.unknown1 = br.ReadWord();
          entry.address = br.ReadDword();
          entry.size = br.ReadDword();
          entry.unknown2 = br.ReadBytes(4);
          const p = br.Position;
          br.Seek(entry.address - 0x22, Origin.Begin);
          entry.name = br.ReadString();
          br.Seek(entry.address - 0x02, Origin.Begin);
          entry.unknown3 = br.ReadWord();
          br.Seek(p, Origin.Begin);
        }
        break;
      case 3:
      default:
        entry.index = br.ReadWord();
        entry.unknown1 = br.ReadWord();
        entry.address = br.ReadDword();
        entry.size = br.ReadDword();
        entry.unknown2 = br.ReadBytes(6);
        entry.name = br.ReadString();
        br.Align(4);
        break;
    }
    return entry;
  }
}

export type AlarEntry = {
  index: number;
  unknown1: number;
  address: number;
  offset: number;
  size: number;
  unknown2: Uint8Array;
  name: string;
  unknown3: number;
  content: AL;
  parsedContent: object;
};

export type AltxFrame = {
  X: number;
  Y: number;
  Width: number;
  Height: number;
  OriginX: number;
  OriginY: number;
};

export type AltxFrameTable = Array<AltxFrame> & {
  name?: string;
};

export class ALTX extends AL {
  Width: number;
  Height: number;
  Sprites: { [key: string]: AltxFrameTable };
  Image: Uint8Array;
  FakeImage?: string;
  constructor(width: number, height: number, sprites: { [p: number]: AltxFrameTable }, image: Uint8Array, fakeImage: string | undefined) {
    super('ALTX');
    this.Width = width;
    this.Height = height;
    this.Sprites = sprites;
    this.Image = image;
    this.FakeImage = fakeImage;
  }
  static parse(context: ALContext, buffer: Uint8Array, level: number): ALTX {
    console.log(`${"  ".repeat(level)}- ALTX (AL Texture)`);
    const br = new DataViewReader(buffer);
    const startOffset = br.Position;
    const head = br.ReadString(4);
    if (head !== 'ALTX') {
      throw new Error(`Block signature is not as expected: ${head} != ALTX`);
    }

    const _vers = br.ReadByte();
    const form = br.ReadByte();
    const count = br.ReadWord();
    const aligOffset = startOffset + br.ReadDword();
    const sprites: { [key: number]: AltxFrameTable } = {};
    let image = new Uint8Array(0);
    let fakeImage: string | undefined;
    let width = 0;
    let height = 0;
    if (form === 0) {
      const blockStart = [];
      for (let i = 0; i < count; ++i) {
        blockStart.push(startOffset + br.ReadWord());
      }
      br.Align(4);
      for (let i = 0; i < count; ++i) {
        let frameName = '';
        if (
            br.Position === blockStart[i] - 0x20 ||
            (i > 0 && br.Position === blockStart[0] - 0x20 + blockStart[i])
        ) {
          frameName = br.ReadString(0x20);
        }
        const index = br.ReadWord();
        const _unknown1 = br.ReadWord();
        const frames = br.ReadWord();
        const _unknown2 = br.ReadWord();
        const frameTable: AltxFrameTable = [];
        frameTable.name = frameName;
        for (let j = 0; j < frames; ++j) {
          const frame: AltxFrame = {
            X: br.ReadShort(),
            Y: br.ReadShort(),
            Width: br.ReadShort(),
            Height: br.ReadShort(),
            OriginX: 0,
            OriginY: 0,
          };
          frameTable.push(frame);
        }
        for (let j = 0; j < frames; ++j) {
          frameTable[j].OriginX = br.ReadShort();
          frameTable[j].OriginY = br.ReadShort();
        }
        sprites[index] = frameTable;
      }
    }
    br.Seek(aligOffset, Origin.Begin);
    if (form === 0) {
      const aligBuffer = br.ReadBytes(br.Length - br.Position);
      const alig = ALIG.parse(context, aligBuffer, level + 1);
      image = alig.Image;
      width = alig.Width;
      height = alig.Height;
    } else if (form === 0x0e) {
      width = br.ReadWord();
      height = br.ReadWord();
      fakeImage = br.ReadString(0x100);
    }
    return new ALTX(width, height, sprites, image, fakeImage);
  }
}

export class ChannelExtractor {
  private pix: number;
  constructor(pix: number) {
    this.pix = pix;
  }
  extract(length: number) {
    const channel = this.pix % length;
    this.pix = (this.pix - channel) / length;
    return channel;
  }
}

export class ALIG extends AL {
  Width: number;
  Height: number;
  Image: Uint8Array;
  constructor(width: number, height: number, image: Uint8Array) {
    super('ALIG');
    this.Width = width;
    this.Height = height;
    this.Image = image;
  }
  static parse(context: ALContext, buffer: Uint8Array, level: number): ALIG {
    console.log(`${"  ".repeat(level)}- ALIG (AL Image)`);
    const br = new DataViewReader(buffer);
    const convert = (x: number) => Math.floor(x / 8) * 64 + (x % 8) * 9;
    const head = br.ReadString(4);
    if (head !== 'ALIG') {
      throw new Error(`Block signature is not as expected: ${head} != ALIG`);
    }

    const _vers = br.ReadByte();
    const _unknown1 = br.ReadByte();
    const paletteSize = br.ReadWord();
    const form = br.ReadString(4);
    const paletteForm = br.ReadString(4);
    const width = br.ReadDword();
    const height = br.ReadDword();
    const _unknown2 = br.ReadWord();
    const _unknown3 = br.ReadWord();
    const _unknown4 = br.ReadByte();
    const _unknown5 = br.ReadByte();
    const _unknown6 = br.ReadWord();
    const palette = new Array<Uint8Array>();

    console.log(`${"  ".repeat(level)}  [${form} > ${paletteForm}]`);

    const size = width * height;
    let image = new Uint8Array(4 * size);

    if (form.startsWith('PAL')) {
      for (let i = 0; i < paletteSize; i++)
        palette[i] = br.ReadBytes(4);
    }

    switch (form) {
      case 'PAL8':
        for (let i = 0; i < size; i++) {
          image.set(palette[br.ReadByte()], i * 4);
        }
        break;
      case 'PAL6':
        for (let i = 0; i < size; i++) {
          image.set(palette[br.ReadWord()], i * 4);
        }
        break;
      case 'PAL4':
        for (let i = 0; i < Math.floor(size / 2); i++) {
          const x = br.ReadByte();
          image.set(palette[x >> 4], i * 8);
          image.set(palette[x & 0xf], i * 8 + 4);
        }
        break;
      case 'PAL1':
        // FIXME Not sure if the process is correct.
        for (let i = 0; i < size; i++) {
          image.set(palette[br.ReadBit()], i * 4);
        }
        break;
      case 'ABG5':
        for (let i = 0; i < size; ++i) {
          const pix = br.ReadWord();
          const extractor = new ChannelExtractor(pix);
          let a = extractor.extract(2);
          let b = extractor.extract(32);
          let g = extractor.extract(32);
          let r = extractor.extract(32);
          r = convert(r);
          g = convert(g);
          b = convert(b);
          a = Math.floor(a * (255 / 1) + 0.5);
          image.set([r, g, b, a], i * 4);
        }
        break;
      case 'BGR5':
        for (let i = 0; i < size; ++i) {
          const pix = br.ReadWord();
          const extractor = new ChannelExtractor(pix);
          let b = extractor.extract(32);
          let g = extractor.extract(32);
          let r = extractor.extract(32);
          let a = extractor.extract(2);
          r = convert(r);
          g = convert(g);
          b = convert(b);
          a = Math.floor(a * (255 / 1) + 0.5);
          image.set([r, g, b, a], i * 4);
        }
        break;
      case 'ABG4':
        for (let i = 0; i < size; ++i) {
          const pix = br.ReadWord();
          const extractor = new ChannelExtractor(pix);
          let a = extractor.extract(16);
          let b = extractor.extract(16);
          let g = extractor.extract(16);
          let r = extractor.extract(16);
          r = Math.floor(r * (255 / 15) + 0.5);
          g = Math.floor(g * (255 / 15) + 0.5);
          b = Math.floor(b * (255 / 15) + 0.5);
          a = Math.floor(a * (255 / 15) + 0.5);
          image.set([r, g, b, a], i * 4);
        }
        break;
      case 'BGR4':
        for (let i = 0; i < size; ++i) {
          const pix = br.ReadWord();
          const extractor = new ChannelExtractor(pix);
          let b = extractor.extract(16);
          let g = extractor.extract(16);
          let r = extractor.extract(16);
          let a = extractor.extract(16);
          r = Math.floor(r * (255 / 1) + 0.5);
          g = Math.floor(g * (255 / 1) + 0.5);
          b = Math.floor(b * (255 / 1) + 0.5);
          a = Math.floor(a * (255 / 1) + 0.5);
          image.set([r, g, b, a], i * 4);
        }
        break;
      case 'RGBA':
        image = br.ReadBytes(4 * size);
        break;
      case 'BGRA':
      {
        const p = br.ReadBytes(4 * size);
        for (let i = 0; i < p.length; i += 4) {
          const [a, r, g, b] = p.subarray(i, 4);
          image.set([r, g, b, a], i * 4);
        }
      }
        break;
      default:
        console.log('Unknwon image format: ', form);
        break;
    }
    return new ALIG(width, height, image);
  }
}

export type AlodEntry = {
  Name: string;
  Fields: { [index: string]: unknown };
};

export class ALOD extends AL {
  Entries: AlodEntry[];
  Almt?: ALMT;
  constructor(entries: AlodEntry[], almt: ALMT | undefined) {
    super('ALOD');
    this.Entries = entries;
    this.Almt = almt;
  }
  static parse(context: ALContext, buffer: Uint8Array, level: number): ALOD {
    console.log(`${"  ".repeat(level)}- ALOD (AL Object Definition)`);
    const br = new DataViewReader(buffer);
    const head = br.ReadString(4);
    if (head !== 'ALOD') {
      throw new Error(`Block signature is not as expected: ${head} != ALOD`);
    }

    const _vers = br.ReadByte();
    const form = br.ReadByte();
    const entryCount = br.ReadByte();
    const fieldCount = br.ReadByte();
    const _unknown = br.ReadDword();
    const almtOffset = br.ReadDword();
    const entries = new Array<AlodEntry>();
    let almt: ALMT | undefined;

    const entryOffsets = new Array<number>();
    for (let i = 0; i < entryCount; i++) {
      entryOffsets.push(br.ReadWord());
    }

    const fieldOffsets = new Array<number>();
    for (let i = 0; i < fieldCount; i++) {
      fieldOffsets.push(br.ReadWord());
    }

    const fields = [];
    for (let i = 0; i < fieldCount; i++) {
      fields.push(br.ReadString());
    }

    br.Align(4);
    for (let i = 0; i < entryCount; i++) {
      br.Align(4);
      br.Seek(entryOffsets[i], Origin.Begin);
      const entry: AlodEntry = {
        Name: br.ReadString(8),
        Fields: {},
      };

      const entryFieldCount = br.ReadDword();

      const entryFieldOffsets = new Array<number>();
      for (let j = 0; j < entryFieldCount; j++) {
        entryFieldOffsets.push(entryOffsets[i] + br.ReadWord());
      }

      const entryFieldIndexes = new Array<number>();
      for (let j = 0; j < entryFieldCount; j++) {
        entryFieldIndexes.push(br.ReadByte());
      }

      br.Align(2);

      for (let j = 0; j < entryFieldCount; j++) {
        const field = fields[entryFieldIndexes[j]];
        br.Seek(entryFieldOffsets[j], Origin.Begin);
        switch (field) {
          case 'Texture0ID':
            entry.Fields[field] = {
              Id1: br.ReadWord(),
              Id2: br.ReadWord(),
            };
            break;
          case 'Color':
            entry.Fields[field] = {
              R: br.ReadFloat(),
              G: br.ReadFloat(),
              B: br.ReadFloat(),
              A: br.ReadFloat(),
            };
            break;
          case 'Alpha':
            entry.Fields[field] = br.ReadFloat();
            break;
          case 'ParentNodeID':
            entry.Fields[field] = br.ReadString(4);
            break;
          case 'Text':
            entry.Fields[field] = br.ReadString();
            break;
          case 'Scale':
          case 'Pos':
            entry.Fields[field] = {
              X: br.ReadFloat(),
              Y: br.ReadFloat(),
              Z: br.ReadFloat(),
            };
            break;
          case 'WidgetSize':
            // experiment
            entry.Fields[field] = {
              X: br.ReadWord(),
              Y: br.ReadWord(),
            };
            break;
          case 'WidgetSkinID':
            break;
          default:
            console.log(`Field not recognized: ${field}`);
        }
      }
      entries.push(entry);
      if (form === 2)
        almt = ALMT.parse(context, buffer.slice(almtOffset), level + 1);
    }
    return new ALOD(entries, almt);
  }
}

export type AlmtEntry = {
  Name: string;
  [k: string]: unknown;
};

export type AlmtField = {
  Offset: number;
  Id1: number;
  Id2: number;
  Name: string;
};

export class ALMT extends AL {
  Entries: AlmtEntry[];
  Fields: AlmtField[];
  constructor(fields: AlmtField[], entries: AlmtEntry[]) {
    super('ALMT');
    this.Fields = fields;
    this.Entries = entries;
  }
  static parse(context: ALContext, buffer: Uint8Array, level: number): ALMT {
    console.log(`${"  ".repeat(level)}- ALMT (AL Motion)`);
    const br = new DataViewReader(buffer);
    const head = br.ReadString(4);
    if (head !== 'ALMT') {
      throw new Error(`Block signature is not as expected: ${head} != ALMT`);
    }

    const _vers = br.ReadByte();
    const _unknown1 = br.ReadByte();
    const entryCount = br.ReadWord();
    const fieldCount = br.ReadByte();
    const _unknown2 = br.ReadByte();
    const _unknown3 = br.ReadWord();

    const entries = new Array<AlmtEntry>();
    const fields = new Array<AlmtField>();

    for (let i = 0; i < entryCount; i++) {
      entries.push({ Name: br.ReadString(4), Fields: {} });
    }

    const _dataOffset = br.ReadDword();

    for (let i = 0; i < fieldCount; i++) {
      fields.push({
        Offset: br.ReadWord(),
        Id1: 0,
        Id2: 0,
        Name: '',
      });
    }

    for (let i = 0; i < fieldCount; i++) {
      const field = fields[i];
      field.Id1 = br.ReadByte();
      field.Id2 = br.ReadByte();
      field.Name = br.ReadString();
    }

    br.Align(4);

    const _pattern = br.ReadDword();
    const _length = br.ReadWord();
    const _rate = br.ReadByte();
    const _flag1 = br.ReadByte();
    const unknown4 = br.ReadWord();
    let _entryOffset: number | undefined;

    for (let i = 0; i < (unknown4 - 0x002a) / 2; i++) {
      _entryOffset = br.ReadWord();
    }

    for (const entry of entries) {
      const fieldOffsetBase = br.Position;
      const fieldCountNonstream = br.ReadByte();
      const fieldCount = br.ReadByte();
      const fieldDescs = new Array<number>();
      for (let i = 0; i < fieldCount + fieldCountNonstream; i++) {
        fieldDescs.push(br.ReadByte());
      }

      br.Align(2);

      const fieldOffsets = new Array<number>();
      for (let i = 0; i < fieldCount + fieldCountNonstream; i++) {
        fieldOffsets.push(fieldOffsetBase + br.ReadWord());
      }

      fieldDescs.forEach((fieldDesc, idx) => {
        const field = fields[fieldDesc & 0x0f];
        const stream = new Array<{
          Time?: number;
          Data: unknown;
        }>();

        if (!field) {
          console.error("Couldn't get field.");
          return;
        }

        if (idx >= fieldCountNonstream) {
          while (true) {
            const time = br.ReadWord();
            if (time === 0xffff) break;
            if (time !== 0x494c) {
              stream.push({
                Time: time,
                Data: this.parseField(field.Name, br),
              });
            }
          }
        } else {
          stream.push({ Data: this.parseField(field.Name, br) });
        }
        entry[field.Name] = stream;
      });
    }
    return new ALMT(fields, entries);
  }
  private static parseField(name: string, br: DataViewReader): unknown {
    switch (name) {
      case 'PatternNo':
      case 'BlendMode':
      case 'Disp':
        return br.ReadWord();
      case 'Texture0ID':
        return {
          Id1: br.ReadWord(),
          Id2: br.ReadWord(),
        };
      case 'Alpha':
        return br.ReadFloat();
      case 'Pos':
        return {
          X: br.ReadFloat(),
          Y: br.ReadFloat(),
          Z: br.ReadFloat(),
        };
      case 'Rot':
        return br.ReadDword();
      case 'Scale':
      case 'Center':
        return {
          X: br.ReadFloat(),
          Y: br.ReadFloat(),
          Z: br.ReadFloat(),
        };
      case 'Color3':
        return [br.ReadFloat(), br.ReadFloat(), br.ReadFloat()];
      default:
        console.log(`Field not parsed: ${name}`);
        return;
    }
  }
}

const AlTypeMap = new Map<string, string>([
  ['ALTB', 'AL Table'],
  ['ALOD', 'AL Object Definition'],
  ['ALRD', 'AL Record Prop'],
  ['ALSD', 'AL Shader'],
  ['ALIG', 'AL Image'],
  ['ALTM', 'AL Tile Map'],
  ['ALSN', 'AL Sound'],
  ['ALAR', 'AL Archive'],
  ['ALMS', 'AL Mesh Collision'],
  ['ALCT', 'AL Container'],
  ['ALFT', 'AL Font'],
  ['ALMT', 'AL Motion'],
  ['ALPT', 'AL Pad Trace'],
  ['ALTX', 'AL Texture'],
  ['ALLZ', 'AL Compress'],
]);

function parseObject(context: ALContext, buffer: Uint8Array, level = 0): AL {
  const type = decoder.decode(buffer.slice(0, 4));
  switch (type) {
    case 'ALLZ': {
      const lz = ALLZ.parse(context, buffer, level);
      return parseObject(context, lz.Dst, level + 1);
    }
    case 'ALL4': {
      const l4 = ALL4.parse(context, buffer, level);
      return parseObject(context, l4.Dst, level + 1);
    }
    case 'ALTB':
      return ALTB.parse(context, buffer, level);
    case 'ALAR':
      return ALAR.parse(context, buffer, level);
    case 'ALTX':
      return ALTX.parse(context, buffer, level);
    case 'ALIG':
      return ALIG.parse(context, buffer, level);
    case 'ALOD':
      return ALOD.parse(context, buffer, level);
    case 'ALRD':
      return ALRD.parse(context, buffer, level);
    default:
      console.log(
        `Not Support type ${type}${
          AlTypeMap.has(type) ? ` ${AlTypeMap.get(type)}` : ''
        }`,
      );
      return DefaultAL.parse(context, buffer, level);
  }
}

export async function parseAL(context: ALContext, blob: Blob) {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  // gzip
  if (buffer.at(0) === 0x1f && buffer.at(1) === 0x8b) {
    return parseObject(context, gunzipSync(buffer));
  }
  return parseObject(context, buffer);
}
