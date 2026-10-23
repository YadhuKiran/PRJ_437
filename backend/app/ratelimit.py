"""Shared, stdlib-only request rate limiting.

Design notes:
  * Thread-safe (a lock) and bounded: expired buckets are evicted, so the
    in-memory store cannot grow without limit (the previous per-router
    implementation leaked one list per client IP forever).
  * The client identity is the socket peer address by default. X-Forwarded-For
    is only honoured when TRUST_PROXY is explicitly enabled, because an
    attacker can otherwise spoof the header and evade every limit.
  * Buckets are keyed by a caller-supplied scope so one noisy client cannot
    exhaust another route's budget.
"""
import threading
import time
from collections import defaultdict, deque
from typing import Deque

from fastapi import HTTPException, Request

from .config import TRUST_PROXY

_LOCK = threading.Lock()
_BUCKETS: dict[str, Deque[float]] = defaultdict(deque)
_LAST_SWEEP = 0.0
_SWEEP_INTERVAL_S = 60.0


def client_ip(request: Request) -> str:
    """Best-effort client identity for rate limiting."""
    peer = request.client.host if request.client else "unknown"
    if TRUST_PROXY:
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            # Left-most entry is the original client when the proxy appends.
            peer = forwarded.split(",")[0].strip() or peer
    return peer


def reset_state() -> None:
    """Clear all buckets. Used by tests."""
    with _LOCK:
        _BUCKETS.clear()


def _sweep(now: float) -> None:
    """Drop buckets whose entries are all outside every window we track."""
    global _LAST_SWEEP
    if now - _LAST_SWEEP < _SWEEP_INTERVAL_S:
        return
    _LAST_SWEEP = now
    for key in list(_BUCKETS.keys()):
        bucket = _BUCKETS[key]
        while bucket and now - bucket[0] > 3600.0:
            bucket.popleft()
        if not bucket:
            del _BUCKETS[key]


def enforce_rate_limit(
    request: Request,
    scope: str,
    limit: int,
    window_s: float = 60.0,
    message: str = "Too many requests right now. Please wait a moment and try again.",
    extra_key: str = "",
) -> None:
    """Raise HTTP 429 when the caller exceeds `limit` requests per `window_s`.

    `extra_key` lets a route narrow the bucket further (e.g. per username)
    without letting one caller consume another route's budget.
    """
    ip = client_ip(request)
    key = f"{scope}|{ip}" + (f"|{extra_key.lower()}" if extra_key else "")
    now = time.monotonic()
    with _LOCK:
        _sweep(now)
        bucket = _BUCKETS[key]
        while bucket and now - bucket[0] >= window_s:
            bucket.popleft()
        if len(bucket) >= limit:
            retry_after = max(1, int(window_s - (now - bucket[0])))
            raise HTTPException(
                status_code=429,
                detail=message,
                headers={"Retry-After": str(retry_after)},
            )
        bucket.append(now)
