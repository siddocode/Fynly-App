# Fynly — Bank Integration Architecture & Provider Specification

## 1. Overview & Regulatory Compliance

In accordance with RBI (Reserve Bank of India) regulations and industry security standards:
- **No Credentials Storage**: Fynly **never** asks for, receives, or stores bank login credentials, net banking passwords, ATM PINs, or banking OTPs.
- **Authorized Open Banking / Account Aggregator Framework**: Real-time automated bank data synchronization in India is performed strictly through the **RBI-regulated Account Aggregator (AA) ecosystem**.
- **User-Centric Consent**: Bank data cannot be accessed without explicit, granular, time-bound, and revocable consent initiated by the user.

---

## 2. The Account Aggregator (AA) Architecture

```mermaid
sequenceDiagram
    autonumber
    actor User as User (Fynly Mobile App)
    participant Fynly as Fynly Backend (FIU)
    participant Setu as Account Aggregator Gateway (e.g. Setu / OneMoney)
    participant AA as RBI Licensed AA (Anumati / Finvu)
    participant FIP as Bank / Financial Information Provider (HDFC, ICICI, SBI)

    User->>Fynly: Request Link Bank Account (Phone/VPA)
    Fynly->>Setu: Create Consent Request (Data types: Transactions, Balances; Date range)
    Setu->>AA: Forward Consent Request
    AA-->>User: Push Notification / SMS with Consent Webview URL
    User->>AA: Authenticate with AA OTP & Select Accounts
    AA->>FIP: Fetch Encrypted Financial Information (FIDC)
    FIP-->>AA: Return ECDH-encrypted Data
    AA-->>Setu: Forward Encrypted Data Packet
    Setu-->>Fynly: Deliver Webhook Notification (Consent Approved)
    Fynly->>Setu: Fetch Encrypted FI (Decrypted using Fynly's Private Key)
    Fynly->>Fynly: Normalise Transactions into Integer Paise & Deduplicate via sha256
    Fynly-->>User: Bank Synchronized & Balances Updated
```

### Key Entities
1. **Financial Information User (FIU)**: Fynly is registered as an FIU.
2. **Account Aggregator (AA)**: Licensed intermediaries (e.g., Setu AA, OneMoney, Anumati, Finvu) facilitating encrypted consent and data exchange.
3. **Financial Information Provider (FIP)**: Scheduled commercial banks and depository institutions holding user accounts.

---

## 3. Data Encryption & Security Standards

1. **End-to-End Encryption (E2EE)**:
   - Data in transit between FIP and FIU is encrypted using **ECDH (Elliptic-curve Diffie–Hellman)** key agreement with Curve25519 and **AES-GCM-256**.
   - The AA intermediary cannot read or tamper with the financial payload.
2. **Deterministic Deduplication**:
   - Each transaction synced from the bank feed is normalized and run through Fynly's fingerprint generator:
     ```typescript
     fingerprintHash = sha256(`${userId}-${accountId}-${date}-${amountPaise}-${normalizedMerchant}`);
     ```
   - If an existing transaction has the same fingerprint, it is updated (e.g., status changed from `PENDING` to `SETTLED`) without creating duplicates.
3. **Fallback & Parity**:
   - When bank sync is pending approval, expired, or disconnected, the app seamlessly allows statement import (CSV) and manual tracking without data interruption.

---

## 4. Supported Financial Institutions (Initial Scope)

| Institution Name | FIP Code | AA Support | Status |
|---|---|---|---|
| HDFC Bank | HDFC-FIP | Yes (Live on AA) | Sandbox Ready / AA Standard |
| ICICI Bank | ICICI-FIP | Yes (Live on AA) | Sandbox Ready / AA Standard |
| State Bank of India | SBI-FIP | Yes (Live on AA) | Sandbox Ready / AA Standard |
| Axis Bank | AXIS-FIP | Yes (Live on AA) | Sandbox Ready / AA Standard |
| Kotak Mahindra Bank | KOTAK-FIP | Yes (Live on AA) | Sandbox Ready / AA Standard |
