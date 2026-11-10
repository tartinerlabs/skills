import { describe, expect, it } from "vitest";
import { AscApiError, CredentialsError } from "../src/utils/errors.ts";
import { createTestClient, mockClient } from "./helpers.ts";

function respond(body: unknown) {
  return mockClient(() => Promise.resolve(body as never));
}

const empty = {
  data: [],
  links: { self: "https://api.appstoreconnect.apple.com/v1/x" },
};

describe("list_apps", () => {
  it("should pass filters, sort and limit and shape each app", async () => {
    const { client, provider } = respond({
      data: [
        {
          type: "apps",
          id: "1234567890",
          attributes: {
            name: "Example",
            bundleId: "com.example.app",
            sku: "EX1",
            primaryLocale: "en-GB",
            isOrEverWasMadeForKids: false,
          },
        },
      ],
      links: {
        self: "x",
        next: "https://api.appstoreconnect.apple.com/v1/apps?cursor=AB",
      },
      meta: { paging: { total: 3, limit: 1 } },
    });
    const { callTool } = createTestClient(provider);
    const result = await callTool("list_apps", {
      bundle_id: "com.example.app",
      sort: "-name",
      limit: 1,
      key_id: "ABCDE12345",
    });
    expect(result.isError).toBe(false);
    expect(provider).toHaveBeenCalledWith("ABCDE12345");
    expect(client.get).toHaveBeenCalledWith("/v1/apps", {
      "filter[name]": undefined,
      "filter[bundleId]": "com.example.app",
      sort: "-name",
      "fields[apps]": ["name", "bundleId", "sku", "primaryLocale"],
      limit: 1,
    });
    expect(JSON.parse(result.text)).toEqual({
      apps: [
        {
          id: "1234567890",
          name: "Example",
          bundleId: "com.example.app",
          sku: "EX1",
          primaryLocale: "en-GB",
        },
      ],
      total: 3,
      hasMore: true,
    });
  });

  it("should default to sorting by name, 50 at a time, with the only key", async () => {
    const { client, provider } = respond(empty);
    const result = await createTestClient(provider).callTool("list_apps");
    expect(JSON.parse(result.text)).toEqual({ apps: [], hasMore: false });
    expect(provider).toHaveBeenCalledWith(undefined);
    expect(client.get).toHaveBeenCalledWith(
      "/v1/apps",
      expect.objectContaining({ sort: "name", limit: 50 }),
    );
  });
});

describe("app_versions", () => {
  it("should include the build, filter by state and sort newest first", async () => {
    const { client, provider } = respond({
      data: [
        {
          type: "appStoreVersions",
          id: "v1",
          attributes: {
            platform: "IOS",
            versionString: "1.0",
            appVersionState: "READY_FOR_DISTRIBUTION",
            appStoreState: "READY_FOR_SALE",
            releaseType: "MANUAL",
            earliestReleaseDate: null,
            createdDate: "2026-01-01T00:00:00.000Z",
          },
          relationships: { build: { data: { type: "builds", id: "b1" } } },
        },
        {
          type: "appStoreVersions",
          id: "v2",
          attributes: {
            platform: "IOS",
            versionString: "1.1",
            appVersionState: "IN_REVIEW",
            appStoreState: "IN_REVIEW",
            releaseType: "AFTER_APPROVAL",
            createdDate: "2026-03-01T00:00:00.000Z",
          },
          relationships: { build: { data: null } },
        },
      ],
      included: [{ type: "builds", id: "b1", attributes: { version: "42" } }],
      links: { self: "x" },
    });
    const { callTool } = createTestClient(provider);
    const result = await callTool("app_versions", {
      app_id: "1234567890",
      platform: "IOS",
      app_version_state: ["IN_REVIEW", "READY_FOR_DISTRIBUTION"],
    });
    expect(client.get).toHaveBeenCalledWith(
      "/v1/apps/1234567890/appStoreVersions",
      expect.objectContaining({
        "filter[platform]": "IOS",
        "filter[appVersionState]": ["IN_REVIEW", "READY_FOR_DISTRIBUTION"],
        include: "build",
        "fields[appStoreVersions]": expect.arrayContaining(["build"]),
        "fields[builds]": "version",
        limit: 50,
      }),
    );
    const { versions } = JSON.parse(result.text);
    expect(versions.map((v: { id: string }) => v.id)).toEqual(["v2", "v1"]);
    expect(versions[0].build).toBeUndefined();
    expect(versions[1]).toEqual({
      id: "v1",
      platform: "IOS",
      versionString: "1.0",
      appVersionState: "READY_FOR_DISTRIBUTION",
      appStoreState: "READY_FOR_SALE",
      releaseType: "MANUAL",
      earliestReleaseDate: null,
      createdDate: "2026-01-01T00:00:00.000Z",
      build: "42",
    });
  });
});

describe("list_builds", () => {
  it("should query newest uploads with the pre-release version", async () => {
    const { client, provider } = respond({
      data: [
        {
          type: "builds",
          id: "b1",
          attributes: {
            version: "42",
            uploadedDate: "2026-10-01T00:00:00.000Z",
            expirationDate: "2026-12-30T00:00:00.000Z",
            expired: false,
            minOsVersion: "17.0",
            processingState: "VALID",
            buildAudienceType: "APP_STORE_ELIGIBLE",
          },
          relationships: {
            preReleaseVersion: {
              data: { type: "preReleaseVersions", id: "p1" },
            },
          },
        },
      ],
      included: [
        {
          type: "preReleaseVersions",
          id: "p1",
          attributes: { version: "1.2.0", platform: "IOS" },
        },
      ],
      links: { self: "x" },
    });
    const { callTool } = createTestClient(provider);
    const result = await callTool("list_builds", {
      app_id: "1234567890",
      processing_state: ["VALID"],
      expired: false,
      version: "42",
      limit: 5,
    });
    expect(client.get).toHaveBeenCalledWith(
      "/v1/builds",
      expect.objectContaining({
        "filter[app]": "1234567890",
        "filter[processingState]": ["VALID"],
        "filter[expired]": false,
        "filter[version]": "42",
        sort: "-uploadedDate",
        include: "preReleaseVersion",
        "fields[builds]": expect.arrayContaining(["preReleaseVersion"]),
        "fields[preReleaseVersions]": ["version", "platform"],
        limit: 5,
      }),
    );
    expect(JSON.parse(result.text).builds).toEqual([
      {
        id: "b1",
        version: "42",
        marketingVersion: "1.2.0",
        platform: "IOS",
        processingState: "VALID",
        uploadedDate: "2026-10-01T00:00:00.000Z",
        expirationDate: "2026-12-30T00:00:00.000Z",
        expired: false,
        buildAudienceType: "APP_STORE_ELIGIBLE",
        minOsVersion: "17.0",
      },
    ]);
  });

  it("should leave the expired filter out when not given", async () => {
    const { client, provider } = respond(empty);
    await createTestClient(provider).callTool("list_builds", { app_id: "1" });
    expect(client.get).toHaveBeenCalledWith(
      "/v1/builds",
      expect.objectContaining({ "filter[expired]": undefined }),
    );
  });
});

describe("customer_reviews", () => {
  it("should filter, include the response and join it to each review", async () => {
    const { client, provider } = respond({
      data: [
        {
          type: "customerReviews",
          id: "r1",
          attributes: {
            rating: 1,
            title: "Crashes",
            body: "Crashes on launch.",
            reviewerNickname: "someone",
            createdDate: "2026-10-01T00:00:00.000Z",
            territory: "SGP",
          },
          relationships: {
            response: { data: { type: "customerReviewResponses", id: "c1" } },
          },
        },
        {
          type: "customerReviews",
          id: "r2",
          attributes: { rating: 2, territory: "SGP" },
          relationships: { response: {} },
        },
      ],
      included: [
        {
          type: "customerReviewResponses",
          id: "c1",
          attributes: {
            responseBody: "Fixed in 1.2.",
            state: "PUBLISHED",
            lastModifiedDate: "2026-10-02T00:00:00.000Z",
          },
        },
      ],
      links: { self: "x" },
    });
    const { callTool } = createTestClient(provider);
    const result = await callTool("customer_reviews", {
      app_id: "1234567890",
      rating: [1, 2],
      territory: "SGP",
      has_response: true,
      sort: "rating",
    });
    expect(client.get).toHaveBeenCalledWith(
      "/v1/apps/1234567890/customerReviews",
      expect.objectContaining({
        "filter[rating]": ["1", "2"],
        "filter[territory]": "SGP",
        "exists[publishedResponse]": true,
        sort: "rating",
        include: "response",
        "fields[customerReviews]": expect.arrayContaining(["response"]),
      }),
    );
    const { reviews } = JSON.parse(result.text);
    expect(reviews[0]).toEqual({
      id: "r1",
      rating: 1,
      title: "Crashes",
      body: "Crashes on launch.",
      reviewerNickname: "someone",
      createdDate: "2026-10-01T00:00:00.000Z",
      territory: "SGP",
      response: {
        responseBody: "Fixed in 1.2.",
        state: "PUBLISHED",
        lastModifiedDate: "2026-10-02T00:00:00.000Z",
      },
    });
    expect(reviews[1].response).toBeUndefined();
  });

  it("should sort newest first by default", async () => {
    const { client, provider } = respond(empty);
    await createTestClient(provider).callTool("customer_reviews", {
      app_id: "1",
    });
    expect(client.get).toHaveBeenCalledWith(
      "/v1/apps/1/customerReviews",
      expect.objectContaining({ sort: "-createdDate" }),
    );
  });
});

describe("tool errors", () => {
  it.each(["list_apps", "app_versions", "list_builds", "customer_reviews"])(
    "should turn an Apple error from %s into a classified tool error",
    async (tool) => {
      const { provider } = mockClient(() =>
        Promise.reject(
          new AscApiError(404, {
            errors: [
              {
                status: "404",
                code: "NOT_FOUND",
                title: "x",
                detail: "No app.",
              },
            ],
          }),
        ),
      );
      const result = await createTestClient(provider).callTool(tool, {
        app_id: "1",
      });
      expect(result.isError).toBe(true);
      expect(result.text).toMatch(/^\[not_found\]/);
    },
  );

  it("should report a missing key as an auth error", async () => {
    const { callTool } = createTestClient(() => {
      throw new CredentialsError("No App Store Connect API key is stored.");
    });
    const result = await callTool("list_apps");
    expect(result).toEqual({
      isError: true,
      text: "[auth] No App Store Connect API key is stored.",
    });
  });
});
