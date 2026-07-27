import { db } from "../src/db";

// Resolves a tag name to a connect-ref, reusing an existing row instead of nested
// `create` — nested create would throw on Tag.name's unique constraint if this script
// is re-run against a non-empty DB (see tickets/tags/refiner-notes.md, round 1, note 5).
async function tagConnection(name: string) {
  const tag = await db.tag.upsert({
    where: { name },
    update: {},
    create: { name },
  });
  return { id: tag.id };
}

async function main() {
  const [urgent, home] = await Promise.all([tagConnection("urgent"), tagConnection("home")]);

  await db.entry.create({
    data: {
      kind: "task",
      title: "Buy milk",
      dueDate: new Date(),
      tags: { connect: [home] },
    },
  });
  await db.entry.create({
    data: {
      kind: "task",
      title: "Write scaffold ticket notes",
      tags: { connect: [urgent] },
    },
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
