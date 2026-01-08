const PDF_LIB_CDN_URL = 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.esm.min.js';
const FONTKIT_CDN_URL = 'https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js';

let pdfLibModulePromise: Promise<any> | null = null;
let fontkitModulePromise: Promise<any> | null = null;
let PDFDocument: any;
let StandardFonts: any;
let rgb: any;

interface PdfMetadata {
    storeName: string;
    date: string;
    time: string;
    submittedAt: Date;
    itemsCount: number;
    totalAmount: string;
    totalWeight: number;
    summary: string;
}

interface PdfFonts {
    regular: any;
    bold: any;
}

interface PdfContext {
    pdfDoc: any;
    fonts: PdfFonts;
    metadata: PdfMetadata;
    totals: {
        amount: number;
    };
    page: any;
    cursorY: number;
}

interface UnloadingBatchData {
    storeName?: string;
    items?: any[];
    submittedAt?: string | Date;
    totalWeight?: number;
    summary?: string;
}

interface PdfOptions {
    download?: boolean;
}

async function loadPdfLib(): Promise<any> {
    if (!pdfLibModulePromise) {
        pdfLibModulePromise = import(/* @vite-ignore */ PDF_LIB_CDN_URL)
            .then((module) => {
                PDFDocument = module.PDFDocument;
                StandardFonts = module.StandardFonts;
                rgb = module.rgb;
                return module;
            })
            .catch((error) => {
                pdfLibModulePromise = null;
                console.error('Failed to load pdf-lib from CDN.', error);
                const failure = new Error('Failed to load pdf-lib from CDN.');
                (failure as any).cause = error;
                throw failure;
            });
    }

    return pdfLibModulePromise;
}

async function loadFontkit(): Promise<any> {
    if (!fontkitModulePromise) {
        fontkitModulePromise = new Promise((resolve, reject) => {
            if ((window as any).fontkit) {
                resolve((window as any).fontkit);
                return;
            }

            const script = document.createElement('script');
            script.src = FONTKIT_CDN_URL;
            script.async = true;

            script.onload = () => {
                if ((window as any).fontkit) {
                    console.log('✅ fontkit loaded successfully');
                    resolve((window as any).fontkit);
                } else {
                    reject(new Error('fontkit loaded but not found in window'));
                }
            };

            script.onerror = (error) => {
                fontkitModulePromise = null;
                console.error('Failed to load fontkit from CDN.', error);
                reject(new Error('Failed to load fontkit from CDN.'));
            };

            document.head.appendChild(script);
        });
    }

    return fontkitModulePromise;
}

const FONT_URLS = [
    'https://cdn.jsdelivr.net/npm/@fontsource/roboto@4.5.8/files/roboto-cyrillic-400-normal.woff',
    'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans@4.5.11/files/noto-sans-cyrillic-400-normal.woff',
    'fonts/Roboto-Regular.ttf'
];
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGINS = { top: 60, right: 40, bottom: 60, left: 40 };
const TABLE_COLUMNS = [
    { key: 'productName', title: 'Товар', width: 150, align: 'left' },
    { key: 'quantity', title: 'Кільк.', width: 55, align: 'right' },
    { key: 'unit', title: 'Од.', width: 40, align: 'center' },
    { key: 'source', title: 'Джерело', width: 95, align: 'left' },
    { key: 'pricePerUnit', title: 'Ціна', width: 70, align: 'right' },
    { key: 'totalAmount', title: 'Сума', width: 70, align: 'right' }
] as const;

const TABLE_PADDING_X = 6;
const LINE_HEIGHT = 16;

let cachedFontBytes: ArrayBuffer | null = null;

async function loadFontBytes(): Promise<ArrayBuffer | null> {
    if (cachedFontBytes) {
        return cachedFontBytes;
    }

    for (let i = 0; i < FONT_URLS.length; i++) {
        const url = FONT_URLS[i];
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            cachedFontBytes = await response.arrayBuffer();
            return cachedFontBytes;
        } catch (error: any) {
            console.warn(`⚠️ Failed to load font from ${url}: ${error.message}`);
            if (i === FONT_URLS.length - 1) return null;
        }
    }

    return null;
}

function formatMoney(value: any): string {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return '';
    return numericValue.toLocaleString('uk-UA', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatQuantity(value: any): string {
    if (value === undefined || value === null) return '';
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
        return numericValue % 1 === 0 ? numericValue.toString() : numericValue.toLocaleString('uk-UA');
    }
    return String(value);
}

function formatSource(source: string | undefined): string {
    if (!source) return '—';
    if (source === 'purchase') return 'Закупка';
    return source;
}

function splitTextIntoLines(text: string, font: any, fontSize: number, maxWidth: number): string[] {
    if (!text) return [''];

    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
        const tentativeLine = currentLine ? `${currentLine} ${word}` : word;
        const lineWidth = font.widthOfTextAtSize(tentativeLine, fontSize);

        if (lineWidth <= maxWidth || !currentLine) {
            currentLine = tentativeLine;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }

    if (currentLine) lines.push(currentLine);
    return lines.length > 0 ? lines : [''];
}

function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk as any);
    }
    return btoa(binary);
}

function ensureArray(items: any): any[] {
    if (!Array.isArray(items)) return [];
    return items;
}

function drawTableHeader(page: any, font: any, startY: number): number {
    const { width } = page.getSize();
    const tableWidth = width - (MARGINS.left + MARGINS.right);
    const headerHeight = LINE_HEIGHT + 6;
    const headerBottom = startY - headerHeight;

    page.drawRectangle({
        x: MARGINS.left,
        y: headerBottom,
        width: tableWidth,
        height: headerHeight,
        color: rgb(0.93, 0.95, 0.99)
    });

    let cursorX = MARGINS.left + TABLE_PADDING_X;
    const textBaseline = headerBottom + ((headerHeight - LINE_HEIGHT) / 2);

    for (const column of TABLE_COLUMNS) {
        page.drawText(column.title, {
            x: cursorX,
            y: textBaseline,
            size: 11,
            font,
            color: rgb(0.12, 0.16, 0.28)
        });
        cursorX += column.width;
    }

    return headerBottom - 4;
}

function createNewPage(pdfDoc: any, fonts: PdfFonts, options: { isFirstPage: boolean, metadata: PdfMetadata }): { page: any, cursorY: number } {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let cursorY = PAGE_HEIGHT - MARGINS.top;

    const titleFont = fonts.bold;
    const textFont = fonts.regular;

    page.drawText('Звіт по відвантаженню', {
        x: MARGINS.left,
        y: cursorY,
        size: 20,
        font: titleFont,
        color: rgb(0.11, 0.12, 0.35)
    });

    cursorY -= LINE_HEIGHT * 1.6;

    page.drawText(`Торгова точка: ${options.metadata.storeName}`, {
        x: MARGINS.left,
        y: cursorY,
        size: 12,
        font: textFont,
        color: rgb(0.16, 0.16, 0.16)
    });

    cursorY -= LINE_HEIGHT;
    page.drawText(`Дата: ${options.metadata.date}`, {
        x: MARGINS.left,
        y: cursorY,
        size: 12,
        font: textFont,
        color: rgb(0.16, 0.16, 0.16)
    });

    cursorY -= LINE_HEIGHT;
    page.drawText(`Час: ${options.metadata.time}`, {
        x: MARGINS.left,
        y: cursorY,
        size: 12,
        font: textFont,
        color: rgb(0.16, 0.16, 0.16)
    });

    cursorY -= LINE_HEIGHT;

    if (options.isFirstPage) {
        page.drawText(`Кількість позицій: ${options.metadata.itemsCount}`, {
            x: MARGINS.left,
            y: cursorY,
            size: 12,
            font: textFont,
            color: rgb(0.16, 0.16, 0.16)
        });

        cursorY -= LINE_HEIGHT;

        if (options.metadata.totalWeight > 0) {
            page.drawText(`Загальна вага: ${options.metadata.totalWeight} кг`, {
                x: MARGINS.left,
                y: cursorY,
                size: 12,
                font: textFont,
                color: rgb(0.16, 0.16, 0.16)
            });
            cursorY -= LINE_HEIGHT;
        }

        page.drawText(`Загальна сума: ${options.metadata.totalAmount} ₴`, {
            x: MARGINS.left,
            y: cursorY,
            size: 12,
            font: textFont,
            color: rgb(0.16, 0.16, 0.16)
        });

        cursorY -= LINE_HEIGHT * 1.5;

        const summaryText = options.metadata.summary;
        const summaryLines = splitTextIntoLines(summaryText, textFont, 11, PAGE_WIDTH - (MARGINS.left + MARGINS.right));
        for (const line of summaryLines) {
            page.drawText(line, {
                x: MARGINS.left,
                y: cursorY,
                size: 11,
                font: textFont,
                color: rgb(0.22, 0.22, 0.24)
            });
            cursorY -= LINE_HEIGHT;
        }
    } else {
        cursorY -= LINE_HEIGHT;
        page.drawText('Продовження звіту', {
            x: MARGINS.left,
            y: cursorY,
            size: 11,
            font: textFont,
            color: rgb(0.24, 0.24, 0.3)
        });
    }

    cursorY -= LINE_HEIGHT;
    return { page, cursorY };
}

function ensureSpaceForRow(context: PdfContext, requiredHeight: number): void {
    if (context.cursorY - requiredHeight < MARGINS.bottom) {
        const { page, cursorY } = createNewPage(context.pdfDoc, context.fonts, {
            isFirstPage: false,
            metadata: context.metadata
        });
        context.page = page;
        context.cursorY = drawTableHeader(context.page, context.fonts.bold, cursorY);
    }
}

function drawTableRow(context: PdfContext, item: any, index: number): void {
    const { page, fonts } = context;
    const fontSize = 11;
    const nameLines = splitTextIntoLines(item.productName || '—', fonts.regular, fontSize, TABLE_COLUMNS[0].width - (TABLE_PADDING_X * 2));
    const quantity = formatQuantity(item.quantity);
    const price = formatMoney(item.pricePerUnit);
    const total = formatMoney(item.totalAmount);
    const rowHeight = Math.max(nameLines.length, 1) * LINE_HEIGHT + 6;

    ensureSpaceForRow(context, rowHeight);

    const rowTop = context.cursorY;
    const rowBottom = rowTop - rowHeight;

    let cursorX = MARGINS.left;
    let textStartY = rowTop - LINE_HEIGHT;

    const backgroundColor = index % 2 === 0 ? rgb(0.98, 0.99, 1) : null;
    if (backgroundColor) {
        const tableWidth = PAGE_WIDTH - (MARGINS.left + MARGINS.right);
        page.drawRectangle({
            x: MARGINS.left,
            y: rowBottom,
            width: tableWidth,
            height: rowHeight,
            color: backgroundColor
        });
    }

    const source = formatSource(item.source);
    const sourceLines = splitTextIntoLines(source, fonts.regular, fontSize, TABLE_COLUMNS[3].width - (TABLE_PADDING_X * 2));

    const columnValues = [
        nameLines,
        [quantity],
        [item.unit || ''],
        sourceLines,
        [price ? `${price} ₴` : ''],
        [total ? `${total} ₴` : '']
    ];

    TABLE_COLUMNS.forEach((column, idx) => {
        const lines = columnValues[idx];
        let textY = textStartY;
        const align = column.align;

        for (const line of lines) {
            let textX = cursorX + TABLE_PADDING_X;
            if (align === 'right') {
                const textWidth = fonts.regular.widthOfTextAtSize(line, fontSize);
                textX = cursorX + column.width - TABLE_PADDING_X - textWidth;
            } else if (align === 'center') {
                const textWidth = fonts.regular.widthOfTextAtSize(line, fontSize);
                textX = cursorX + (column.width / 2) - (textWidth / 2);
            }

            page.drawText(line, {
                x: textX,
                y: textY,
                size: fontSize,
                font: fonts.regular,
                color: rgb(0.1, 0.1, 0.12)
            });

            textY -= LINE_HEIGHT;
        }

        cursorX += column.width;
    });

    context.cursorY = rowBottom - 4;
}

function drawTotalsRow(context: PdfContext): void {
    const { page, fonts, totals } = context;
    const fontSize = 12;
    const tableWidth = PAGE_WIDTH - (MARGINS.left + MARGINS.right);
    const rowHeight = LINE_HEIGHT + 8;

    ensureSpaceForRow(context, rowHeight);

    const rowTop = context.cursorY;
    const rowBottom = rowTop - rowHeight;
    const textBaseline = rowBottom + ((rowHeight - LINE_HEIGHT) / 2);

    page.drawRectangle({
        x: MARGINS.left,
        y: rowBottom,
        width: tableWidth,
        height: rowHeight,
        color: rgb(0.89, 0.92, 0.98)
    });

    page.drawText('Разом', {
        x: MARGINS.left + TABLE_PADDING_X,
        y: textBaseline,
        size: fontSize,
        font: fonts.bold,
        color: rgb(0.07, 0.07, 0.16)
    });

    const totalText = `${formatMoney(totals.amount)} ₴`;
    const totalWidth = fonts.bold.widthOfTextAtSize(totalText, fontSize);
    const totalX = PAGE_WIDTH - MARGINS.right - TABLE_PADDING_X - totalWidth;

    page.drawText(totalText, {
        x: totalX,
        y: textBaseline,
        size: fontSize,
        font: fonts.bold,
        color: rgb(0.07, 0.07, 0.16)
    });

    context.cursorY = rowBottom - 4;
}

export async function generateUnloadingReport(batchData: UnloadingBatchData, options: PdfOptions = {}): Promise<any> {
    await loadPdfLib();

    const {
        storeName = 'Невідома точка',
        items,
        submittedAt = new Date(),
        totalWeight = 0,
        summary
    } = batchData || {};

    const resolvedItems = ensureArray(items);
    if (resolvedItems.length === 0) {
        throw new Error('Немає товарів для формування звіту');
    }

    const pdfDoc = await PDFDocument.create();
    let fonts: PdfFonts;

    try {
        const fontkit = await loadFontkit();
        pdfDoc.registerFontkit(fontkit);
        const fontBytes = await loadFontBytes();

        if (fontBytes) {
            const customFont = await pdfDoc.embedFont(fontBytes);
            fonts = { regular: customFont, bold: customFont };
        } else {
            throw new Error('Font bytes not loaded');
        }
    } catch (fontError) {
        console.error('❌ Custom font failed, using standard fonts:', fontError);
        fonts = {
            regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
            bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold)
        };
    }

    const totalAmount = resolvedItems.reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0);
    const calculatedWeight = resolvedItems.reduce((sum, item) => {
        if (item.unit === 'kg') {
            return sum + (Number(item.quantity) || 0);
        }
        return sum;
    }, 0);

    const dateObj = new Date(submittedAt);
    const metadata: PdfMetadata = {
        storeName,
        date: dateObj.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        time: dateObj.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }),
        submittedAt: dateObj,
        itemsCount: resolvedItems.length,
        totalAmount: formatMoney(totalAmount),
        totalWeight: totalWeight || calculatedWeight,
        summary: summary || 'Документ згенеровано автоматично у додатку «Облік закупівель».'
    };

    const { page, cursorY } = createNewPage(pdfDoc, fonts, { isFirstPage: true, metadata });

    const context: PdfContext = {
        pdfDoc,
        fonts,
        metadata,
        totals: { amount: totalAmount },
        page,
        cursorY
    };

    context.cursorY = drawTableHeader(context.page, context.fonts.bold, cursorY);

    resolvedItems.forEach((item, index) => {
        drawTableRow(context, item, index);
    });

    drawTotalsRow(context);

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const base64 = bytesToBase64(pdfBytes);

    const dateForFile = `${String(dateObj.getDate()).padStart(2, '0')}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${dateObj.getFullYear()}`;
    const timeForFile = `${String(dateObj.getHours()).padStart(2, '0')}-${String(dateObj.getMinutes()).padStart(2, '0')}`;
    const fileName = `Відвантаження_${storeName}_${dateForFile}_${timeForFile}.pdf`;

    if (options.download !== false && typeof document !== 'undefined') {
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = fileName;
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 0);
    }

    return { fileName, blob, base64, bytes: pdfBytes };
}
