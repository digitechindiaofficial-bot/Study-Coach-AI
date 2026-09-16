import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

// Exercise the real route handlers without network calls, charges, or DB writes.
const bundled = await build({
  entryPoints: [new URL("./src/routes/payment.ts", import.meta.url).pathname],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  plugins: [{
    name: "payment-test-dependencies",
    setup(builder) {
      builder.onResolve({ filter: /^(express|@clerk\/express|@workspace\/db|drizzle-orm|crypto|razorpay)$|\/logger$/ },
        ({ path }) => ({ path, namespace: "mock" }));
      builder.onLoad({ filter: /.*/, namespace: "mock" }, ({ path }) => {
        const modules = {
          express: `export const Router=()=>({post:(path,handler)=>globalThis.paymentTest.routes.set(path,handler)});`,
          "@clerk/express": `export const getAuth=()=>({userId:"buyer"});`,
          "@workspace/db": `export const profilesTable={clerkUserId:"clerkUserId"};
            export const pool={query:async()=>{throw Error("No local payment table")}};
            export const db={update:()=>({set:(value)=>({where:async()=>{globalThis.paymentTest.updated=value}})})};`,
          "drizzle-orm": `export const eq=()=>true;`,
          crypto: `export default {createHmac:()=>({update:()=>({digest:()=>"test-signature"})})};`,
          razorpay: `export default class {
            orders={
              create:async(value)=>{globalThis.paymentTest.order=value;return {...value,id:"order-test"}},
              fetch:async()=>globalThis.paymentTest.order
            };
            payments={fetch:async()=>globalThis.paymentTest.payment};
          }`,
        };
        return { contents: modules[path] ?? `export const logger={warn:()=>{},error:()=>{}};` };
      });
    },
  }],
});
globalThis.paymentTest = { routes: new Map() };
await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);

async function request(path, body) {
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; },
    json(data) { this.data = data; return this; } };
  await globalThis.paymentTest.routes.get(path)({ body }, response);
  return response;
}

test("monthly is default and charges 3900 paise; annual charges 34800 upfront", async () => {
  for (const [body, amount, period] of [
    [{}, 3900, "monthly"],
    [{ billingPeriod: "monthly" }, 3900, "monthly"],
    [{ billingPeriod: "yearly" }, 34800, "yearly"],
  ]) {
    const response = await request("/payment/create-order", body);
    assert.equal(response.data.amount, amount);
    assert.equal(globalThis.paymentTest.order.notes.billingPeriod, period);
    assert.equal(response.data.currency, "INR");
  }
});

test("annual purchase grants a year even without a local payments table", async () => {
  globalThis.paymentTest.order = {
    id: "order-test", amount: 34800,
    notes: { userId: "buyer", plan: "pro", billingPeriod: "yearly" },
  };
  globalThis.paymentTest.payment = {
    order_id: "order-test", status: "captured", currency: "INR", amount: 34800,
  };
  const response = await request("/payment/verify", {
    razorpay_order_id: "order-test", razorpay_payment_id: "payment-test",
    razorpay_signature: "test-signature",
  });
  assert.equal(response.statusCode, 200);
  const days = (new Date(response.data.planExpiry).getTime() - Date.now()) / 86400000;
  assert.ok(days > 364 && days < 367);
});

test("another buyer's order and uncaptured payments cannot activate Pro", async () => {
  for (const [owner, status] of [["other-buyer", "captured"], ["buyer", "authorized"]]) {
    globalThis.paymentTest.order.notes.userId = owner;
    globalThis.paymentTest.payment.status = status;
    globalThis.paymentTest.updated = null;
    const response = await request("/payment/verify", {
      razorpay_order_id: "order-test", razorpay_payment_id: "payment-test",
      razorpay_signature: "test-signature",
    });
    assert.equal(response.statusCode, 400);
    assert.equal(globalThis.paymentTest.updated, null);
  }
});