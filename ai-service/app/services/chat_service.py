import json
from collections.abc import AsyncGenerator
from typing import Any, Optional

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from core.config import Settings, get_settings
from core.exceptions import AIProviderError
from core.platform_knowledge import HOMYZ_PLATFORM_KNOWLEDGE
from models.chat import ChatRequest
from services.qdrant_service import QdrantService, get_qdrant_service
from utils.logger import get_logger

logger = get_logger(__name__)

# Maximum number of previous messages to retain for context (sliding window)
MAX_HISTORY_MESSAGES = 5


class ChatService:
    """Manages real-time streaming conversational AI for guests with dual-mode RAG."""

    def __init__(
        self,
        qdrant_service: Optional[QdrantService] = None,
        settings: Optional[Settings] = None,
    ) -> None:
        self.qdrant_service = qdrant_service or get_qdrant_service()
        self.settings = settings or get_settings()
        self._llm: Any = None

    @property
    def llm(self) -> Any:
        """Lazily initializes the LangChain Chat model for streaming."""
        if self._llm is None:
            if not self.settings.GOOGLE_API_KEY:
                raise AIProviderError("GOOGLE_API_KEY is not configured")
            try:
                from langchain_google_genai import ChatGoogleGenerativeAI

                self._llm = ChatGoogleGenerativeAI(
                    model=self.settings.GEMINI_MODEL,
                    google_api_key=self.settings.GOOGLE_API_KEY,
                )
            except ImportError as exc:
                raise AIProviderError(
                    "langchain-google-genai is not installed. Please check requirements."
                ) from exc
        return self._llm

    async def _fetch_listing_context(self, listing_id: Optional[str]) -> tuple[Optional[dict[str, Any]], str]:
        """Fetches listing metadata from Qdrant and formats it for system context."""
        if not listing_id:
            return None, ""

        try:
            payload = await self.qdrant_service.get_listing_by_id(listing_id)
            if not payload:
                logger.warning("Listing ID '%s' not found in Qdrant; running in Platform FAQ mode", listing_id)
                return None, (
                    f"\n[CURRENT PROPERTY CONTEXT: Notice: Property details for listing ID '{listing_id}' "
                    "could not be located in the database. Answer using general platform policies and recommend "
                    "the guest verify property details directly on the listing page.]\n"
                )

            # Format property details into structured context (omitting empty/unconfigured fields)
            house_rules = payload.get("house_rules") or {}
            amenities = payload.get("amenities") or []
            price_cents = payload.get("price", 0)
            price_display = f"{price_cents / 100:.2f}" if price_cents else "Rate available at checkout"

            lines = [
                "\n[CURRENT PROPERTY CONTEXT]",
                f"- Title: {payload.get('title', 'Homyz Stay')}",
                f"- Type: {payload.get('property_type', 'Accommodation')} ({payload.get('listing_type', 'Entire place')}) in {payload.get('city', 'Unknown')}, {payload.get('country', '')}",
                f"- Capacity: Up to {payload.get('guests', 1)} guests ({payload.get('bedrooms', 1)} bedrooms, {payload.get('beds', 1)} beds, {payload.get('bathrooms', 1.0)} bathrooms)",
                f"- Rate: approx. {price_display} per night",
                f"- Cancellation Policy: {house_rules.get('cancellation_policy', 'FLEXIBLE')}",
            ]

            if amenities:
                lines.append(f"- Amenities: {', '.join(amenities)}")

            # Public Check-in / Check-out Hours (Zero-Knowledge: private methods/codes are excluded)
            ci_parts = []
            if house_rules.get("check_in_start"):
                ci_end = f", before {house_rules.get('check_in_end')}" if house_rules.get("check_in_end") else ""
                ci_parts.append(f"After {house_rules.get('check_in_start')}{ci_end}")
            if ci_parts:
                lines.append(f"- Check-in Hours: {', '.join(ci_parts)}")
            if house_rules.get("check_out_time"):
                lines.append(f"- Check-out: Before {house_rules.get('check_out_time')}")

            # Public Parking Availability (Zero-Knowledge: private gate codes/bay pins are excluded)
            if house_rules.get("parking_available") or any("parking" in a.lower() for a in amenities):
                ptype = house_rules.get("parking_type", "On premises")
                lines.append(f"- Parking: Available ({ptype})")
            elif "parking_available" in house_rules and not house_rules.get("parking_available"):
                lines.append("- Parking: Not available on premises")

            # Public Wi-Fi Status (Zero-Knowledge: network names and passwords are never passed to LLM)
            has_wifi = bool(
                house_rules.get("wifi_network")
                or house_rules.get("wifi_password")
                or any("wifi" in a.lower() for a in amenities)
            )
            if has_wifi:
                lines.append("- Wi-Fi: Available on premises (Private access credentials released to confirmed guests in booking guide)")

            # Quiet Hours
            if house_rules.get("quiet_hours"):
                qh_start = house_rules.get("quiet_hours_start", "10:00 PM")
                qh_end = house_rules.get("quiet_hours_end", "8:00 AM")
                lines.append(f"- Quiet Hours: Enforced ({qh_start} - {qh_end})")

            # Pets & Smoking
            if "pets_allowed" in house_rules:
                lines.append(f"- Pets: {'Allowed' if house_rules.get('pets_allowed') else 'Not allowed'}")
            if "smoking_allowed" in house_rules:
                lines.append(f"- Smoking: {'Allowed' if house_rules.get('smoking_allowed') else 'Not allowed'}")

            if house_rules.get("additional_rules"):
                lines.append(f"- Rules: {house_rules.get('additional_rules')}")

            listing_str = "\n".join(lines) + "\n"
            return payload, listing_str

        except Exception as exc:
            logger.error("Failed to query Qdrant for listing '%s': %s", listing_id, exc)
            return None, ""

    def _assemble_system_prompt(self, property_context: str) -> str:
        """Assembles the unified system prompt containing platform policies and grounded property data."""
        return (
            "You are the official Homyz Guest Support Concierge. Provide warm, professional, "
            "concise, and 100% accurate assistance to travelers.\n\n"
            "[HOMYZ PLATFORM POLICIES]\n"
            f"{HOMYZ_PLATFORM_KNOWLEDGE}\n\n"
            f"{property_context if property_context else '[Mode: General Platform FAQ Mode - No listing_id provided]'}\n\n"
            "[CONCIERGE RULES & GUARDRAILS]\n"
            "1. Grounding & Precedence: Ground answers strictly on [CURRENT PROPERTY CONTEXT] when present. "
            "Specific property details override general platform defaults. If an unlisted detail is asked, do not guess; "
            "advise the guest to message the host directly via their Homyz inbox.\n"
            "2. No Financial Authority: NEVER promise, guarantee, or issue refunds, payouts, or fee waivers. "
            "Explain the active policy and direct the guest to '/profile/tab/upcoming' or '/profile/tab/support'.\n"
            "3. Privacy & Security: NEVER reveal private access credentials, Wi-Fi passwords, lockbox codes, or door codes. "
            "If asked for passwords or entry codes, confirm that the amenity is available and state that private access "
            "details are securely provided in their confirmed booking arrival guide at '/profile/tab/upcoming' upon check-in. "
            "Never approve off-platform payments or cash transactions.\n"
            "4. Language: Always reply in the exact same language the guest writes in (e.g. English, Arabic, Spanish, French)."
        )

    def _generate_quick_replies(self, message: str, has_listing: bool) -> list[str]:
        """Generates dynamic follow-up suggestion chips tailored to conversation context."""
        msg = message.lower()
        topic_replies = [
            (["cancel", "refund", "exchange", "change date", "reschedule", "money back"], [
                "How do I request a date change?",
                "Where can I contact human support?",
                "What is the cleaning fee refund policy?",
            ]),
            (["check-in", "checkin", "key", "lock", "arrival", "enter", "access"], [
                "What is the wifi password?",
                "Is parking available?",
                "Can I request early check-in?",
            ]),
            (["wifi", "wi-fi", "internet", "network", "password"], [
                "Where can I park?",
                "What time is check-out?",
                "What are the house rules?",
            ]),
            (["park", "parking", "car", "garage", "vehicle", "suv"], [
                "What is the wifi password?",
                "What time is check-in?",
                "Are pets allowed?",
            ]),
        ]

        for keywords, replies in topic_replies:
            if any(k in msg for k in keywords):
                return replies

        if has_listing:
            return ["What is the cancellation policy?", "What time is check-in?", "Is parking available?"]
        return ["How do cancellation refunds work?", "How do I change my booking dates?", "How do I contact Homyz support?"]

    async def stream_chat(self, request: ChatRequest) -> AsyncGenerator[str, None]:
        """Emits real-time SSE chunks with token deltas and contextual quick replies."""
        # 1. Fetch property metadata from Qdrant if listing_id provided
        listing_payload, property_context = await self._fetch_listing_context(request.listing_id)

        # 2. Assemble system prompt
        system_prompt = self._assemble_system_prompt(property_context)

        # 3. Apply sliding window history pruning (retains last MAX_HISTORY_MESSAGES)
        pruned_history = request.conversation_history[-MAX_HISTORY_MESSAGES:]

        messages: list[Any] = [SystemMessage(content=system_prompt)]
        for turn in pruned_history:
            if turn.role == "user":
                messages.append(HumanMessage(content=turn.content))
            elif turn.role == "assistant":
                messages.append(AIMessage(content=turn.content))

        # 4. Append current user message
        messages.append(HumanMessage(content=request.message))

        # 5. Stream LLM tokens via Server-Sent Events
        has_emitted_tokens = False
        try:
            async for chunk in self.llm.astream(messages):
                token = chunk.content
                if token:
                    # LangChain Google GenAI 4+ can return structured content blocks e.g. [{'type': 'text', 'text': '...'}]
                    if isinstance(token, str):
                        text_delta = token
                    elif isinstance(token, list):
                        text_delta = "".join(
                            part.get("text", "")
                            if isinstance(part, dict)
                            else (getattr(part, "text", "") if hasattr(part, "text") else str(part))
                            for part in token
                        )
                    else:
                        text_delta = str(token)

                    if text_delta:
                        has_emitted_tokens = True
                        payload_json = json.dumps({"token": text_delta})
                        yield f"data: {payload_json}\n\n"

        except Exception as exc:
            logger.warning("Upstream AI error during chat stream: %s", exc)
            fallback_text = (
                " I apologize, but I am temporarily unable to complete this response. "
                "For immediate assistance, please connect with our 24/7 team at /profile/tab/support."
            )
            yield f"data: {json.dumps({'token': fallback_text})}\n\n"

        # 6. Emit final completion event with dynamic quick replies
        quick_replies = self._generate_quick_replies(request.message, has_listing=bool(listing_payload))
        done_payload = json.dumps({
            "done": True,
            "suggested_quick_replies": quick_replies,
        })
        yield f"data: {done_payload}\n\n"


_chat_service_instance: Optional[ChatService] = None


def get_chat_service() -> ChatService:
    """Dependency provider for ChatService singleton."""
    global _chat_service_instance
    if _chat_service_instance is None:
        _chat_service_instance = ChatService()
    return _chat_service_instance
