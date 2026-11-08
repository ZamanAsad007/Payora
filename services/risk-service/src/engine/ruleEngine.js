/**
 * Pure Rule Engine for financial fraud and risk detection.
 */
export class RuleEngine {
  constructor({ rules = null, historyTracker = new Map() } = {}) {
    this.historyTracker = historyTracker; // userId -> array of timestamps
    this.knownPayees = new Map(); // userId -> Set of payeeIds/phones
    this.rules = rules || [
      {
        code: "VELOCITY_SPIKE",
        name: "High Velocity Spike",
        active: true,
        config: { maxCount: 5, windowSeconds: 120, severity: "HIGH" },
      },
      {
        code: "LARGE_AMOUNT",
        name: "Unusually Large Amount",
        active: true,
        config: { thresholdPoisha: 2000000n, severity: "MEDIUM" }, // 20,000 BDT
      },
      {
        code: "NEW_PAYEE",
        name: "First-Time Payee High Value",
        active: true,
        config: { thresholdPoisha: 500000n, severity: "MEDIUM" }, // 5,000 BDT
      },
      {
        code: "NEW_DEVICE",
        name: "Untrusted Device",
        active: true,
        config: { severity: "LOW" },
      },
    ];
  }

  /**
   * Evaluate a transaction event against risk rules.
   *
   * @param {object} event
   * @param {string} event.type
   * @param {string} event.userId
   * @param {bigint|number|string} event.amount
   * @param {string} [event.payeeId]
   * @param {boolean} [event.isNewPayee]
   * @param {boolean} [event.isNewDevice]
   * @param {number} [event.timestamp]
   * @returns {Array<object>} list of triggered violations
   */
  evaluate(event) {
    const violations = [];
    const userId = event.userId || event.senderUserId || event.customerUserId;
    const amount = BigInt(event.amount || 0);
    const now = event.timestamp ? new Date(event.timestamp).getTime() : Date.now();

    for (const rule of this.rules) {
      if (!rule.active) continue;

      switch (rule.code) {
        case "VELOCITY_SPIKE": {
          const windowMs = (rule.config.windowSeconds || 120) * 1000;
          const maxCount = rule.config.maxCount || 5;

          const history = this.historyTracker.get(userId) || [];
          const recent = history.filter((t) => now - t <= windowMs);
          recent.push(now);
          this.historyTracker.set(userId, recent);

          if (recent.length > maxCount) {
            violations.push({
              ruleCode: "VELOCITY_SPIKE",
              severity: rule.config.severity || "HIGH",
              metadata: {
                transfersInWindow: recent.length,
                maxAllowed: maxCount,
                windowSeconds: rule.config.windowSeconds || 120,
              },
            });
          }
          break;
        }

        case "LARGE_AMOUNT": {
          const threshold = BigInt(rule.config.thresholdPoisha || 2000000n);
          if (amount >= threshold) {
            violations.push({
              ruleCode: "LARGE_AMOUNT",
              severity: rule.config.severity || "MEDIUM",
              metadata: {
                amountPoisha: amount.toString(),
                thresholdPoisha: threshold.toString(),
              },
            });
          }
          break;
        }

        case "NEW_PAYEE": {
          const threshold = BigInt(rule.config.thresholdPoisha || 500000n);
          const payee = event.payeeId || event.receiverAccountId || event.receiverPhone;

          if (payee) {
            const userPayees = this.knownPayees.get(userId) || new Set();
            const isKnown = userPayees.has(payee);
            const isNew = event.isNewPayee || !isKnown;

            if (isNew && amount >= threshold) {
              violations.push({
                ruleCode: "NEW_PAYEE",
                severity: rule.config.severity || "MEDIUM",
                metadata: {
                  payee,
                  amountPoisha: amount.toString(),
                  thresholdPoisha: threshold.toString(),
                },
              });
            }

            // Register payee as known
            userPayees.add(payee);
            this.knownPayees.set(userId, userPayees);
          }
          break;
        }

        case "NEW_DEVICE": {
          if (event.isNewDevice || event.trustedDevice === false) {
            violations.push({
              ruleCode: "NEW_DEVICE",
              severity: rule.config.severity || "LOW",
              metadata: {
                deviceId: event.deviceId || "unknown",
                trusted: false,
              },
            });
          }
          break;
        }
      }
    }

    return violations;
  }
}
