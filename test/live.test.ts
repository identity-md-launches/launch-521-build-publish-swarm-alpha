import assert from "node:assert/strict";
import test from "node:test";
import { refreshSnapshot } from "../src/live";
import type { Snapshot } from "../src/types";

test("Live indexes paginate completely and preserve rich evidence atomically", async (t) => {
  const originalFetch = globalThis.fetch;
  try {
    const checkedAt = "2026-09-20T00:00:00Z";
    const oldSite = {
      id: "s0",
      jobId: "j0",
      url: "https://example.com/",
      createdAt: checkedAt,
      status: "named",
      linkCheck: { status: "reachable", checkedAt },
    };
    const oldJob = {
      id: "j0",
      state: "executing",
      objective: "A complete and specific original objective.",
      originalRequest: "Full request kept.",
      nodes: [{ seat: { tokenId: "1" }, role: "implement" }],
      project: { id: "j0", head: "j0" },
      delivery: { repoUrl: "https://example.com/source" },
      createdAt: "2026-09-30T00:00:00Z",
      updatedAt: checkedAt,
    };
    const previous: Snapshot = {
      checkedAt,
      coverage: {},
      sites: [oldSite],
      jobs: [oldJob],
      workflows: [
        {
          id: "w0",
          createdAt: checkedAt,
          originalRequest: "Original workflow request",
          handoff: { chainId: 11155111 },
          validation: { checkedAt },
        },
      ],
      jobIndex: [["j0"]],
      seats: [{ tokenId: "1", checkedAt }],
    };
    const original = JSON.stringify(previous);
    const sites = Array.from({ length: 101 }, (_, i) => ({
      id: `s${i}`,
      jobId: "j0",
      status: "named",
      createdAt: checkedAt,
      url: `https://example.com/${i}`,
    }));
    const publications = sites.map((s, i) => ({
      id: `p${i}`,
      sites: [s],
      title: `Project ${i}`,
      versions: [],
    }));
    const jobs = Array.from({ length: 501 }, (_, i) => ({
      id: `j${i}`,
      state: "completed",
      template: "build-website",
      createdAt: new Date(
        Date.parse("2026-09-30T00:00:00Z") - i * 1000,
      ).toISOString(),
      updatedAt: checkedAt,
      objective: "Short…",
      originalRequest: null,
      project: null,
      delivery: null,
    }));
    let mode = "success";
    const calls: string[] = [];
    globalThis.fetch = async function (url: string, options: RequestInit) {
      assert.equal(options.credentials, "omit");
      assert.ok(options.signal);
      calls.push(url);
      const u = new URL(url);
      let body;
      if (u.pathname === "/sites")
        body = {
          count: 100,
          total: 101,
          live: 101,
          sites: sites.slice(0, 100),
        };
      else if (u.pathname.startsWith("/sites/")) {
        body = sites.find((s) => s.id === u.pathname.split("/").at(-1));
        if (mode === "bad-type" && body.id === "s100")
          body = { ...body, label: { bad: true } };
      } else if (u.pathname === "/publications") {
        const p = Number(u.searchParams.get("page"));
        body = {
          count: 101,
          page: p,
          pageSize: 100,
          totalPages: 2,
          items: publications.slice((p - 1) * 100, p * 100),
        };
      } else if (u.pathname === "/jobs") {
        const before = u.searchParams.get("before");
        let selected = before ? jobs.filter((j) => j.createdAt < before) : jobs;
        if (mode === "missing")
          selected = selected.filter((j) => j.id !== "j0");
        const page = selected.slice(0, 500);
        body = { count: page.length, jobs: page };
        if (mode === "duplicate" && before)
          body = { count: 1, jobs: [jobs[0]] };
        if (mode === "failure") throw new Error("CORS failure");
      } else if (u.pathname === "/workflows")
        body = {
          count: 1,
          workflows: [
            {
              id: "w0",
              createdAt: checkedAt,
              status: "completed",
              objective: "Workflow summary",
              contractsJobId: "j0",
            },
          ],
        };
      else throw new Error("Unknown request " + url);
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } as typeof fetch;
    const result = await refreshSnapshot(previous);
    assert.equal(result.sites.length, 101);
    assert.equal(result.jobIndex.length, 501);
    assert.equal(result.coverage.jobs.pages, 2);
    assert.equal(result.coverage.sites.pages, 2);
    assert.equal(result.jobs[0].originalRequest, "Full request kept.");
    assert.equal(result.jobs[0].objective, oldJob.objective);
    assert.deepEqual(result.jobs[0].nodes, oldJob.nodes);
    assert.equal(result.jobs[0].state, "completed");
    assert.deepEqual(result.jobs[0].project, oldJob.project);
    assert.deepEqual(result.jobs[0].delivery, oldJob.delivery);
    assert.deepEqual(result.workflows[0].handoff, { chainId: 11155111 });
    assert.deepEqual(result.workflows[0].validation, { checkedAt });
    assert.equal(
      result.workflows[0].originalRequest,
      "Original workflow request",
    );
    assert.equal(result.checkedAt, checkedAt);
    assert.ok(result.liveCheckedAt > checkedAt);
    assert.deepEqual(result.sites[0].linkCheck, oldSite.linkCheck);
    assert.deepEqual(result.seats, previous.seats);
    assert.equal(JSON.stringify(previous), original);
    for (const bad of ["failure", "missing", "duplicate", "bad-type"])
      await t.test(
        `Keeps last valid records when response is ${bad}`,
        async () => {
          mode = bad;
          await assert.rejects(refreshSnapshot(previous));
          assert.equal(JSON.stringify(previous), original);
        },
      );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
