import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/utils/prisma.js';

describe('Authentication API', () => {
  const app = createApp();
  const testEmail = `test_${Date.now()}@fynly.test`;
  const testPassword = 'Password123!';

  afterAll(async () => {
    // Clean up test user
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    if (user) {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it('POST /api/v1/auth/register creates user, default account, categories and returns tokens', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
        name: 'Test Tester',
        currency: 'INR',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testEmail);
    expect(res.body.data.tokens).toHaveProperty('accessToken');
    expect(res.body.data.tokens).toHaveProperty('refreshToken');

    // Verify default account was created in database
    const accounts = await prisma.financialAccount.findMany({
      where: { userId: res.body.data.user.id },
    });
    expect(accounts.length).toBeGreaterThanOrEqual(1);
    expect(accounts[0].name).toBe('Primary Savings');
  });

  it('POST /api/v1/auth/register rejects duplicate email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
        name: 'Another User',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/auth/login succeeds with valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tokens).toHaveProperty('accessToken');
  });

  it('POST /api/v1/auth/login fails with invalid password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: 'WrongPassword!',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/v1/auth/me requires Bearer token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/v1/auth/me returns profile and total balance with valid token', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
      });

    const token = loginRes.body.data.tokens.accessToken;

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(testEmail);
    expect(res.body.data).toHaveProperty('totalBalancePaise');
    expect(res.body.data.accounts.length).toBeGreaterThan(0);
  });
});
