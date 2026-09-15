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
  const { count } = await prisma.notification.updateMany({
    where: { id: req.params.id, recipientId: req.user.id },
    data: { isRead: true },
  });

  if (!count) return res.status(404).json({ success: false, message: "Notification not found" });

  return res.json({ success: true, data: { id: req.params.id, isRead: true } });
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
