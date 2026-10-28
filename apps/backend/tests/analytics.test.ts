import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/utils/prisma.js';

describe('Analytics, Insights & Bank Sync API (Integration Tests)', () => {
  const app = createApp();
  const testEmailA = `analytics_user_a_${Date.now()}@fynly.test`;
  const testEmailB = `analytics_user_b_${Date.now()}@fynly.test`;

  let tokenA = '';
  let userIdA = '';
  let accountIdA = '';

  let tokenB = '';
  let userIdB = '';
  let categoryId = '';

  beforeAll(async () => {
    // Register User A
    const regResA = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: testEmailA,
        password: 'Password123!',
        name: 'Analytics Tester A',
      });

    tokenA = regResA.body.data.tokens.accessToken;
    userIdA = regResA.body.data.user.id;

    const meResA = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${tokenA}`);

    accountIdA = meResA.body.data.accounts[0].id;

    // Register User B for isolation testing
    const regResB = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: testEmailB,
        password: 'Password123!',
        name: 'Analytics Tester B',
      });

    tokenB = regResB.body.data.tokens.accessToken;
    userIdB = regResB.body.data.user.id;

    // Get a category ID
    const catRes = await request(app)
      .get('/api/v1/categories')
      .set('Authorization', `Bearer ${tokenA}`);

    categoryId = catRes.body.data[0].id;

    // Seed test transactions for User A directly via prisma for fast execution
    const now = new Date();
    const currentMonthDate1 = new Date(now.getFullYear(), now.getMonth(), 2, 10, 0, 0);
    const currentMonthDate2 = new Date(now.getFullYear(), now.getMonth(), 5, 12, 0, 0);
    const currentMonthDate3 = new Date(now.getFullYear(), now.getMonth(), 10, 15, 0, 0);
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 15, 10, 0, 0);

    await prisma.transaction.createMany({
      data: [
        {
          userId: userIdA,
          accountId: accountIdA,
          type: 'INCOME',
          status: 'SETTLED',
          amountPaise: 8000000n,
          date: currentMonthDate1,
          description: 'Monthly Salary',
          merchantName: 'Tech Corp',
        },
        {
          userId: userIdA,
          accountId: accountIdA,
          categoryId,
          type: 'EXPENSE',
          status: 'SETTLED',
          amountPaise: 150000n,
          date: currentMonthDate2,
          description: 'Swiggy Dinner',
          merchantName: 'Swiggy',
        },
        {
          userId: userIdA,
          accountId: accountIdA,
          categoryId,
          type: 'EXPENSE',
          status: 'SETTLED',
          amountPaise: 64900n,
          date: currentMonthDate3,
          description: 'Netflix Monthly Subscription',
          merchantName: 'Netflix',
        },
        {
          userId: userIdA,
          accountId: accountIdA,
          categoryId,
          type: 'EXPENSE',
          status: 'SETTLED',
          amountPaise: 64900n,
          date: prevMonthDate,
          description: 'Netflix Monthly Subscription',
          merchantName: 'Netflix',
        },
      ],
    });

    // Create a monthly budget of ₹30,000 (3000000 paise)
    await prisma.budget.create({
      data: {
        userId: userIdA,
        name: 'October Budget',
        period: 'MONTHLY',
        limitPaise: 3000000n,
        startDate: new Date(now.getFullYear(), now.getMonth(), 1),
      },
    });
  }, 60000);

  afterAll(async () => {
    if (userIdA) await prisma.user.delete({ where: { id: userIdA } });
    if (userIdB) await prisma.user.delete({ where: { id: userIdB } });
  });

  it('GET /api/v1/analytics/overview returns consolidated monthly insights & forecast', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/overview')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { period, summary, forecast, categories, topMerchants, weeklyBreakdown } = res.body.data;

    // Period checks
    expect(period.totalDays).toBeGreaterThanOrEqual(28);
    expect(period.daysElapsed).toBeGreaterThanOrEqual(1);

    // Summary checks
    expect(BigInt(summary.currentMonthSpentPaise)).toBe(150000n + 64900n);
    expect(BigInt(summary.currentMonthIncomePaise)).toBe(8000000n);
    expect(BigInt(summary.netSavingsPaise)).toBe(8000000n - (150000n + 64900n));
    expect(summary.savingsRatePercentage).toBeGreaterThan(0);

    // Month-over-month checks
    expect(summary.prevMonthSpentPaise).toBe('64900');
    expect(summary.monthOverMonth.direction).toBe('INCREASED');

    // Forecast checks
    expect(forecast.budgetLimitPaise).toBe('3000000');
    expect(forecast.isProjectedWithinBudget).toBe(true);

    // Categories & Merchants
    expect(categories.length).toBeGreaterThan(0);
    expect(topMerchants.length).toBeGreaterThan(0);
    expect(weeklyBreakdown.length).toBeGreaterThanOrEqual(4);
  });

  it('GET /api/v1/analytics/recurring detects Netflix as a monthly subscription', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/recurring')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { activeSubscriptionsCount, subscriptions, totalMonthlyCommitmentPaise } = res.body.data;

    expect(activeSubscriptionsCount).toBeGreaterThanOrEqual(1);
    expect(BigInt(totalMonthlyCommitmentPaise)).toBeGreaterThanOrEqual(64900n);

    const netflixSub = subscriptions.find(
      (s: any) => s.merchantName.toLowerCase().includes('netflix')
    );
    expect(netflixSub).toBeDefined();
    expect(netflixSub.cadence).toBe('MONTHLY');
    expect(netflixSub.amountPaise).toBe('64900');
    expect(netflixSub.occurrencesCount).toBe(2);
    expect(netflixSub.estimatedNextDueDate).toBeDefined();
  });

  it('GET /api/v1/analytics/trends returns 6-month historical trajectory', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/trends')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { history } = res.body.data;
    expect(history.length).toBe(6);
    expect(history[5].spentPaise).toBeDefined();
  });

  it('GET /api/v1/bank-sync/providers returns supported Indian banks', async () => {
    const res = await request(app)
      .get('/api/v1/bank-sync/providers')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.institutions.length).toBeGreaterThanOrEqual(5);

    const hdfc = res.body.data.institutions.find((b: any) => b.name === 'HDFC Bank');
    expect(hdfc).toBeDefined();
    expect(hdfc.supportedVia).toBe('ACCOUNT_AGGREGATOR');
  });

  it('GET /api/v1/bank-sync/status returns provider integration status', async () => {
    const res = await request(app)
      .get('/api/v1/bank-sync/status')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.providerName).toContain('Account Aggregator');
    expect(res.body.data.supportedInstitutions).toBeDefined();
  });

  it('Enforces cross-user isolation: User B cannot see User A subscriptions or insights', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/recurring')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.activeSubscriptionsCount).toBe(0);
    expect(res.body.data.subscriptions.length).toBe(0);

    const overviewRes = await request(app)
      .get('/api/v1/analytics/overview')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(overviewRes.status).toBe(200);
    expect(overviewRes.body.data.summary.currentMonthSpentPaise).toBe('0');
  });
});
