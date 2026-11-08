import { createApp } from "./app.js";

const port = process.env.PORT || 3004;
const app = createApp();

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`[notification-service] Listening on port ${port}`);
  });
}
