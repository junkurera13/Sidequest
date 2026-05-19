# iMessage Agent Deploy

Sidequest's web app can stay on Vercel. The iMessage agent is different: it is a long-running listener, so deploy it as a worker process on Railway.

## Runtime command

```bash
npm run imessage:agent
```

Railway reads `railway.json` and starts the worker with that command.

## Required Railway variables

Set these on the Railway service:

```bash
NEXT_PUBLIC_CONVEX_URL=<your Convex URL>
PHOTON_PROJECT_ID=<your Photon project id>
PHOTON_PROJECT_SECRET=<your Photon project secret>
SIDEQUEST_PUBLIC_BASE_URL=https://sdqst.fun
```

The Anthropic key stays in Convex env vars because Claude calls happen inside Convex actions.

## Deploy flow

```bash
npx @railway/cli login
npx @railway/cli init
npx @railway/cli variable set NEXT_PUBLIC_CONVEX_URL=...
npx @railway/cli variable set PHOTON_PROJECT_ID=...
npx @railway/cli variable set PHOTON_PROJECT_SECRET=...
npx @railway/cli variable set SIDEQUEST_PUBLIC_BASE_URL=https://sdqst.fun
npx @railway/cli up
```

After deploy, watch logs:

```bash
npx @railway/cli logs
```

Expected first healthy log:

```text
sidequest agent listening.
```
