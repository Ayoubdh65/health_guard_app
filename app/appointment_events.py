"""
HealthGuard Edge Node - In-process pub/sub for appointment notifications.
"""

import asyncio
from typing import Any

_subscribers: set[asyncio.Queue] = set()


def subscribe_appointments() -> asyncio.Queue:
    """Register a listener queue for appointment events."""
    queue: asyncio.Queue = asyncio.Queue()
    _subscribers.add(queue)
    return queue


def unsubscribe_appointments(queue: asyncio.Queue) -> None:
    """Remove a listener queue."""
    _subscribers.discard(queue)


def publish_appointment(event: dict[str, Any]) -> None:
    """Push a new appointment event to all active subscribers."""
    for queue in list(_subscribers):
        try:
            queue.put_nowait(event)
        except Exception:
            _subscribers.discard(queue)
