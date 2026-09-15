const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const { signToken } = require("../utils/jwt");
const { formatApiResponse } = require("../utils/helpers");
const { MODERATOR_TOKEN_THRESHOLD } = require("../config/constants");

const prisma = new PrismaClient();
const SESSION_COOKIE = "debate_session";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const setSessionCookie = (res, token) => {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
  });
};

const register = async (req, res, next) => {
  try {
    const { username, displayName, email, password, confirmPassword } =
      req.body;

    if (!username || !displayName || !email || !password || !confirmPassword) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    if (password !== confirmPassword) {
      return res
        .status(400)
        .json({ success: false, message: "Passwords do not match" });
    }

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (existingUser) {
      return res
        .status(409)
        .json({ success: false, message: "Email or username already in use" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        username: username.trim(),
        displayName: displayName.trim(),
        email: email.trim().toLowerCase(),
        passwordHash,
      },
    });

    const token = signToken(user.id);
    setSessionCookie(res, token);

    return res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          email: user.email,
          role: user.role,
          activityTokens: user.activityTokens,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { emailOrUsername, password } = req.body;

    if (!emailOrUsername || !password) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Email/username and password are required",
        });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: emailOrUsername.toLowerCase() },
          { username: emailOrUsername },
        ],
      },
    });

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const token = signToken(user.id);
    setSessionCookie(res, token);

    return res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          email: user.email,
          role: user.role,
          activityTokens: user.activityTokens,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res) => {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return res.json({
    success: true,
    data: { message: "Logged out successfully" },
  });
};

const getCurrentUser = async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: {
      topics: true,
      comments: true,
    },
  });

  return res.json({
    success: true,
    data: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      bio: user.bio,
      avatar: user.avatar,
      role: user.role,
      activityTokens: user.activityTokens,
      createdAt: user.createdAt,
      topicCount: user.topics.length,
      commentCount: user.comments.length,
      moderatorEligible: user.activityTokens >= MODERATOR_TOKEN_THRESHOLD,
    },
  });
};

module.exports = { register, login, logout, getCurrentUser };
