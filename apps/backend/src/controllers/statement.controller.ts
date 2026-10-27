import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { AppError } from '../middleware/error.middleware.js';
import { parseBankStatementCsv } from '../utils/csv.utils.js';
import { generateTransactionFingerprint } from '../utils/fingerprint.js';
import { evaluateBudgetThresholds } from '../utils/alert.utils.js';

export const previewStatementSchema = z.object({
  accountId: z.string().min(1, 'Account ID is required'),
  csvContent: z.string().min(10, 'CSV content is required'),
});

export const importStatementSchema = z.object({
  accountId: z.string().min(1, 'Account ID is required'),
  transactions: z.array(
    z.object({
      date: z.string(),
      description: z.string().min(1),
      merchantName: z.string().optional(),
      amountPaise: z.union([z.number(), z.string()]).transform((v) => BigInt(v)),
      type: z.enum(['INCOME', 'EXPENSE']),
      categoryId: z.string().optional(),
      referenceNumber: z.string().optional(),
      allowDuplicate: z.boolean().default(false),
    })
  ).min(1, 'At least one transaction is required for import'),
});

export const previewStatement = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { accountId, csvContent } = previewStatementSchema.parse(req.body);

    const account = await prisma.financialAccount.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) {
      throw new AppError('Account not found', 404);
    }

    const parsedRows = parseBankStatementCsv(csvContent);

    if (parsedRows.length === 0) {
      throw new AppError('No valid transaction rows found in CSV', 400);
    }

    // Fetch user categories for matching
    const categories = await prisma.category.findMany({
      where: { OR: [{ userId }, { userId: null }] },
    });

    const categoryMap = new Map(categories.map((c) => [c.slug, c.id]));

    // Generate fingerprints
    const rowsWithFingerprints = parsedRows.map((row) => {
      const fingerprintHash = generateTransactionFingerprint({
        userId,
        accountId,
        date: row.date,
        amountPaise: row.amountPaise,
        description: row.description,
        merchantName: row.merchantName,
      });

      const matchedCategoryId = row.suggestedCategorySlug
        ? categoryMap.get(row.suggestedCategorySlug)
        : undefined;

      return {
        ...row,
        fingerprintHash,
        categoryId: matchedCategoryId,
      };
    });

    // Check existing fingerprints in DB
    const existingHashes = new Set(
      (
        await prisma.transaction.findMany({
          where: {
            userId,
            fingerprintHash: { in: rowsWithFingerprints.map((r) => r.fingerprintHash) },
          },
          select: { fingerprintHash: true },
        })
      )
        .map((t) => t.fingerprintHash)
        .filter(Boolean)
    );

    let totalDebitPaise = 0n;
    let totalCreditPaise = 0n;
    let duplicateCount = 0;

    const previewRows = rowsWithFingerprints.map((row) => {
      const isDuplicate = existingHashes.has(row.fingerprintHash);
      if (isDuplicate) duplicateCount++;

      if (row.type === 'EXPENSE') totalDebitPaise += row.amountPaise;
      else totalCreditPaise += row.amountPaise;

      return {
        rowNumber: row.rowNumber,
        date: row.date.toISOString(),
        rawDate: row.rawDate,
        description: row.description,
        merchantName: row.merchantName,
        amountPaise: row.amountPaise.toString(),
        type: row.type,
        categoryId: row.categoryId,
        referenceNumber: row.referenceNumber,
        fingerprintHash: row.fingerprintHash,
        isDuplicate,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalRows: previewRows.length,
          newRowsCount: previewRows.length - duplicateCount,
          duplicateRowsCount: duplicateCount,
          totalDebitPaise: totalDebitPaise.toString(),
          totalCreditPaise: totalCreditPaise.toString(),
          accountName: account.name,
        },
        rows: previewRows,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const importStatement = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { accountId, transactions } = importStatementSchema.parse(req.body);

    const account = await prisma.financialAccount.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) {
      throw new AppError('Account not found', 404);
    }

    // Filter out duplicates if allowDuplicate is false
    const validRows = transactions.map((t) => ({
      ...t,
      fingerprintHash: generateTransactionFingerprint({
        userId,
        accountId,
        date: t.date,
        amountPaise: t.amountPaise,
        description: t.description,
        merchantName: t.merchantName,
      }),
    }));

    // Find duplicates
    const existingHashes = new Set(
      (
        await prisma.transaction.findMany({
          where: {
            userId,
            fingerprintHash: { in: validRows.map((r) => r.fingerprintHash) },
          },
          select: { fingerprintHash: true },
        })
      )
        .map((t) => t.fingerprintHash)
        .filter(Boolean)
    );

    const rowsToInsert = validRows.filter(
      (r) => r.allowDuplicate || !existingHashes.has(r.fingerprintHash)
    );

    if (rowsToInsert.length === 0) {
      throw new AppError('All transactions were identified as duplicates and skipped.', 409);
    }

    // Compute net balance change
    let netChangePaise = 0n;
    for (const r of rowsToInsert) {
      if (r.type === 'INCOME') netChangePaise += r.amountPaise;
      else netChangePaise -= r.amountPaise;
    }

    // Batch insert and update account balance atomically
    await prisma.$transaction(
      async (tx) => {
        // Create transactions
        await tx.transaction.createMany({
          data: rowsToInsert.map((r) => ({
            userId,
            accountId,
            categoryId: r.categoryId || null,
            type: r.type,
            amountPaise: r.amountPaise,
            date: new Date(r.date),
            description: r.description.trim(),
            merchantName: r.merchantName?.trim() || null,
            fingerprintHash: r.fingerprintHash,
            referenceNumber: r.referenceNumber || null,
          })),
        });

        // Update account balance
        await tx.financialAccount.update({
          where: { id: accountId },
          data: {
            balancePaise: { increment: netChangePaise },
          },
        });
      },
      { maxWait: 15000, timeout: 30000 }
    );

    // Evaluate budget threshold alerts
    const alertsTriggered = await evaluateBudgetThresholds(prisma, userId).catch(() => []);

    const updatedAccount = await prisma.financialAccount.findUnique({
      where: { id: accountId },
      select: { balancePaise: true },
    });

    res.status(201).json({
      success: true,
      data: {
        importedCount: rowsToInsert.length,
        skippedCount: validRows.length - rowsToInsert.length,
        newBalancePaise: updatedAccount?.balancePaise.toString(),
        alertsTriggeredCount: alertsTriggered.length,
      },
    });
  } catch (error) {
    next(error);
  }
};
