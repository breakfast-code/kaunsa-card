/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accounts from "../accounts.js";
import type * as admin from "../admin.js";
import type * as cardRequests from "../cardRequests.js";
import type * as privateRedemptionAdmin from "../privateRedemptionAdmin.js";
import type * as privateRouteAdmin from "../privateRouteAdmin.js";
import type * as privateRuleAdmin from "../privateRuleAdmin.js";
import type * as recommendationEngine from "../recommendationEngine.js";
import type * as recommendationFeedback from "../recommendationFeedback.js";
import type * as recommendations from "../recommendations.js";
import type * as redemptionEngine from "../redemptionEngine.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accounts: typeof accounts;
  admin: typeof admin;
  cardRequests: typeof cardRequests;
  privateRedemptionAdmin: typeof privateRedemptionAdmin;
  privateRouteAdmin: typeof privateRouteAdmin;
  privateRuleAdmin: typeof privateRuleAdmin;
  recommendationEngine: typeof recommendationEngine;
  recommendationFeedback: typeof recommendationFeedback;
  recommendations: typeof recommendations;
  redemptionEngine: typeof redemptionEngine;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
