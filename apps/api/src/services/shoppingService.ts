import { DomainError, type ShoppingCapabilityDto, type ShoppingProductDto, type ShoppingProvider } from "@homeflow/shared";

const CAPABILITIES: ShoppingCapabilityDto[] = [
  {
    provider: "blinkit",
    displayName: "Blinkit",
    mode: "manual_handoff",
    productSearch: false,
    livePrices: false,
    availability: false,
    cartPreparation: false,
    checkoutHandoff: true,
    orderPlacement: false,
    orderStatus: false,
    limitation: "No public documented consumer API was verified. Search, price, stock, cart, and checkout must be completed on Blinkit.",
    checkoutUrl: "https://blinkit.com/",
  },
  {
    provider: "zepto",
    displayName: "Zepto",
    mode: "manual_handoff",
    productSearch: false,
    livePrices: false,
    availability: false,
    cartPreparation: false,
    checkoutHandoff: true,
    orderPlacement: false,
    orderStatus: false,
    limitation: "No public documented consumer API was verified. Search, price, stock, cart, and checkout must be completed on Zepto.",
    checkoutUrl: "https://www.zeptonow.com/",
  },
  {
    provider: "swiggy_instamart",
    displayName: "Swiggy Instamart",
    mode: "manual_handoff",
    productSearch: false,
    livePrices: false,
    availability: false,
    cartPreparation: false,
    checkoutHandoff: true,
    orderPlacement: false,
    orderStatus: false,
    limitation: "Official MCP access exists for approved integrations, but no credentials are configured in this deployment.",
    checkoutUrl: "https://www.swiggy.com/instamart",
  },
  {
    provider: "ondc",
    displayName: "ONDC",
    mode: "manual_handoff",
    productSearch: false,
    livePrices: false,
    availability: false,
    cartPreparation: false,
    checkoutHandoff: true,
    orderPlacement: false,
    orderStatus: false,
    limitation: "ONDC requires an authorized Buyer Network Participant and signed production onboarding; none is configured.",
    checkoutUrl: "https://www.ondc.org/",
  },
  {
    provider: "manual",
    displayName: "Manual checkout",
    mode: "manual_handoff",
    productSearch: false,
    livePrices: false,
    availability: false,
    cartPreparation: true,
    checkoutHandoff: true,
    orderPlacement: false,
    orderStatus: false,
    limitation: "HomeFlow prepares a checklist only. Prices, stock, fees, payment, and order status must be confirmed by you.",
    checkoutUrl: null,
  },
];

export function shoppingCapabilities(): ShoppingCapabilityDto[] {
  return CAPABILITIES.map((capability) => ({ ...capability }));
}

export function shoppingCapability(provider: ShoppingProvider): ShoppingCapabilityDto {
  const capability = CAPABILITIES.find((item) => item.provider === provider);
  if (!capability) throw new DomainError("VALIDATION_ERROR", `Unsupported shopping provider: ${provider}.`);
  return { ...capability };
}

export function searchShoppingProducts(provider: ShoppingProvider, query: string): {
  provider: ShoppingCapabilityDto;
  products: ShoppingProductDto[];
  message: string;
} {
  const capability = shoppingCapability(provider);
  return {
    provider: capability,
    products: [],
    message: query.trim()
      ? `${capability.displayName} product search is not configured. Use the official site to verify "${query.trim()}" and current prices.`
      : "Enter a product name to search.",
  };
}

export function checkoutHandoffUrl(provider: ShoppingProvider, fallback: string | null): string | null {
  return shoppingCapability(provider).checkoutUrl ?? fallback;
}
