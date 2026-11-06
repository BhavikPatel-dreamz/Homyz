import zlib from "node:zlib";

/**
 * Pure TypeScript OpenXML (.xlsx) Spreadsheet Generator
 * Generates genuine Microsoft Excel (.xlsx) workbooks using Node.js built-in zlib without external npm dependencies.
 */

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
  type?: "string" | "number" | "currency" | "percentage" | "date";
}

export interface ExcelSheet {
  name: string;
  columns: ExcelColumn[];
  rows: Array<Record<string, any>>;
  summaryCards?: Array<{ label: string; value: string | number }>;
  headerTitle?: string;
  subtitle?: string;
}

export interface ExcelWorkbookOptions {
  creator?: string;
  created?: Date;
  sheets: ExcelSheet[];
}

/** Computes CRC-32 for ZIP archive entries using Node's native zlib */
function crc32(buf: Buffer): number {
  return zlib.crc32(buf);
}

/** Escapes XML special characters */
function escapeXml(str: unknown): string {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Converts a 0-indexed column number to Excel column letters (0 -> A, 27 -> AB) */
function colToLetters(colIndex: number): string {
  let temp = colIndex;
  let letter = "";
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

interface ZipEntry {
  path: string;
  data: Buffer;
}

/** Simple, reliable in-memory PKZIP archive builder */
function createZipArchive(entries: ZipEntry[]): Buffer {
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const filenameBuf = Buffer.from(entry.path, "utf-8");
    const uncompressedData = entry.data;
    const uncompressedSize = uncompressedData.length;
    const crc = crc32(uncompressedData);

    // Deflate data
    const compressedData = zlib.deflateRawSync(uncompressedData);
    const compressedSize = compressedData.length;

    // Local file header (30 bytes + filename)
    const localHeader = Buffer.alloc(30 + filenameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4); // version needed (2.0)
    localHeader.writeUInt16LE(0x0800, 6); // general purpose bit flag (UTF-8)
    localHeader.writeUInt16LE(8, 8); // compression method (8 = deflate)
    localHeader.writeUInt16LE(0, 10); // file time
    localHeader.writeUInt16LE(0, 12); // file date
    localHeader.writeUInt32LE(crc, 14); // crc-32
    localHeader.writeUInt32LE(compressedSize, 18); // compressed size
    localHeader.writeUInt32LE(uncompressedSize, 22); // uncompressed size
    localHeader.writeUInt16LE(filenameBuf.length, 26); // filename length
    localHeader.writeUInt16LE(0, 28); // extra field length
    filenameBuf.copy(localHeader, 30);

    localHeaders.push(localHeader, compressedData);

    // Central directory file header (46 bytes + filename)
    const centralHeader = Buffer.alloc(46 + filenameBuf.length);
    centralHeader.writeUInt32LE(0x02014b50, 0); // signature
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0x0800, 8); // general purpose bit flag (UTF-8)
    centralHeader.writeUInt16LE(8, 10); // compression method
    centralHeader.writeUInt16LE(0, 12); // file time
    centralHeader.writeUInt16LE(0, 14); // file date
    centralHeader.writeUInt32LE(crc, 16); // crc-32
    centralHeader.writeUInt32LE(compressedSize, 20); // compressed size
    centralHeader.writeUInt32LE(uncompressedSize, 24); // uncompressed size
    centralHeader.writeUInt16LE(filenameBuf.length, 28); // filename length
    centralHeader.writeUInt16LE(0, 30); // extra field length
    centralHeader.writeUInt16LE(0, 32); // comment length
    centralHeader.writeUInt16LE(0, 34); // disk number start
    centralHeader.writeUInt16LE(0, 36); // internal file attributes
    centralHeader.writeUInt32LE(0, 38); // external file attributes
    centralHeader.writeUInt32LE(offset, 42); // relative offset of local header
    filenameBuf.copy(centralHeader, 46);

    centralHeaders.push(centralHeader);

    offset += localHeader.length + compressedData.length;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const ch of centralHeaders) {
    centralDirSize += ch.length;
  }

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // signature
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk where central dir starts
  eocd.writeUInt16LE(entries.length, 8); // number of central dir records on this disk
  eocd.writeUInt16LE(entries.length, 10); // total number of central dir records
  eocd.writeUInt32LE(centralDirSize, 12); // size of central directory
  eocd.writeUInt32LE(centralDirOffset, 16); // offset of central directory
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

/** Generates standard styles.xml for Excel */
function generateStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="3">
    <numFmt numFmtId="164" formatCode="#,##0.00"/>
    <numFmt numFmtId="165" formatCode="0.0%"/>
    <numFmt numFmtId="166" formatCode="yyyy-mm-dd"/>
  </numFmts>
  <fonts count="4">
    <font><sz val="10"/><name val="Arial"/><family val="2"/></font>
    <font><b/><sz val="10"/><name val="Arial"/><family val="2"/></font>
    <font><b/><sz val="14"/><name val="Arial"/><family val="2"/><color rgb="FF1F2937"/></font>
    <font><sz val="9"/><name val="Arial"/><family val="2"/><color rgb="FF6B7280"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF3F4F6"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE5E7EB"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFD1D5DB"/></left>
      <right style="thin"><color rgb="FFD1D5DB"/></right>
      <top style="thin"><color rgb="FFD1D5DB"/></top>
      <bottom style="thin"><color rgb="FFD1D5DB"/></bottom>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="8">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/> <!-- 0: standard cell -->
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/> <!-- 1: table header -->
    <xf numFmtId="2" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/> <!-- 2: report title -->
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/> <!-- 3: subtitle / meta -->
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/> <!-- 4: currency/decimal -->
    <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/> <!-- 5: percentage -->
    <xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/> <!-- 6: date -->
    <xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/> <!-- 7: summary card -->
  </cellXfs>
</styleSheet>`;
}

/** Generates a single worksheet XML */
function generateSheetXml(sheet: ExcelSheet): string {
  let rowIdx = 1;
  const rowsXml: string[] = [];

  // Optional Header Title
  if (sheet.headerTitle) {
    rowsXml.push(`    <row r="${rowIdx}">
      <c r="A${rowIdx}" s="2" t="inlineStr"><is><t>${escapeXml(sheet.headerTitle)}</t></is></c>
    </row>`);
    rowIdx++;
  }

  // Optional Subtitle
  if (sheet.subtitle) {
    rowsXml.push(`    <row r="${rowIdx}">
      <c r="A${rowIdx}" s="3" t="inlineStr"><is><t>${escapeXml(sheet.subtitle)}</t></is></c>
    </row>`);
    rowIdx++;
  }

  // Optional Summary Cards
  if (sheet.summaryCards && sheet.summaryCards.length > 0) {
    rowIdx++; // Blank spacer
    let col = 0;
    const cardCells: string[] = [];
    for (const card of sheet.summaryCards) {
      const colLetter = colToLetters(col);
      const textVal = `${card.label}: ${card.value}`;
      cardCells.push(`<c r="${colLetter}${rowIdx}" s="7" t="inlineStr"><is><t>${escapeXml(textVal)}</t></is></c>`);
      col += 2;
    }
    rowsXml.push(`    <row r="${rowIdx}">${cardCells.join("")}</row>`);
    rowIdx += 2; // Spacer after cards
  }

  const tableHeaderRowIdx = rowIdx;

  // Table Headers
  const headerCells = sheet.columns.map((col, idx) => {
    const colLetter = colToLetters(idx);
    return `<c r="${colLetter}${tableHeaderRowIdx}" s="1" t="inlineStr"><is><t>${escapeXml(col.header)}</t></is></c>`;
  });
  rowsXml.push(`    <row r="${tableHeaderRowIdx}">${headerCells.join("")}</row>`);
  rowIdx++;

  // Data Rows
  for (const dataRow of sheet.rows) {
    const cells: string[] = [];
    for (let cIdx = 0; cIdx < sheet.columns.length; cIdx++) {
      const col = sheet.columns[cIdx];
      const colLetter = colToLetters(cIdx);
      const cellRef = `${colLetter}${rowIdx}`;
      const rawVal = dataRow[col.key];

      if (rawVal === null || rawVal === undefined || rawVal === "") {
        cells.push(`<c r="${cellRef}" s="0"/>`);
        continue;
      }

      if (col.type === "number" || col.type === "currency") {
        const numVal = Number(rawVal);
        if (Number.isFinite(numVal)) {
          const style = col.type === "currency" ? 4 : 0;
          cells.push(`<c r="${cellRef}" s="${style}"><v>${numVal}</v></c>`);
        } else {
          cells.push(`<c r="${cellRef}" s="0" t="inlineStr"><is><t>${escapeXml(rawVal)}</t></is></c>`);
        }
      } else if (col.type === "percentage") {
        const pctVal = Number(rawVal);
        if (Number.isFinite(pctVal)) {
          // If given as 65.5, convert to 0.655 for Excel percentage display
          const decimalVal = pctVal > 1 ? pctVal / 100 : pctVal;
          cells.push(`<c r="${cellRef}" s="5"><v>${decimalVal}</v></c>`);
        } else {
          cells.push(`<c r="${cellRef}" s="0" t="inlineStr"><is><t>${escapeXml(rawVal)}</t></is></c>`);
        }
      } else {
        cells.push(`<c r="${cellRef}" s="0" t="inlineStr"><is><t>${escapeXml(rawVal)}</t></is></c>`);
      }
    }
    rowsXml.push(`    <row r="${rowIdx}">${cells.join("")}</row>`);
    rowIdx++;
  }

  // Column width calculations
  const colsXml = sheet.columns.map((col, idx) => {
    const colNum = idx + 1;
    const width = col.width || Math.max(12, col.header.length + 4);
    return `<col min="${colNum}" max="${colNum}" width="${width}" customWidth="1"/>`;
  });

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews>
    <sheetView tabSelected="1" workbookViewId="0">
      <pane ySplit="${tableHeaderRowIdx}" topLeftCell="A${tableHeaderRowIdx + 1}" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <cols>
    ${colsXml.join("\n    ")}
  </cols>
  <sheetData>
${rowsXml.join("\n")}
  </sheetData>
</worksheet>`;
}

/**
 * Builds a valid Microsoft Excel (.xlsx) file as a Node.js Buffer.
 */
export function buildExcelWorkbook(options: ExcelWorkbookOptions): Buffer {
  const sheets = options.sheets.length > 0 ? options.sheets : [
    { name: "Report", columns: [{ header: "Data", key: "data" }], rows: [] },
  ];

  const entries: ZipEntry[] = [];

  // 1. [Content_Types].xml
  const sheetOverrides = sheets.map((_, idx) =>
    `<Override PartName="/xl/worksheets/sheet${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join("\n  ");

  entries.push({
    path: "[Content_Types].xml",
    data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheetOverrides}
</Types>`, "utf-8"),
  });

  // 2. _rels/.rels
  entries.push({
    path: "_rels/.rels",
    data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`, "utf-8"),
  });

  // 3. xl/_rels/workbook.xml.rels
  const sheetRels = sheets.map((_, idx) =>
    `<Relationship Id="rId${idx + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${idx + 1}.xml"/>`
  ).join("\n  ");

  const stylesRelId = `rId${sheets.length + 1}`;
  entries.push({
    path: "xl/_rels/workbook.xml.rels",
    data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheetRels}
  <Relationship Id="${stylesRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`, "utf-8"),
  });

  // 4. xl/workbook.xml
  const sheetDefs = sheets.map((s, idx) =>
    `<sheet name="${escapeXml(s.name)}" sheetId="${idx + 1}" r:id="rId${idx + 1}"/>`
  ).join("\n    ");

  entries.push({
    path: "xl/workbook.xml",
    data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${sheetDefs}
  </sheets>
</workbook>`, "utf-8"),
  });

  // 5. xl/styles.xml
  entries.push({
    path: "xl/styles.xml",
    data: Buffer.from(generateStylesXml(), "utf-8"),
  });

  // 6. Each sheet
  sheets.forEach((sheet, idx) => {
    entries.push({
      path: `xl/worksheets/sheet${idx + 1}.xml`,
      data: Buffer.from(generateSheetXml(sheet), "utf-8"),
    });
  });

  return createZipArchive(entries);
}

