from fastapi import APIRouter, Depends, status
from fastapi.responses import StreamingResponse

from core.security import verify_api_key
from models.chat import ChatRequest
from services.chat_service import ChatService, get_chat_service

router = APIRouter(tags=["Guest Support Chatbot"], dependencies=[Depends(verify_api_key)])


@router.post(
    "",
    status_code=status.HTTP_200_OK,
    summary="Stream real-time conversational guest support assistance via Server-Sent Events (SSE)",
)
async def chat_stream(
    payload: ChatRequest,
    chat_service: ChatService = Depends(get_chat_service),
) -> StreamingResponse:
    """Delivers real-time token-by-token conversational assistance for guests.

    If `listing_id` is provided, dynamically pulls listing house rules, wifi, and parking from Qdrant.
    If `listing_id` is omitted, answers general Homyz platform questions and policies.
    Emits `text/event-stream` chunks (`data: {"token": "..."}`) and concludes with `{"done": true, "suggested_quick_replies": [...]}`.
    """
    return StreamingResponse(
        chat_service.stream_chat(payload),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
