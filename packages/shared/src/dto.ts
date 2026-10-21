import type { PrepareShoppingCartInput, ProposedAction, ShoppingProvider } from "./schemas.js";

export interface TaskDto {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";
  createdAt: string;
}

export interface GroceryItemDto {
  id: string;
  name: string;
  quantity: number;
  unit: string | null;
  notes: string | null;
  status: "NEEDED" | "PURCHASED";
  updatedAt: string;
}

export interface ShoppingCapabilityDto {
  provider: ShoppingProvider;
  displayName: string;
  mode: "manual_handoff" | "authorized_integration";
  productSearch: boolean;
  livePrices: boolean;
  availability: boolean;
  cartPreparation: boolean;
  checkoutHandoff: boolean;
  orderPlacement: boolean;
  orderStatus: boolean;
  limitation: string;
  checkoutUrl: string | null;
}

export interface ShoppingProductDto {
  provider: ShoppingProvider;
  productId: string;
  name: string;
  brand: string | null;
  variant: string | null;
  priceInr: number | null;
  priceStatus: "verified" | "unavailable" | "not_verified";
  available: boolean | null;
  productUrl: string | null;
  observedAt: string;
}

export type ShoppingCartItemDto = PrepareShoppingCartInput["items"][number] & {
  product: ShoppingProductDto | null;
};

export interface ShoppingCartDto {
  id: string;
  provider: ShoppingProvider;
  status: "PREPARED" | "HANDED_OFF" | "CANCELLED";
  location: string | null;
  budgetInr: number | null;
  subtotalInr: number | null;
  feesInr: number | null;
  totalInr: number | null;
  feesKnown: boolean;
  items: ShoppingCartItemDto[];
  handoffUrl: string | null;
  quoteObservedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HouseholdContextDto {
  household: { id: string; name: string; timezone: string; preferences: unknown; isDemo: boolean };
  members: { id: string; name: string; role: "ADMIN" | "MEMBER" }[];
  upcomingTasks: TaskDto[];
  groceryItems: GroceryItemDto[];
}

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "EXECUTED" | "FAILED";

export interface ActionResultDto {
  index: number;
  type: ProposedAction["type"];
  ok: boolean;
  message: string;
}

export interface ApprovalDto {
  id: string;
  status: ApprovalStatus;
  summary: string;
  actions: ProposedAction[];
  provider: string;
  isMock: boolean;
  expiresAt: string;
  decidedAt: string | null;
  executedAt: string | null;
  results: ActionResultDto[] | null;
}

export interface PlanResponseDto {
  conversationId: string;
  assistantMessage: string;
  provider: { name: string; isMock: boolean };
  approval: ApprovalDto | null;
}

export interface DecisionResponseDto {
  approval: ApprovalDto;
  /** false when this was a repeat submission and nothing new was executed. */
  executedNow: boolean;
}

export interface HealthDto {
  status: "ok" | "degraded";
  time: string;
  version: string;
  checks: {
    database: "up" | "down";
    mcp: "up" | "down";
  };
  ai: { provider: string; isMock: boolean };
  environment: string;
  demoBuild: true;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
