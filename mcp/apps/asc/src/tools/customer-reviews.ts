import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import {
  type AscClientProvider,
  type AscDocument,
  pageInfo,
  related,
} from "../asc/client.ts";
import { appIdSchema, keyIdSchema, limitSchema } from "../schemas/common.ts";
import { toToolError } from "../utils/errors.ts";

interface ReviewAttributes {
  rating?: number;
  title?: string;
  body?: string;
  reviewerNickname?: string;
  createdDate?: string;
  territory?: string;
}

interface ResponseAttributes {
  responseBody?: string;
  state?: string;
  lastModifiedDate?: string;
}

const inputSchema = z.object({
  app_id: appIdSchema,
  rating: z
    .array(z.number().int().min(1).max(5))
    .min(1)
    .max(5)
    .optional()
    .describe("Only reviews with these star ratings, such as [1, 2]."),
  territory: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/, "Must be an ISO 3166-1 alpha-3 code such as USA.")
    .optional()
    .describe(
      "Only reviews from this App Store territory (alpha-3, such as USA, GBR, SGP).",
    ),
  has_response: z
    .boolean()
    .optional()
    .describe(
      "true for reviews with a published developer response, false for those without.",
    ),
  sort: z
    .enum(["-createdDate", "createdDate", "-rating", "rating"])
    .default("-createdDate")
    .describe(
      "Sort order; a leading - sorts descending (default newest first).",
    ),
  limit: limitSchema,
  key_id: keyIdSchema,
});

export function registerCustomerReviewsTool(
  server: McpServer,
  getClient: AscClientProvider,
): void {
  server.registerTool(
    "customer_reviews",
    {
      title: "List customer reviews",
      description:
        "App Store customer reviews of an app: rating, title, body, reviewer nickname, date, territory and your " +
        "developer response if any. Filter by star rating, territory and whether a response exists.",
      inputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (input) => {
      try {
        const client = await getClient(input.key_id);
        const response = await client.get<AscDocument<ReviewAttributes>>(
          `/v1/apps/${input.app_id}/customerReviews`,
          {
            "filter[rating]": input.rating?.map(String),
            "filter[territory]": input.territory,
            "exists[publishedResponse]": input.has_response,
            sort: input.sort,
            include: "response",
            "fields[customerReviews]": [
              "rating",
              "title",
              "body",
              "reviewerNickname",
              "createdDate",
              "territory",
              "response",
            ],
            "fields[customerReviewResponses]": [
              "responseBody",
              "state",
              "lastModifiedDate",
            ],
            limit: input.limit,
          },
        );
        const result = {
          reviews: response.data.map((review) => {
            const reply = related<ResponseAttributes>(
              response,
              review,
              "response",
            );
            return {
              id: review.id,
              rating: review.attributes?.rating,
              title: review.attributes?.title,
              body: review.attributes?.body,
              reviewerNickname: review.attributes?.reviewerNickname,
              createdDate: review.attributes?.createdDate,
              territory: review.attributes?.territory,
              response: reply && {
                responseBody: reply.responseBody,
                state: reply.state,
                lastModifiedDate: reply.lastModifiedDate,
              },
            };
          }),
          ...pageInfo(response),
        };
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return toToolError("customer_reviews", error);
      }
    },
  );
}
