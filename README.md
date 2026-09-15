# Debate Platform

A production-style debate and discussion platform built with React, Vite, Express, Prisma, and PostgreSQL.

## Stack

- Frontend: React, Vite, React Router, Axios, Tailwind CSS
- Backend: Node.js, Express, JWT auth, bcryptjs, Helmet, rate limiting
- Database: PostgreSQL + Prisma ORM

## Features

- User authentication with JWT
- Topic creation, listing, search, and filtering
- Comment threads with nested replies
- Voting with upvote/downvote and vote switching
- Notification feed and read state
- For You recommendation feed based on categories and impact
- Profiles and moderator-ready role system
- Basic reporting and moderation endpoints

## Project structure

- `/client` – Vite React frontend
- `/server` – Express API and Prisma schema

## Quick start

1. Create `.env` from the example file.
2. Start PostgreSQL and update `DATABASE_URL`.
3. Run Prisma migration and seed:
   - `cd server`
   - `npx prisma migrate dev --name init`
   - `npm run prisma:seed`
4. Start backend:
   - `npm run dev`
5. Start frontend:
   - `cd client`
   - `npm run dev`

## Prisma

```bash
cd server
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
```

## Scripts

Backend:

```bash
cd server
npm run dev
npm test
```

Frontend:

```bash
cd client
npm run dev
npm run build
```

## Future features

- Real-time websocket notifications
- AI moderation and summarization
- ML recommendation pipeline
- Reputation and badge systems
- Follow and direct messaging
- Debate tournaments and polls
- Analytics dashboard
