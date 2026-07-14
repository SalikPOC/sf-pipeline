import { test } from "node:test";
import assert from "node:assert/strict";
import { StubAdapter, adapterFor } from "./adapter.mjs";

test("stub validates any well-formed id and echoes work items", async () => {
  const stub = new StubAdapter(() => {});
  assert.deepEqual(await stub.validateId("PROJ-123"), { exists: true, url: null });
  const wi = await stub.getWorkItem("AB#456");
  assert.equal(wi.type, "ado");
  assert.equal(wi.title, "(tracker not connected)");
});

test("postDeploymentStatus records entries with tracker classification", async () => {
  const stub = new StubAdapter(() => {});
  const info = { env: "integration", seq: 2, status: "deployed", runUrl: "https://r", actor: "a", timestamp: "t" };
  await stub.postDeploymentStatus("POC-1", info);
  await stub.postDeploymentStatus("AB#9", info);
  assert.equal(stub.recorded.length, 2);
  assert.equal(stub.recorded[0].tracker, "jira");
  assert.equal(stub.recorded[1].tracker, "ado");
  assert.equal(stub.recorded[0].status, "deployed");
});

test("router returns the stub for any id (PoC)", () => {
  const stub = new StubAdapter(() => {});
  assert.equal(adapterFor("PROJ-1", stub), stub);
  assert.equal(adapterFor("AB#2", stub), stub);
});
