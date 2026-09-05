const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const listNotifications = async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { recipientId: req.user.id },
    orderBy: { createdAt: "desc" },
    include: { actor: true, topic: true, comment: true },
  });

  return res.json({ success: true, data: notifications });
};

const markNotificationRead = async (req, res) => {
  const notification = await prisma.notification.update({
    where: { id: req.params.id },
    data: { isRead: true },
  });

  return res.json({ success: true, data: notification });
};

const markAllNotificationsRead = async (req, res) => {
  await prisma.notification.updateMany({
    where: { recipientId: req.user.id, isRead: false },
    data: { isRead: true },
  });

  return res.json({
    success: true,
    data: { message: "All notifications marked as read" },
  });
};

module.exports = {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
