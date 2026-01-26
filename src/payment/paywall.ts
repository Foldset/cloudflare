import type { PaymentRequired } from "@x402/core/types";
import type { PaywallConfig } from "@x402/core/server";

export function generateHtml(paymentRequired: PaymentRequired, config?: PaywallConfig): string {
  const resource = paymentRequired.resource;
  const description = resource?.description ?? "This resource requires payment";
  const url = resource?.url ?? config?.currentUrl ?? "";
  const accepts = paymentRequired.accepts ?? [];

  // Group payment options by blockchain network (e.g., Base Mainnet, Solana Mainnet)
  const optionsByNetwork = new Map<string, typeof accepts>();
  for (const accept of accepts) {
    const existing = optionsByNetwork.get(accept.network) ?? [];
    existing.push(accept);
    optionsByNetwork.set(accept.network, existing);
  }

  const paymentOptionsHtml = Array.from(optionsByNetwork.entries()).map(([_network, networkOptions]) => {
    // Chain display name (e.g., "Base Mainnet", "Solana Mainnet")
    const chainDisplayName = networkOptions[0].extra?.["chainDisplayName"] as string ?? "Unknown Network";
    const chainCaip2Id = networkOptions[0].network;

    // Recipient wallet address (where payments are sent)
    const recipientAddresses = Array.from(new Set(networkOptions.map((opt) => opt.payTo)));
    const recipientAddress = recipientAddresses[0] ?? "";

    // Build list of accepted tokens for this network
    const acceptedTokensHtml = networkOptions.map((accept) => {
      // Token display name (e.g., "USD Coin", "USDC")
      const tokenDisplayName = accept.extra?.["assetDisplayName"] as string ?? "Unknown Token";
      // Token contract address (e.g., "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" for USDC on Base)
      const tokenContractAddress = accept.asset;
      // Amount in token's smallest unit (e.g., for USDC with 6 decimals: 1000000 = $1.00)
      const rawTokenAmount = accept.amount;
      const rawPrice = accept.extra?.["price"] as string ?? "Unknown Price";

      // Capitalize first letter of scheme
      const scheme =
        accept.scheme
          .toLowerCase()
          .replace(/^./, c => c.toUpperCase());

      return `
        <tr>
          <td>${tokenDisplayName}</td>
          <td>${scheme}</td>
          <td>${rawTokenAmount}</td>
          <td>${rawPrice}</td>
          <td><code>${tokenContractAddress}</code></td>
        </tr>`;
    }).join("");

    return `
    <section>
      <h3>${chainDisplayName} (${chainCaip2Id})</h3>

      <p><strong>Send payment to:</strong> <code>${recipientAddress}</code></p>

      <table border="1" cellpadding="8" cellspacing="0">
        <thead>
          <tr>
            <th>Token</th>
            <th>Scheme</th>
            <th>Amount (on-chain units)</th>
            <th>Price (USD)</th>
            <th>Contract Address</th>
          </tr>
        </thead>
        <tbody>${acceptedTokensHtml}
        </tbody>
      </table>
    </section>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html>
<head>
  <title>HTTP 402 - Payment Required</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; }
    code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
    table { border-collapse: collapse; margin: 10px 0; }
    th { background: #f5f5f5; text-align: left; }
    section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
    h3 { margin-top: 0; }
    .notice { background: #f7f7f7; border: 1px solid #e2e2e2; border-radius: 6px; padding: 10px 12px; margin: 16px 0; color: #555; font-size: 0.92em; }
    .notice strong { display: block; margin-bottom: 4px; font-weight: 600; }
    .notice p { margin: 0; }
    footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; font-size: 0.9em; color: #666; }
  </style>
</head>
<body>
  <h1>HTTP 402: Payment Required</h1>

  <p>This content requires a payment via the <a href="https://github.com/coinbase/x402">x402 protocol</a>.</p>

  <h2>Protected Resource</h2>
  <ul>
    <li><strong>URL:</strong> <code>${url}</code></li>
    <li><strong>Description:</strong> ${description}</li>
  </ul>

  <h2>Accepted Payment Options</h2>
  <p>Pay using any of the following blockchain networks and tokens:</p>
  ${paymentOptionsHtml}

  <footer>
    <p><strong>Powered by</strong> <a href="https://www.foldset.com">Foldset</a></p>
  </footer>
</body>
</html>`;
}

// Maybe just for ChatGPT and Claude we add this?
// <div class="notice">
//   <strong>Important for payment libraries</strong>
//   <p>An HTTP 200 response was returned to encourage agents to view this page. Please treat it as you would a 402 error. All required x402 headers are present. Some x402 libraries require a 402 response to initiate payment; instead of checking only the response code, check for the presence of the x402 headers.</p>
// </div>
