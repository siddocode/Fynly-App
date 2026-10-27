import { parse } from 'csv-parse/sync';

export interface ParsedStatementRow {
  rowNumber: number;
  date: Date;
  rawDate: string;
  description: string;
  merchantName: string;
  amountPaise: bigint;
  type: 'EXPENSE' | 'INCOME';
  referenceNumber?: string;
  suggestedCategorySlug?: string;
}

// Keyword-based auto categorization mapping
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'food-dining': ['swiggy', 'zomato', 'starbucks', 'mcdonald', 'burger', 'kfc', 'cafe', 'restaurant', 'pizza', 'subway', 'dine'],
  'groceries': ['blinkit', 'zepto', 'instamart', 'bigbasket', 'supermarket', 'mart', 'grocery', 'nature basket', 'dmart', 'reliance fresh'],
  'transportation': ['uber', 'ola', 'rapido', 'metro', 'petrol', 'fuel', 'hpcl', 'bpcl', 'ioc', 'shell', 'parking', 'toll', 'fastag'],
  'shopping': ['amazon', 'flipkart', 'myntra', 'zara', 'h&m', 'ajio', 'nykaa', 'tata cliq', 'retail', 'croma'],
  'entertainment': ['netflix', 'spotify', 'prime', 'hotstar', 'pvr', 'inox', 'cinema', 'movie', 'bookmyshow', 'gaming', 'steam'],
  'utilities': ['electricity', 'bescom', 'cesc', 'airtel', 'jio', 'vodafone', 'wifi', 'broadband', 'water', 'gas', 'billdesk', 'recharge'],
  'healthcare': ['apollo', 'pharmacy', '1mg', 'practo', 'hospital', 'clinic', 'medplus', 'dr ', 'diagnostics', 'lab'],
  'housing': ['rent', 'maintenance', 'society', 'landlord', 'nobroker'],
  'salary-income': ['salary', 'payroll', 'wages', 'dividend', 'interest', 'bonus', 'refund', 'cashback'],
  'investments': ['zerodha', 'groww', 'kuvera', 'mutual fund', 'sip', 'nse', 'bse', 'smallcase', 'coin'],
};

export const suggestCategorySlug = (text: string): string => {
  const normalized = text.toLowerCase();
  for (const [slug, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => normalized.includes(kw))) {
      return slug;
    }
  }
  return 'other';
};

export const extractMerchantName = (description: string): string => {
  // UPI / POS pattern cleanup: e.g. "UPI-SWIGGY-1234@okaxis" -> "SWIGGY"
  let cleaned = description.trim();

  // If starts with UPI/POS/NEFT/IMPS
  cleaned = cleaned.replace(/^(UPI|POS|NEFT|IMPS|RTGS|ACH|E-CHQ)[-/:\s]+/i, '');

  // Extract primary segment before reference codes
  const parts = cleaned.split(/[-/@_]/);
  if (parts.length > 0 && parts[0].trim().length >= 2) {
    return parts[0].trim();
  }

  return cleaned.slice(0, 30);
};

export const parseAmountToPaise = (amountStr: string | number): bigint => {
  if (typeof amountStr === 'number') {
    return BigInt(Math.round(Math.abs(amountStr) * 100));
  }
  // Strip commas, currency symbols, and whitespace
  const sanitized = amountStr.replace(/[^0-9.-]/g, '').trim();
  const num = parseFloat(sanitized);
  if (isNaN(num)) return 0n;
  return BigInt(Math.round(Math.abs(num) * 100));
};

export const parseDateFlexible = (dateStr: string): Date => {
  const clean = dateStr.trim();

  // ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    const d = new Date(clean);
    if (!isNaN(d.getTime())) return d;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const parts = clean.split(/[/-]/);
  if (parts.length === 3) {
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    const p2 = parseInt(parts[2], 10);

    // If p0 is year: YYYY/MM/DD
    if (p0 > 1000) {
      return new Date(p0, p1 - 1, p2, 12, 0, 0);
    }

    // Standard Indian DD/MM/YYYY
    if (p2 > 1000) {
      return new Date(p2, p1 - 1, p0, 12, 0, 0);
    }
  }

  // Fallback to JS Date parser (handles "25 Oct 2026")
  const fallback = new Date(clean);
  if (!isNaN(fallback.getTime())) return fallback;

  return new Date();
};

export const parseBankStatementCsv = (csvContent: string): ParsedStatementRow[] => {
  // Parse CSV records
  const records: string[][] = parse(csvContent, {
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  });

  if (records.length < 2) {
    return [];
  }

  // Find header row index (first row that contains 'date' or 'narration' or 'description')
  let headerIndex = -1;
  for (let i = 0; i < Math.min(15, records.length); i++) {
    const rowStr = records[i].join(' ').toLowerCase();
    if (rowStr.includes('date') && (rowStr.includes('narrat') || rowStr.includes('desc') || rowStr.includes('particular') || rowStr.includes('amount') || rowStr.includes('debit'))) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    headerIndex = 0; // Fallback to first row
  }

  const headers = records[headerIndex].map((h) => h.toLowerCase().trim());

  // Identify column indices with word boundaries for short terms like 'cr' and 'dr'
  let dateCol = headers.findIndex((h) => h.includes('date') || h.includes('txn date'));
  let descCol = headers.findIndex((h) => h.includes('narration') || h.includes('description') || h.includes('particulars') || h.includes('remarks'));
  let debitCol = headers.findIndex((h) => h.includes('debit') || h.includes('withdrawal') || /\bdr\b/.test(h));
  let creditCol = headers.findIndex((h) => h.includes('credit') || h.includes('deposit') || /\bcr\b/.test(h));
  let amountCol = headers.findIndex((h) => h.includes('amount') && !h.includes('withdrawal') && !h.includes('deposit'));
  let typeCol = headers.findIndex((h) => h.includes('type') || h === 'cr/dr' || h === 'dr/cr');
  let refCol = headers.findIndex((h) => h.includes('ref') || h.includes('chq') || h.includes('cheque') || h.includes('utr'));

  // Fallbacks if specific headers not found
  if (dateCol === -1) dateCol = 0;
  if (descCol === -1) descCol = 1;

  const parsedRows: ParsedStatementRow[] = [];

  for (let i = headerIndex + 1; i < records.length; i++) {
    const row = records[i];
    if (!row || row.length <= 1) continue;

    const rawDate = row[dateCol];
    if (!rawDate || rawDate.toLowerCase().includes('total') || rawDate.toLowerCase().includes('balance')) {
      continue;
    }

    const description = row[descCol] || 'Bank Transaction';
    const parsedDate = parseDateFlexible(rawDate);

    let amountPaise = 0n;
    let type: 'EXPENSE' | 'INCOME' = 'EXPENSE';

    if (debitCol !== -1 && creditCol !== -1) {
      const debitVal = parseAmountToPaise(row[debitCol] || '0');
      const creditVal = parseAmountToPaise(row[creditCol] || '0');

      if (debitVal > 0n) {
        amountPaise = debitVal;
        type = 'EXPENSE';
      } else if (creditVal > 0n) {
        amountPaise = creditVal;
        type = 'INCOME';
      }
    } else if (amountCol !== -1) {
      const rawAmt = row[amountCol] || '0';
      const cleanNum = parseFloat(rawAmt.replace(/[^0-9.-]/g, ''));
      const absPaise = parseAmountToPaise(rawAmt);

      if (typeCol !== -1) {
        const typeStr = (row[typeCol] || '').toLowerCase();
        type = typeStr.includes('cr') || typeStr.includes('credit') ? 'INCOME' : 'EXPENSE';
      } else {
        type = cleanNum < 0 ? 'EXPENSE' : 'INCOME';
      }
      amountPaise = absPaise;
    }

    if (amountPaise <= 0n) continue;

    const merchantName = extractMerchantName(description);
    const suggestedCategorySlug = suggestCategorySlug(`${description} ${merchantName}`);
    const referenceNumber = refCol !== -1 ? row[refCol]?.trim() : undefined;

    parsedRows.push({
      rowNumber: i + 1,
      date: parsedDate,
      rawDate,
      description,
      merchantName,
      amountPaise,
      type,
      referenceNumber,
      suggestedCategorySlug,
    });
  }

  return parsedRows;
};
