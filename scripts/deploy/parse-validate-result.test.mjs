import { test } from "node:test";
import assert from "node:assert/strict";
import { parseValidation, renderErrorsMarkdown } from "./parse-validate-result.mjs";

const SUCCESS = {
  status: 0,
  result: {
    success: true,
    id: "0AfKa00000TESTID",
    details: {
      runTestResult: {
        numTestsRun: "12",
        numFailures: "0",
        codeCoverage: [
          { name: "DiscountService", numLocations: "100", numLocationsNotCovered: "10" },
          { name: "CaseRouter", numLocations: "50", numLocationsNotCovered: "25" },
        ],
        failures: [],
      },
    },
  },
};

const FAILURE = {
  status: 1,
  result: {
    success: false,
    id: "0AfKa00000FAILID",
    details: {
      componentFailures: [
        {
          fullName: "DiscountService",
          componentType: "ApexClass",
          problem: "Method does not exist: applyDiscnt",
          lineNumber: 42,
        },
      ],
      runTestResult: {
        numTestsRun: "12",
        numFailures: "1",
        failures: [{ name: "DiscountServiceTest", methodName: "testApply", message: "Assertion failed" }],
      },
    },
  },
};

test("parses successful validation with coverage", () => {
  const p = parseValidation(SUCCESS);
  assert.equal(p.succeeded, true);
  assert.equal(p.validationId, "0AfKa00000TESTID");
  assert.equal(p.overallCoverage, 76.7); // 150 locations, 35 uncovered
  assert.equal(p.coverage.find((c) => c.name === "CaseRouter").percent, 50);
});

test("parses failure with component errors and test failures", () => {
  const p = parseValidation(FAILURE);
  assert.equal(p.succeeded, false);
  assert.equal(p.failures.length, 1);
  assert.equal(p.testsFailed, 1);
  const md = renderErrorsMarkdown(p);
  assert.match(md, /Method does not exist: applyDiscnt/);
  assert.match(md, /DiscountServiceTest\.testApply/);
});

test("no tests → overall coverage null", () => {
  const p = parseValidation({ status: 0, result: { success: true, id: "x", details: {} } });
  assert.equal(p.overallCoverage, null);
  assert.equal(p.testsRan, 0);
});
