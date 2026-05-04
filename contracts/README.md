# NetPulse Intelligent Contract — Deployment Guide

This contract validates crowdsourced internet speed-test submissions and
computes a consensus-based **NetPulse Score (0–100)** per area on the
**GenLayer Bradbury Testnet** (Chain ID `4221`).

## Prerequisites

1. **Node.js 18+** and **Python 3.11+**
2. **GenLayer CLI**
   ```bash
   pip install genlayer-cli
   ```
3. **Bradbury testnet GEN** — get from the faucet:
   <https://testnet-faucet.genlayer.foundation/>

## Configure the network

```bash
genlayer network testnet-bradbury
```

## Deploy

From the project root:

```bash
genlayer deploy --contract contracts/net_pulse.py
```

The CLI will print the deployed contract address. Copy it.

## Wire the address into the app

Add the address as a server runtime secret named `GENLAYER_CONTRACT_ADDRESS`.
The Lovable assistant can request this for you, or you can set it yourself
through the Cloud → Secrets panel.

The app's server functions will:
- call `submit_test` when a user submits a speed test
- call `get_area_score` / `get_area_stats` to read consensus state

If `GENLAYER_CONTRACT_ADDRESS` is not set, `/api/submit-test` will fall back
to a **local validator** that mirrors the contract's logic so the app keeps
working in development.

## Network details

| Field | Value |
|---|---|
| GenLayer RPC | `https://rpc-bradbury.genlayer.com` |
| Chain ID | `4221` |
| Native token | `GEN` |
| Explorer | <https://explorer-bradbury.genlayer.com> |