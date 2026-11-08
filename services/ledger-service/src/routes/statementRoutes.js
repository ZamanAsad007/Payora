import { Router } from "express";
import { StatementService } from "../services/statementService.js";

export function createStatementRouter({ statementService = new StatementService() } = {}) {
  const router = Router();

  // GET /api/statements?from=&to=&format=pdf|csv|json
  router.get("/", async (req, res, next) => {
    try {
      const userId = req.headers["x-user-id"] || req.query.userId;
      if (!userId) {
        return res.status(400).json({
          success: false,
          data: null,
          error: { code: "MISSING_USER_ID", message: "x-user-id header or userId query required" },
        });
      }

      const { from, to, format = "csv" } = req.query;
      const data = await statementService.getStatementData({ userId, from, to });

      const dateStr = new Date().toISOString().split("T")[0];

      if (format.toLowerCase() === "pdf") {
        const pdfBuffer = await statementService.exportPdf(data);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="payora-statement-${dateStr}.pdf"`
        );
        return res.status(200).send(pdfBuffer);
      }

      if (format.toLowerCase() === "json") {
        return res.status(200).json({
          success: true,
          data,
          error: null,
        });
      }

      // Default CSV
      const csvString = await statementService.exportCsv(data);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="payora-statement-${dateStr}.csv"`
      );
      return res.status(200).send(csvString);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
