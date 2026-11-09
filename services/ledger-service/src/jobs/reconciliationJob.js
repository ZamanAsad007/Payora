import { ReconciliationService } from "../services/reconciliationService.js";
import { logger } from "../utils/logger.js";

/**
 * Scheduled reconciliation job runner.
 * Can be run periodically (e.g. nightly or hourly) or on application startup.
 */
export class ReconciliationJob {
  constructor(reconciliationService = new ReconciliationService(), intervalMs = 60 * 60 * 1000) {
    this.reconciliationService = reconciliationService;
    this.intervalMs = intervalMs;
    this.timer = null;
    this.isRunning = false;
  }

  start() {
    if (this.timer) return;
    logger.info({ intervalMs: this.intervalMs }, "[ReconciliationJob] Starting scheduled job");
    this.timer = setInterval(async () => {
      await this.runOnce();
    }, this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info("[ReconciliationJob] Stopped scheduled job");
    }
  }

  async runOnce() {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      logger.info("[ReconciliationJob] Executing automated ledger verification...");
      const report = await this.reconciliationService.runReconciliation();
      logger.info(
        { status: report.status, discrepancyCount: report.discrepancy_accounts },
        "[ReconciliationJob] Run complete"
      );
      return report;
    } catch (err) {
      logger.error({ err }, "[ReconciliationJob] Failed to execute reconciliation");
      throw err;
    } finally {
      this.isRunning = false;
    }
  }
}
