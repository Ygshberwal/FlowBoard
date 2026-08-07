"""
Seed script — historically populated demo sections/habits/tasks before
FlowBoard became multi-user. Ownership now requires a user, so users
self-register instead. Kept in place so the module import path stays
stable; the function is a no-op.
"""
import asyncio
import logging

log = logging.getLogger(__name__)


async def seed() -> None:
    log.info("seed() is a no-op in multi-user mode; users self-register.")


if __name__ == "__main__":
    asyncio.run(seed())
