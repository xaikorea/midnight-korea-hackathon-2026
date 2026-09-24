FROM node:24.11.1-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl unzip && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY contracts/package.json contracts/package-lock.json ./contracts/
RUN npm ci --prefix contracts --no-audit --no-fund
COPY contracts ./contracts
COPY scripts/compile-contract.sh ./scripts/compile-contract.sh
RUN bash scripts/compile-contract.sh && node --test contracts/test.mjs contracts/request-runner.test.mjs contracts/sdk/sdk.test.mjs contracts/sdk/wallet-adapter.test.mjs contracts/sdk/web-source.test.mjs
CMD ["node", "contracts/sdk/run-devnet.ts", "outputs/midnight-devnet"]
