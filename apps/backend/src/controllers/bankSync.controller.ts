import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { BankProviderService } from '../utils/bankProvider.js';

/**
 * GET /api/v1/bank-sync/providers
 * Returns supported financial institutions and Account Aggregator readiness.
 */
export const getSupportedInstitutions = async (
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const institutions = BankProviderService.getInstitutions();
    res.status(200).json({
      success: true,
      data: {
        institutions,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/bank-sync/status
 * Returns current banking integration status and capabilities.
 */
export const getBankSyncStatus = async (
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const status = BankProviderService.getIntegrationStatus();
    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
};
