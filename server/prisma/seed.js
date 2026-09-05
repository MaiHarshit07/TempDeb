require("dotenv").config();

const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const categories = [
  {
    name: "Technology",
    slug: "technology",
    description: "Technology, science, and the future of work.",
  },
  {
    name: "Culture",
    slug: "culture",
    description: "Media, art, identity, and the way we live together.",
  },
  {
    name: "Policy",
    slug: "policy",
    description: "Public policy, civic life, and community decisions.",
  },
];

async function upsertTopic({ authorId, categoryId, title, description }) {
  const existing = await prisma.topic.findFirst({ where: { title } });

  if (existing) {
    return existing;
  }

  return prisma.topic.create({
    data: { authorId, categoryId, title, description },
  });
}

async function main() {
  const passwordHash = await bcrypt.hash("debate-demo-password", 12);
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@debate.local" },
    update: {},
    create: {
      username: "demo_moderator",
      displayName: "Demo Moderator",
      email: "demo@debate.local",
      passwordHash,
      role: "MODERATOR",
      activityTokens: 1200,
      bio: "A seeded account for exploring the debate platform.",
    },
  });

  const categoryRecords = {};
  for (const category of categories) {
    categoryRecords[category.slug] = await prisma.category.upsert({
      where: { slug: category.slug },
      update: category,
      create: category,
    });
  }

  const topics = [
    await upsertTopic({
      authorId: demoUser.id,
      categoryId: categoryRecords.technology.id,
      title: "Should AI assistants be open by default?",
      description:
        "Explore the tradeoffs between open models, safety controls, and public accountability.",
    }),
    await upsertTopic({
      authorId: demoUser.id,
      categoryId: categoryRecords.policy.id,
      title: "What makes online moderation legitimate?",
      description:
        "A good moderation system has to balance consistency, transparency, and room for appeal.",
    }),
  ];

  const comment = await prisma.comment.findFirst({
    where: { topicId: topics[0].id, authorId: demoUser.id },
  });

  if (!comment) {
    await prisma.comment.create({
      data: {
        topicId: topics[0].id,
        authorId: demoUser.id,
        content:
          "Start with the strongest version of the opposing view before defending your own.",
      },
    });
  }

  console.log(
    `Seeded ${Object.keys(categoryRecords).length} categories and ${topics.length} topics.`,
  );
  console.log("Demo login: demo@debate.local / debate-demo-password");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
