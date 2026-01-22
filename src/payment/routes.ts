import type { RoutesConfig } from "@x402/core/http";
import type { Network } from "@x402/core/types";

import type { Restriction } from "../restrictions";
import type { PaymentMethod } from "../payment-methods";

function priceToAmount(priceUsd: number, decimals: number): string {
  const amount = priceUsd * Math.pow(10, decimals);
  return Math.round(amount).toString();
}

export function buildRoutesConfig(
  restrictions: Restriction[],
  paymentMethods: PaymentMethod[]
): RoutesConfig {
  const routesConfig: RoutesConfig = {};

  for (const restriction of restrictions) {
    routesConfig[restriction.path] = {
      accepts: paymentMethods.map((paymentMethod) => ({
        scheme: restriction.scheme,
        price: {
          amount: priceToAmount(restriction.price, paymentMethod.decimals),
          asset: paymentMethod.contract_address,
          // eip712 required extra
          extra: {
            ...paymentMethod.extra,
            decimals: paymentMethod.decimals,
            chainDisplayName: paymentMethod.chain_display_name,
            assetDisplayName: paymentMethod.asset_display_name,
            price: restriction.price,
          },
        },
        network: paymentMethod.caip2_id as Network,
        payTo: paymentMethod.circle_wallet_address,
      })),
      description: restriction.description,
      mimeType: "application/json",
    };
  }

  return routesConfig;
}
