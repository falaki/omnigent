"""Deterministic Forum lifecycle, independent of harness and transport."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class Participant:
    session_id: str
    harness: str
    model: str
    name: str
    failures: int = 0
    retry_at: float = 0
    error: str | None = None
    paused: bool = False


@dataclass
class ForumState:
    participants: list[Participant]
    max_responses: int = 100
    completed: int = 0
    next_index: int = 0
    status: str = "blank"
    generation: int = 0
    active_index: int | None = None
    active_token: str | None = None
    actor: str | None = None
    posts: list[dict[str, Any]] = field(default_factory=list)

    def __post_init__(self) -> None:
        if len(self.participants) < 2:
            raise ValueError("A forum needs at least two participants")
        if not 1 <= self.max_responses <= 10000:
            raise ValueError("Maximum responses must be between 1 and 10000")

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> ForumState:
        fields: dict[str, Any] = dict(value)
        fields["participants"] = [Participant(**p) for p in value["participants"]]
        return cls(**fields)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def post(self, post: dict[str, Any], *, stop: bool = False) -> None:
        if any(existing["id"] == post["id"] for existing in self.posts):
            return
        self.posts.append(post)
        self.actor = post["author"]
        if stop:
            self.stop()
        elif self.status in {"blank", "stopped", "limit"}:
            self.generation += 1
            self.completed = 0
            self.status = "running"

    def pause(self) -> str | None:
        if self.status not in {"running", "paused"}:
            return None
        interrupted = None
        if self.active_index is not None:
            self.next_index = self.active_index
            interrupted = self.participants[self.active_index].session_id
        self.generation += 1
        self.active_index = None
        self.active_token = None
        self.status = "suspended"
        return interrupted

    def resume(self) -> None:
        if self.status == "suspended":
            self.generation += 1
            self.status = "running"

    def stop(self) -> None:
        self.generation += 1
        self.status = "stopped"
        if self.active_index is not None:
            self.next_index = (self.active_index + 1) % len(self.participants)
        self.active_index = None
        self.active_token = None

    def set_participant_paused(self, index: int, paused: bool) -> str | None:
        participant = self.participants[index]
        participant.paused = paused
        interrupted = None
        if paused and self.active_index == index:
            interrupted = participant.session_id
            self.active_index = None
            self.active_token = None
            self.next_index = (index + 1) % len(self.participants)
        if self.status in {"running", "paused"}:
            self.status = (
                "paused" if sum(not p.paused for p in self.participants) < 2 else "running"
            )
        return interrupted

    def select(self, now: float) -> int | None:
        if self.status not in {"running", "paused"} or self.active_token:
            return None
        if self.completed >= self.max_responses:
            self.status = "limit"
            return None
        available = [p for p in self.participants if not p.paused and p.retry_at <= now]
        if len(available) < 2:
            self.status = "paused"
            return None
        self.status = "running"
        pending = self.participants[self.next_index]
        if not pending.paused and 0 < pending.failures < 3 and pending.retry_at > now:
            return None
        for offset in range(len(self.participants)):
            index = (self.next_index + offset) % len(self.participants)
            if not self.participants[index].paused and self.participants[index].retry_at <= now:
                return index
        return None

    def begin(self, index: int, token: str) -> None:
        self.active_index = index
        self.active_token = token

    def finish(self, token: str, text: str, now: float, error: str | None = None) -> bool:
        if token != self.active_token or self.active_index is None:
            return False
        index = self.active_index
        participant = self.participants[index]
        self.active_index = None
        self.active_token = None
        if error is not None:
            participant.failures += 1
            participant.error = error
            # Two brief retries, then a cooldown before trying this participant again.
            participant.retry_at = now + (
                2**participant.failures if participant.failures < 3 else 30
            )
            self.next_index = (
                index if participant.failures < 3 else (index + 1) % len(self.participants)
            )
        else:
            participant.failures = 0
            participant.retry_at = 0
            participant.error = None
            self.posts.append(
                {
                    "id": token,
                    "author": participant.name,
                    "role": "assistant",
                    "text": text,
                    "created_at": now,
                    "session_id": participant.session_id,
                }
            )
            self.completed += 1
            self.next_index = (index + 1) % len(self.participants)
            if self.completed >= self.max_responses:
                self.status = "limit"
        return True
