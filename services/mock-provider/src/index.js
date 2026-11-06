import { createProviderApp } from "./app.js";
import { getProviderEnv } from "./config/env.js";

const env = getProviderEnv();
const app = createProviderApp();

app.listen(env.PORT, () => {
  console.log(`[Mock Provider] Running on port ${env.PORT} in ${env.NODE_ENV} mode`);
});
