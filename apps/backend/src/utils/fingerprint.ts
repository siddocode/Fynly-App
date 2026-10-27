import crypto from 'crypto';

export interface FingerprintInput {
  userId: string;
  accountId: string;
  date: Date | string;
  amountPaise: bigint | number | string;
  description: string;
  merchantName?: string | null;
}

export const generateTransactionFingerprint = (input: FingerprintInput): string => {
  // Normalize date to YYYY-MM-DD
  const dateObj = new Date(input.date);
  const dateStr = dateObj.toISOString().split('T')[0];

  // Normalize merchant/description: lowercase, remove punctuation and extra spaces
  const textSource = input.merchantName || input.description;
  const normalizedText = textSource
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();

  const amountStr = input.amountPaise.toString();

  const rawKey = `${input.userId}|${input.accountId}|${dateStr}|${amountStr}|${normalizedText}`;
  return crypto.createHash('sha256').update(rawKey).digest('hex');
};
