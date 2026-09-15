"""Compute and persist personalized topic scores outside the request path."""

from collections import defaultdict
from datetime import datetime, timezone
from math import exp
from pathlib import Path
from time import monotonic
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from uuid import uuid4

import psycopg2
from dotenv import load_dotenv
import os
import logging


CATEGORY_AFFINITY_WEIGHT = 3.0
RECENCY_WEIGHT = 2.0
ENGAGEMENT_VELOCITY_WEIGHT = 1.5
SEEN_TOPIC_PENALTY = 4.0
RECENT_WINDOW_HOURS = 168.0
RECENCY_HALF_LIFE_HOURS = 168.0

LOGGER = logging.getLogger("for_you_scores")
ROOT_DIR = Path(__file__).resolve().parents[1]
load_dotenv(ROOT_DIR / ".env")


def database_url_without_prisma_options(database_url):
    """Remove Prisma-only query options before passing the URL to libpq."""
    parts = urlsplit(database_url)
    query = [(key, value) for key, value in parse_qsl(parts.query) if key != "schema"]
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def fetch_rows(cursor, query, params=None):
    cursor.execute(query, params or ())
    return cursor.fetchall()


def load_topics(cursor):
    return fetch_rows(
        cursor,
        '''
        SELECT t."id", t."categoryId", t."createdAt",
               COUNT(DISTINCT v."id") AS vote_count,
               COUNT(DISTINCT c."id") AS comment_count,
               COUNT(DISTINCT v."id") FILTER (WHERE v."createdAt" >= NOW() - INTERVAL '168 hours') AS recent_votes,
               COUNT(DISTINCT c."id") FILTER (WHERE c."createdAt" >= NOW() - INTERVAL '168 hours') AS recent_comments
        FROM "Topic" t
        LEFT JOIN "Vote" v ON v."topicId" = t."id"
        LEFT JOIN "Comment" c ON c."topicId" = t."id" AND c."status" = 'ACTIVE'
        WHERE t."status" = 'ACTIVE'
        GROUP BY t."id"
        ''',
    )


def load_users(cursor):
    return fetch_rows(cursor, 'SELECT "id" FROM "User"')


def load_category_affinity(cursor):
    affinity = defaultdict(lambda: defaultdict(lambda: [0.0, 0]))
    vote_rows = fetch_rows(
        cursor,
        '''
        SELECT v."userId", COALESCE(t."categoryId", ct."categoryId") AS "categoryId",
               CASE WHEN v."type" = 'UP' THEN 1.0 ELSE -1.0 END AS signal
        FROM "Vote" v
        LEFT JOIN "Topic" t ON t."id" = v."topicId"
        LEFT JOIN "Comment" cm ON cm."id" = v."commentId"
        LEFT JOIN "Topic" ct ON ct."id" = cm."topicId"
        WHERE COALESCE(t."categoryId", ct."categoryId") IS NOT NULL
        ''',
    )
    for user_id, category_id, signal in vote_rows:
        affinity[user_id][category_id][0] += signal
        affinity[user_id][category_id][1] += 1

    comment_rows = fetch_rows(
        cursor,
        'SELECT "authorId", "topicId" FROM "Comment" WHERE "status" = %s',
        ("ACTIVE",),
    )
    for user_id, topic_id in comment_rows:
        category_row = fetch_rows(cursor, 'SELECT "categoryId" FROM "Topic" WHERE "id" = %s', (topic_id,))
        if category_row and category_row[0][0]:
            category_id = category_row[0][0]
            affinity[user_id][category_id][0] += 1.0
            affinity[user_id][category_id][1] += 1
    return affinity


def load_seen_topics(cursor):
    seen = defaultdict(set)
    for user_id, topic_id in fetch_rows(cursor, 'SELECT "userId", "topicId" FROM "Vote" WHERE "topicId" IS NOT NULL'):
        seen[user_id].add(topic_id)
    for user_id, topic_id in fetch_rows(
        cursor,
        '''SELECT c."authorId", c."topicId" FROM "Comment" c WHERE c."status" = 'ACTIVE' ''',
    ):
        seen[user_id].add(topic_id)
    return seen


def score_topic(topic, user_affinity, seen_topics, now):
    topic_id, category_id, created_at, _, _, recent_votes, recent_comments = topic
    created_at = created_at.replace(tzinfo=created_at.tzinfo or timezone.utc)
    age_hours = max((now - created_at).total_seconds() / 3600.0, 0.0)
    recency = exp(-age_hours / RECENCY_HALF_LIFE_HOURS)
    recent_engagement = float(recent_votes or 0) + float(recent_comments or 0)
    engagement_velocity = recent_engagement / max(min(age_hours, RECENT_WINDOW_HOURS), 1.0)
    if not user_affinity and not seen_topics:
        return ENGAGEMENT_VELOCITY_WEIGHT * engagement_velocity

    category_stats = user_affinity.get(category_id, [0.0, 0])
    category_affinity = category_stats[0] / category_stats[1] if category_stats[1] else 0.0
    seen_penalty = SEEN_TOPIC_PENALTY if topic_id in seen_topics else 0.0
    return (
        CATEGORY_AFFINITY_WEIGHT * category_affinity
        + RECENCY_WEIGHT * recency
        + ENGAGEMENT_VELOCITY_WEIGHT * engagement_velocity
        - seen_penalty
    )


def compute_scores():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError(f"DATABASE_URL is missing from {ROOT_DIR / '.env'}")

    started = monotonic()
    connection = psycopg2.connect(database_url_without_prisma_options(database_url))
    users_processed = 0
    topics_scored = 0
    try:
        with connection.cursor() as cursor:
            topics = load_topics(cursor)
            users = load_users(cursor)
            affinity = load_category_affinity(cursor)
            seen_topics = load_seen_topics(cursor)
            now = datetime.now(timezone.utc)

            for (user_id,) in users:
                user_affinity = affinity.get(user_id, {})
                user_seen = seen_topics.get(user_id, set())
                for topic in topics:
                    try:
                        score = score_topic(topic, user_affinity, user_seen, now)
                        cursor.execute(
                            '''
                            INSERT INTO "UserTopicScore" ("id", "userId", "topicId", "score", "computedAt")
                            VALUES (%s, %s, %s, %s, NOW())
                            ON CONFLICT ("userId", "topicId") DO UPDATE
                            SET "score" = EXCLUDED."score", "computedAt" = EXCLUDED."computedAt"
                            ''',
                            (str(uuid4()), user_id, topic[0], score),
                        )
                        topics_scored += 1
                    except Exception:
                        connection.rollback()
                        LOGGER.exception("Skipping score for user=%s topic=%s", user_id, topic[0])
                connection.commit()
                users_processed += 1
    finally:
        connection.close()

    LOGGER.info(
        "Completed For You scoring: users=%d topics_scored=%d duration=%.2fs",
        users_processed,
        topics_scored,
        monotonic() - started,
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    try:
        compute_scores()
    except Exception:
        LOGGER.exception("For You scoring run failed")
        raise SystemExit(1)