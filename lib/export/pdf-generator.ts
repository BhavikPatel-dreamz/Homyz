/**
 * Pure TypeScript PDF 1.4 Document Generator
 * Generates ISO 32000 compliant PDF documents without external native or npm dependencies.
 */

export interface PdfTableColumn {
  header: string;
  key: string;
  width: number; // width in points
  align?: "left" | "right" | "center";
}

export interface PdfDocumentOptions {
  title: string;
  subtitle?: string;
  hostName?: string;
  periodLabel?: string;
  currency?: string;
  generatedAt?: string;
  footerNote?: string;
}

export class SimplePdfDocument {
  private pages: string[] = [];
  private currentPageStreams: string[] = [];
  private y: number = 780; // Start near top of A4 (841.89)
  private readonly pageWidth = 595.28;
  private readonly pageHeight = 841.89;
  private readonly leftMargin = 40;
  private readonly rightMargin = 40;
  private readonly bottomMargin = 50;
  private readonly usableWidth = 515.28;

  constructor(private options: PdfDocumentOptions) {
    this.startNewPage();
  }

  private escapePdfText(text: string): string {
    return text
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      // Replace non-ASCII characters with safe representations or closest ASCII
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/\u2026/g, "...")
      .replace(/[^\x20-\x7E]/g, (ch) => (ch.charCodeAt(0) > 127 ? " " : ch));
  }

  private startNewPage() {
    if (this.currentPageStreams.length > 0) {
      this.pages.push(this.currentPageStreams.join("\n"));
      this.currentPageStreams = [];
    }
    this.y = 780;
  }

  private ensureSpace(heightNeeded: number) {
    if (this.y - heightNeeded < this.bottomMargin) {
      this.startNewPage();
    }
  }

  public addHeader() {
    this.ensureSpace(80);
    // Top banner accent line
    this.addRect(this.leftMargin, this.y, this.usableWidth, 2, { fill: [0.1, 0.1, 0.1] });
    this.y -= 18;

    // Brand & Title
    this.addText("HOMYZ HOST FINANCIAL SERVICES", this.leftMargin, this.y, {
      font: "F2",
      size: 9,
      color: [0.4, 0.4, 0.4],
    });
    if (this.options.generatedAt) {
      this.addText(
        `Generated: ${this.options.generatedAt}`,
        this.pageWidth - this.rightMargin,
        this.y,
        { font: "F1", size: 8, align: "right", color: [0.5, 0.5, 0.5] },
      );
    }
    this.y -= 22;

    this.addText(this.options.title, this.leftMargin, this.y, {
      font: "F2",
      size: 20,
      color: [0.05, 0.05, 0.05],
    });
    this.y -= 16;

    const subDetails: string[] = [];
    if (this.options.subtitle) subDetails.push(this.options.subtitle);
    if (this.options.periodLabel) subDetails.push(`Period: ${this.options.periodLabel}`);
    if (this.options.currency) subDetails.push(`Reporting Currency: ${this.options.currency}`);
    if (this.options.hostName) subDetails.push(`Host: ${this.options.hostName}`);

    if (subDetails.length > 0) {
      this.addText(subDetails.join("   |   "), this.leftMargin, this.y, {
        font: "F1",
        size: 9,
        color: [0.35, 0.35, 0.35],
      });
      this.y -= 14;
    }

    // Divider line
    this.addLine(this.leftMargin, this.y, this.pageWidth - this.rightMargin, this.y, {
      color: [0.85, 0.85, 0.85],
      width: 0.75,
    });
    this.y -= 18;
  }

  public addSectionTitle(title: string) {
    this.ensureSpace(40);
    this.y -= 6;
    this.addText(title.toUpperCase(), this.leftMargin, this.y, {
      font: "F2",
      size: 11,
      color: [0.15, 0.15, 0.15],
    });
    this.y -= 4;
    this.addLine(this.leftMargin, this.y, this.pageWidth - this.rightMargin, this.y, {
      color: [0.88, 0.88, 0.88],
      width: 0.5,
    });
    this.y -= 12;
  }

  public addSummaryGrid(items: Array<{ label: string; value: string; isHighlight?: boolean }>) {
    this.ensureSpace(70);
    const cols = Math.min(items.length, 4);
    const boxWidth = (this.usableWidth - (cols - 1) * 8) / cols;
    const boxHeight = 48;

    items.forEach((item, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = this.leftMargin + col * (boxWidth + 8);
      const y = this.y - row * (boxHeight + 8) - boxHeight;

      if (row > 0 && col === 0) {
        this.ensureSpace(boxHeight + 8);
      }

      // Box background
      this.addRect(x, y, boxWidth, boxHeight, {
        fill: item.isHighlight ? [0.96, 0.97, 0.98] : [0.98, 0.98, 0.98],
        stroke: item.isHighlight ? [0.2, 0.2, 0.2] : [0.88, 0.88, 0.88],
        width: item.isHighlight ? 0.75 : 0.5,
      });

      // Label
      this.addText(item.label, x + 8, y + 32, {
        font: "F1",
        size: 7.5,
        color: [0.4, 0.4, 0.4],
      });

      // Value
      this.addText(item.value, x + 8, y + 14, {
        font: "F2",
        size: item.isHighlight ? 12 : 11,
        color: item.isHighlight ? [0.05, 0.05, 0.05] : [0.2, 0.2, 0.2],
      });
    });

    const rowsCount = Math.ceil(items.length / cols);
    this.y -= rowsCount * (boxHeight + 8) + 10;
  }

  public addTable<T extends Record<string, any>>(columns: PdfTableColumn[], data: T[]) {
    // Header row
    this.ensureSpace(35);
    const headerHeight = 20;
    this.addRect(this.leftMargin, this.y - headerHeight, this.usableWidth, headerHeight, {
      fill: [0.94, 0.94, 0.94],
    });

    let currentX = this.leftMargin;
    columns.forEach((col) => {
      const textX =
        col.align === "right"
          ? currentX + col.width - 6
          : col.align === "center"
            ? currentX + col.width / 2
            : currentX + 6;

      this.addText(col.header, textX, this.y - 13, {
        font: "F2",
        size: 8,
        align: col.align,
        color: [0.25, 0.25, 0.25],
      });
      currentX += col.width;
    });

    this.y -= headerHeight;

    // Data rows
    data.forEach((row, rowIndex) => {
      this.ensureSpace(20);
      const rowHeight = 18;
      const isEven = rowIndex % 2 === 0;

      if (!isEven) {
        this.addRect(this.leftMargin, this.y - rowHeight, this.usableWidth, rowHeight, {
          fill: [0.985, 0.985, 0.985],
        });
      }

      let rowX = this.leftMargin;
      columns.forEach((col) => {
        const rawValue = row[col.key];
        const valStr = rawValue !== undefined && rawValue !== null ? String(rawValue) : "";

        // Truncate if too long based on column width
        const maxChars = Math.max(4, Math.floor(col.width / 4.8));
        const safeText = valStr.length > maxChars ? `${valStr.slice(0, maxChars - 2)}...` : valStr;

        const textX =
          col.align === "right"
            ? rowX + col.width - 6
            : col.align === "center"
              ? rowX + col.width / 2
              : rowX + 6;

        this.addText(safeText, textX, this.y - 12, {
          font: "F1",
          size: 7.5,
          align: col.align,
          color: [0.15, 0.15, 0.15],
        });
        rowX += col.width;
      });

      // Bottom row divider line
      this.addLine(this.leftMargin, this.y - rowHeight, this.pageWidth - this.rightMargin, this.y - rowHeight, {
        color: [0.9, 0.9, 0.9],
        width: 0.3,
      });

      this.y -= rowHeight;
    });

    this.y -= 12;
  }

  public addCallout(text: string) {
    this.ensureSpace(35);
    const boxHeight = 24;
    this.addRect(this.leftMargin, this.y - boxHeight, this.usableWidth, boxHeight, {
      fill: [0.97, 0.97, 0.98],
      stroke: [0.85, 0.88, 0.92],
      width: 0.5,
    });
    this.addText(text, this.leftMargin + 10, this.y - 15, {
      font: "F1",
      size: 7.5,
      color: [0.3, 0.35, 0.45],
    });
    this.y -= boxHeight + 10;
  }

  public addNotes(notes: string[]) {
    notes.forEach((note) => this.addCallout(note));
  }

  public buildPdf(): Buffer {
    return this.toBuffer();
  }

  private addText(
    text: string,
    x: number,
    y: number,
    options: {
      font?: "F1" | "F2";
      size?: number;
      align?: "left" | "right" | "center";
      color?: [number, number, number];
    } = {},
  ) {
    const font = options.font || "F1";
    const size = options.size || 10;
    const align = options.align || "left";
    const color = options.color || [0, 0, 0];
    const escaped = this.escapePdfText(text);

    // Approximate width in points for standard Helvetica: ~0.55 * size * length
    const approxWidth = escaped.length * size * 0.52;
    let actualX = x;
    if (align === "right") {
      actualX = x - approxWidth;
    } else if (align === "center") {
      actualX = x - approxWidth / 2;
    }

    const [r, g, b] = color;
    this.currentPageStreams.push(
      `BT /${font} ${size} Tf ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg 1 0 0 1 ${actualX.toFixed(2)} ${y.toFixed(2)} Tm (${escaped}) Tj ET`,
    );
  }

  private addRect(
    x: number,
    y: number,
    w: number,
    h: number,
    options: {
      fill?: [number, number, number];
      stroke?: [number, number, number];
      width?: number;
    } = {},
  ) {
    let ops = "";
    if (options.fill) {
      const [r, g, b] = options.fill;
      ops += `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg `;
    }
    if (options.stroke) {
      const [r, g, b] = options.stroke;
      const lw = options.width || 0.5;
      ops += `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG ${lw.toFixed(2)} w `;
    }
    ops += `${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re `;
    if (options.fill && options.stroke) {
      ops += "B";
    } else if (options.fill) {
      ops += "f";
    } else if (options.stroke) {
      ops += "S";
    }
    this.currentPageStreams.push(ops);
  }

  private addLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    options: {
      color?: [number, number, number];
      width?: number;
    } = {},
  ) {
    const [r, g, b] = options.color || [0.8, 0.8, 0.8];
    const lw = options.width || 0.5;
    this.currentPageStreams.push(
      `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG ${lw.toFixed(2)} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`,
    );
  }

  public toBuffer(): Buffer {
    if (this.currentPageStreams.length > 0) {
      this.pages.push(this.currentPageStreams.join("\n"));
      this.currentPageStreams = [];
    }

    const totalPages = this.pages.length;
    const finalPageStreams = this.pages.map((stream, idx) => {
      // Append footer to each page
      const footerY = 28;
      const pageStr = `Page ${idx + 1} of ${totalPages}`;
      const footerDisclaimer =
        this.options.footerNote ||
        "Authoritative Host financial report generated by Homyz. Immutable completed-stay accounting basis.";

      const footerOps = [
        // Top line above footer
        `0.85 0.85 0.85 RG 0.5 w ${this.leftMargin} ${footerY + 12} m ${this.pageWidth - this.rightMargin} ${footerY + 12} l S`,
        // Disclaimer left
        `BT /F1 7 Tf 0.5 0.5 0.5 rg 1 0 0 1 ${this.leftMargin} ${footerY} Tm (${this.escapePdfText(footerDisclaimer)}) Tj ET`,
        // Page number right
        `BT /F1 7.5 Tf 0.4 0.4 0.4 rg 1 0 0 1 ${(this.pageWidth - this.rightMargin - 60).toFixed(2)} ${footerY} Tm (${pageStr}) Tj ET`,
      ];
      return `${stream}\n${footerOps.join("\n")}`;
    });

    // Build PDF objects
    // 1: Catalog
    // 2: Pages
    // 3: Font F1 (Helvetica)
    // 4: Font F2 (Helvetica-Bold)
    // For each page:
    // Page obj: 5 + 2 * i
    // Content stream obj: 6 + 2 * i
    const objects: string[] = [];
    const pageObjIds: number[] = [];

    for (let i = 0; i < totalPages; i++) {
      const pageObjId = 5 + 2 * i;
      const contentObjId = 6 + 2 * i;
      pageObjIds.push(pageObjId);
    }

    objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
    objects.push(
      `2 0 obj\n<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${totalPages} >>\nendobj`,
    );
    objects.push("3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj");
    objects.push("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj");

    for (let i = 0; i < totalPages; i++) {
      const pageObjId = 5 + 2 * i;
      const contentObjId = 6 + 2 * i;
      const streamContent = finalPageStreams[i];
      const streamLength = Buffer.byteLength(streamContent, "utf8");

      objects.push(
        `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.pageWidth.toFixed(2)} ${this.pageHeight.toFixed(2)}] /Contents ${contentObjId} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>\nendobj`,
      );
      objects.push(`${contentObjId} 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj`);
    }

    let body = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
    let offset = Buffer.byteLength(body, "utf8");
    const xref = ["0000000000 65535 f "];

    for (const obj of objects) {
      xref.push(`${String(offset).padStart(10, "0")} 00000 n `);
      body += `${obj}\n`;
      offset = Buffer.byteLength(body, "utf8");
    }

    const xrefOffset = offset;
    body += `xref\n0 ${objects.length + 1}\n${xref.join("\n")}\n`;
    body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(body, "utf8");
  }
}

