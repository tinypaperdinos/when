import { db } from "../src/db";

async function main() {
  await db.entry.createMany({
    data: [
      { kind: "task", title: "Buy milk", dueDate: new Date() },
      { kind: "task", title: "Write scaffold ticket notes" },
    ],
  });
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
