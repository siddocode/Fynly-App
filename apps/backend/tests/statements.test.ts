import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/utils/prisma.js';
import {
  parseBankStatementCsv,
  suggestCategorySlug,
  extractMerchantName,
  parseAmountToPaise,
} from '../src/utils/csv.utils.js';

describe('Bank Statement CSV Parser (Unit Tests)', () => {
  it('parses standard HDFC / ICICI bank statement format', () => {
    const csvData = `Date,Narration,Chq/Ref No,Withdrawal Amt.,Deposit Amt.,Closing Balance
25/10/2026,UPI-SWIGGY-12345@okaxis,REF987654,450.00,,4550.00
26/10/2026,SALARY CREDIT FROM ACME CORP,REF112233,,75000.00,79550.00
27/10/2026,UBER RIDES MUMBAI,REF445566,320.50,,79229.50`;

    const rows = parseBankStatementCsv(csvData);

    expect(rows.length).toBe(3);

    // Row 1: Swiggy expense
    expect(rows[0].type).toBe('EXPENSE');
    expect(rows[0].amountPaise).toBe(45000n); // ₹450.00 = 45000 paise
    expect(rows[0].suggestedCategorySlug).toBe('food-dining');

    // Row 2: Salary income
    expect(rows[1].type).toBe('INCOME');
    expect(rows[1].amountPaise).toBe(7500000n); // ₹75,000.00 = 7500000 paise
    expect(rows[1].suggestedCategorySlug).toBe('salary-income');

    // Row 3: Uber expense
    expect(rows[2].type).toBe('EXPENSE');
    expect(rows[2].amountPaise).toBe(32050n); // ₹320.50 = 32050 paise
    expect(rows[2].suggestedCategorySlug).toBe('transportation');
  });

  it('correctly cleans merchant names and parses Indian number formats', () => {
    expect(extractMerchantName('UPI-STARBUCKS-897987@hdfc')).toBe('STARBUCKS');
    expect(suggestCategorySlug('BLINKIT ORDER 9988')).toBe('groceries');
    expect(suggestCategorySlug('NETFLIX SUBSCRIPTION')).toBe('entertainment');
    expect(parseAmountToPaise('1,25,000.50')).toBe(12500050n);
  });
});

describe('Statement Import & Threshold Alerts (Integration Tests)', () => {
  const app = createApp();
  const testEmail = `statement_user_${Date.now()}@fynly.test`;
  let token = '';
  let userId = '';
  let accountId = '';

  beforeAll(async () => {
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: testEmail,
        password: 'Password123!',
        name: 'Statement Auditor',
      });

    token = regRes.body.data.tokens.accessToken;
    userId = regRes.body.data.user.id;

    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    accountId = meRes.body.data.accounts[0].id;

    // Set a monthly budget of ₹10,000 (1000000 paise) to test threshold alerts
    await request(app)
      .post('/api/v1/budgets')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Monthly Budget',
        period: 'MONTHLY',
        limitPaise: 1000000, // ₹10,000.00
      });
  });

  afterAll(async () => {
    if (userId) {
      await prisma.user.delete({ where: { id: userId } });
    }
  });

  it('POST /api/v1/statements/preview parses CSV and identifies new vs duplicate rows', async () => {
    const csvContent = `Date,Description,Debit,Credit
2026-10-20,Blinkit Groceries,1500.00,
2026-10-21,Salary Bonus,,5000.00
2026-10-22,Starbucks Coffee,350.00,`;

    const res = await request(app)
      .post('/api/v1/statements/preview')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId,
        csvContent,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.summary.totalRows).toBe(3);
    expect(res.body.data.summary.newRowsCount).toBe(3);
    expect(res.body.data.summary.duplicateRowsCount).toBe(0);
    expect(res.body.data.rows[0].type).toBe('EXPENSE');
  });

  it('POST /api/v1/statements/import batch imports transactions and updates balance atomically', async () => {
    // Import 2 expenses totaling ₹7,500 (750000 paise) which crosses 70% of the ₹10,000 budget!
    const res = await request(app)
      .post('/api/v1/statements/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId,
        transactions: [
          {
            date: '2026-10-24T12:00:00.000Z',
            description: 'Electronics Gadget Purchase',
            merchantName: 'Electronics Gadget Purchase',
            amountPaise: 500000, // ₹5,000.00
            type: 'EXPENSE',
          },
          {
            date: '2026-10-25T14:00:00.000Z',
            description: 'Fine Dining Weekend',
            merchantName: 'Taj Hotel',
            amountPaise: 250000, // ₹2,500.00
            type: 'EXPENSE',
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.importedCount).toBe(2);

    // Verify account balance updated atomically in database
    const acc = await prisma.financialAccount.findUnique({ where: { id: accountId } });
    expect(acc?.balancePaise).toBe(-750000n);
  });

  it('Threshold alerts engine triggered notification for crossing 70% budget', async () => {
    const res = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.notifications.length).toBeGreaterThanOrEqual(1);

    const alert = res.body.data.notifications[0];
    expect(alert.type).toBe('THRESHOLD_70');
    expect(alert.title).toContain('70%');
  });

  it('Re-previewing the same statement identifies transactions as duplicate', async () => {
    const previewRes = await request(app)
      .post('/api/v1/statements/preview')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId,
        csvContent: `Date,Description,Debit,Credit\n2026-10-24,Electronics Gadget Purchase,5000.00,`,
      });

    expect(previewRes.status).toBe(200);
    expect(previewRes.body.data.summary.duplicateRowsCount).toBe(1);
    expect(previewRes.body.data.rows[0].isDuplicate).toBe(true);
  });

  it('PATCH /api/v1/notifications/all/read marks all alerts as read', async () => {
    const res = await request(app)
      .patch('/api/v1/notifications/all/read')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const notifRes = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${token}`);

    expect(notifRes.body.data.unreadCount).toBe(0);
  });
});
