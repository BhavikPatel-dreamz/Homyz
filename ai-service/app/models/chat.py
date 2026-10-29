from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class ChatMessage(BaseModel):
    """Individual conversational turn."""

    role: Literal["user", "assistant"] = Field(
        ..., description="Role of the conversational party ('user' or 'assistant')"
    )
    content: str = Field(..., min_length=1, max_length=2000, description="Message text content")


class ChatRequest(BaseModel):
    """Payload for initiating a streaming conversational turn."""

    message: str = Field(..., min_length=1, max_length=2000, description="Current guest message")
    listing_id: Optional[str] = Field(
        default=None, description="Optional property identifier for context retrieval"
    )
    conversation_history: list[ChatMessage] = Field(
        default_factory=list,
        max_length=20,
        description="Stateless conversation history (sliding window applies)",
    )

    @field_validator("message")
    @classmethod
    def validate_message(cls, v: str) -> str:
        clean = v.strip()
        if not clean:
            raise ValueError("Message cannot be empty or purely whitespace")
        return clean


class ChatStreamTokenEvent(BaseModel):
    """Real-time token delta emitted via Server-Sent Events (SSE)."""

    token: str


class ChatStreamDoneEvent(BaseModel):
    """Final completion event emitted at the end of the SSE stream."""

    done: bool = True
    suggested_quick_replies: list[str] = Field(default_factory=list)
