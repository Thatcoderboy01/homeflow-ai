// FAKE DEMO DATA ONLY. Safe to re-run: uses fixed ids and upserts.
import path from "node:path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env"), quiet: true });
import { disconnectPrisma, getPrisma } from "../src/client.js";

const HOUSEHOLD_ID = "demo-household";
const daysFromNow = (d: number, hour = 18) => {
  const t = new Date();
  t.setUTCDate(t.getUTCDate() + d);
  t.setUTCHours(hour, 0, 0, 0);
  return t;
};

async function main() {
  const db = getPrisma();
  await db.household.upsert({
    where: { id: HOUSEHOLD_ID },
    update: {},
    create: {
      id: HOUSEHOLD_ID,
      name: "Demo Family (fake data)",
      timezone: "Asia/Kolkata",
      isDemo: true,
      preferences: {
        dietary: ["vegetarian"],
        hosting: "Prefers snacks and tea ready 30 minutes before guests arrive",
        shoppingDay: "Saturday",
      },
    },
  });
  for (const [id, name, role] of [
    ["demo-member-1", "Asha (demo)", "ADMIN"],
    ["demo-member-2", "Ravi (demo)", "MEMBER"],
    ["demo-member-3", "Mira (demo)", "MEMBER"],
  ] as const) {
    await db.householdMember.upsert({ where: { id }, update: {}, create: { id, householdId: HOUSEHOLD_ID, name, role } });
  }
  const tasks = [
    ["demo-task-1", "Pay electricity bill", "TODO", 2],
    ["demo-task-2", "Book plumber for kitchen tap", "TODO", 4],
    ["demo-task-3", "Water the balcony plants", "IN_PROGRESS", 1],
    ["demo-task-4", "Renew car insurance", "DONE", -3],
  ] as const;
  for (const [id, title, status, d] of tasks) {
    await db.task.upsert({ where: { id }, update: {}, create: { id, householdId: HOUSEHOLD_ID, title, status, dueDate: daysFromNow(d) } });
  }
  const groceries = [
    ["demo-g-1", "Milk", 2, "litre"],
    ["demo-g-2", "Tea leaves", 1, "pack"],
    ["demo-g-3", "Rice", 5, "kg"],
  ] as const;
  for (const [id, name, quantity, unit] of groceries) {
    await db.groceryItem.upsert({
      where: { id },
      update: {},
      create: { id, householdId: HOUSEHOLD_ID, name, normalizedName: name.toLowerCase(), quantity, unit },
    });
  }
  console.log("Seeded fake demo household:", HOUSEHOLD_ID);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(disconnectPrisma);
