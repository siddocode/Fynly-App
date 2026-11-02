import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/utils/prisma.js';

describe('Transactions API & Financial Integrity', () => {
  const app = createApp();
  const userEmail = `tx_user_${Date.now()}@fynly.test`;
  let token = '';
  let userId = '';
  let accountId = '';
  let createdTxId = '';

  beforeAll(async () => {
    // Register user
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: userEmail,
        password: 'Password123!',
        name: 'Transaction User',
      });

    token = res.body.data.tokens.accessToken;
    userId = res.body.data.user.id;

    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    accountId = meRes.body.data.accounts[0].id;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.user.delete({ where: { id: userId } });
    }
  });

  it('POST /api/v1/transactions creates INCOME and increments balance in integer paise', async () => {
    const amountPaise = 500000; // ₹5,000.00

    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId,
        type: 'INCOME',
        amountPaise,
        description: 'Monthly Freelance Payment',
        merchantName: 'Acme Corp',
        date: '2026-10-25T10:00:00.000Z',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.amountPaise).toBe(amountPaise.toString());
    expect(res.body.data).toHaveProperty('fingerprintHash');

    // Verify account balance in database increased
    const acc = await prisma.financialAccount.findUnique({ where: { id: accountId } });
    expect(acc?.balancePaise).toBe(BigInt(amountPaise));
  });

  it('POST /api/v1/transactions creates EXPENSE and decrements balance in integer paise', async () => {
    const amountPaise = 125000; // ₹1,250.00

    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId,
        type: 'EXPENSE',
        amountPaise,
        description: 'Grocery Shopping',
        merchantName: 'SuperMart',
        date: '2026-10-26T14:30:00.000Z',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    createdTxId = res.body.data.id;

    // Balance should now be 500000 - 125000 = 375000
    const acc = await prisma.financialAccount.findUnique({ where: { id: accountId } });
    expect(acc?.balancePaise).toBe(BigInt(375000));
  });

  it('POST /api/v1/transactions rejects duplicate transaction with 409 Conflict', async () => {
    // Attempt identical transaction: same account, date, amount, merchant
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId,
        type: 'EXPENSE',
        amountPaise: 125000,
        description: 'Grocery Shopping',
        merchantName: 'SuperMart',
        date: '2026-10-26T14:30:00.000Z',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('already exists');
    expect(res.body.error.details).toHaveProperty('duplicateTransactionId');
  });

  it('POST /api/v1/transactions accepts duplicate when allowDuplicate is true', async () => {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId,
        type: 'EXPENSE',
        amountPaise: 125000,
        description: 'Grocery Shopping',
        merchantName: 'SuperMart',
        date: '2026-10-26T14:30:00.000Z',
        allowDuplicate: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('GET /api/v1/transactions returns list with search & pagination', async () => {
    const res = await request(app)
      .get('/api/v1/transactions?search=SuperMart&page=1&limit=10')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.transactions.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.pagination).toHaveProperty('total');
    expect(res.body.data.pagination.page).toBe(1);
  });

  it('DELETE /api/v1/transactions/:id deletes and atomically reverses account balance', async () => {
    const accBefore = await prisma.financialAccount.findUnique({ where: { id: accountId } });
    const balanceBefore = accBefore!.balancePaise;

    const res = await request(app)
      .delete(`/api/v1/transactions/${createdTxId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Because it was an EXPENSE of 125000, balance should increase by 125000
    const accAfter = await prisma.financialAccount.findUnique({ where: { id: accountId } });
    expect(accAfter!.balancePaise).toBe(balanceBefore + BigInt(125000));
  });

  it('Enforces cross-user isolation: user B cannot access user A transaction', async () => {
    // Create second user
    const otherUserRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: `other_${Date.now()}@fynly.test`,
        password: 'Password123!',
        name: 'Other User',
      });

    const otherToken = otherUserRes.body.data.tokens.accessToken;
    const otherUserId = otherUserRes.body.data.user.id;

    // User B tries to fetch remaining transactions of User A
    const res = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(200);
    // User B has zero transactions
    expect(res.body.data.transactions.length).toBe(0);

    // Cleanup other user
    await prisma.user.delete({ where: { id: otherUserId } });
  });

  it('DELETE /api/v1/transactions/history/clear clears all transactions for user', async () => {
    // Create a transaction first
    await request(app)
      .post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId,
        type: 'EXPENSE',
        amountPaise: '50000',
        date: new Date().toISOString(),
        description: 'Temporary Test Expense',
      });

    const res = await request(app)
      .delete('/api/v1/transactions/history/clear?resetBalances=true')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const checkRes = await request(app)
      .get('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`);

    expect(checkRes.status).toBe(200);
    expect(checkRes.body.data.transactions.length).toBe(0);
  });
});
