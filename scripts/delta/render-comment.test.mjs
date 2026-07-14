import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePackageXml, renderMarkdown, STICKY_MARKER } from "./render-comment.mjs";

const PACKAGE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>BUP_Clinic__c.BUP_Account__c</members>
        <name>CustomField</name>
    </types>
    <types>
        <members>DiscountService</members>
        <members>DiscountServiceTest</members>
        <name>ApexClass</name>
    </types>
    <version>64.0</version>
</Package>`;

const DESTRUCTIVE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>Old_Field__c.Legacy__c</members>
        <name>CustomField</name>
    </types>
</Package>`;

test("parses package.xml into type map", () => {
  const parsed = parsePackageXml(PACKAGE_XML);
  assert.deepEqual(parsed.ApexClass, ["DiscountService", "DiscountServiceTest"]);
  assert.deepEqual(parsed.CustomField, ["BUP_Clinic__c.BUP_Account__c"]);
});

test("renders grouped markdown with counts and marker", () => {
  const { markdown, changedCount, destructiveCount } = renderMarkdown(
    parsePackageXml(PACKAGE_XML),
    parsePackageXml(DESTRUCTIVE_XML)
  );
  assert.equal(changedCount, 3);
  assert.equal(destructiveCount, 1);
  assert.ok(markdown.startsWith(STICKY_MARKER));
  assert.match(markdown, /\*\*3\*\* components to deploy, \*\*1\*\* to delete/);
  assert.match(markdown, /### 🗑 Deletions/);
  assert.match(markdown, /~~Old_Field__c\.Legacy__c~~/);
});

test("empty delta renders the no-changes message", () => {
  const { markdown, changedCount } = renderMarkdown({}, {});
  assert.equal(changedCount, 0);
  assert.match(markdown, /No deployable metadata changes/);
});
