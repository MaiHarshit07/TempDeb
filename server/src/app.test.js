const request = require("supertest");
const { app, prisma } = require("./app");
const { signToken } = require("./utils/jwt");

describe("API smoke checks", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns a structured 404 for unknown routes", async () => {
    const response = await request(app).get("/api/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      message: "Route not found",
    });
  });

  it("lists notifications for the authenticated user", async () => {
    const user = await prisma.user.create({
      data: {
        username: `notify-user-${Date.now()}`,
        displayName: "Notification User",
        email: `notify-${Date.now()}@example.com`,
        passwordHash: "hashed-password",
      },
    });

    await prisma.notification.create({
      data: {
        recipientId: user.id,
        type: "COMMENT_ADDED",
        isRead: false,
      },
    });

    const token = signToken(user.id);
    const response = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(
      response.body.data.some((item) => item.recipientId === user.id),
    ).toBe(true);
  }, 15000);
});
