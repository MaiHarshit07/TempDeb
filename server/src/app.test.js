const request = require("supertest");
const { app, prisma } = require("./app");

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
});
