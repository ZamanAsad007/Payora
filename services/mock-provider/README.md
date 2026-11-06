# Mock Payment Provider

Simulates external bank or Mobile Financial Service (MFS) integration.

## Responsibilities
- Receives initiated top-up requests from ledger-service
- Dispatches HMAC-SHA256 signed webhook callbacks to ledger-service with timestamp tolerance
- Simulates network delays, successful top-ups, and failure responses
