"""Authoritative Homyz Platform Knowledge Base for AI Guest Support.

This module stores global platform rules, cancellation policies, fee structures,
and support escalation paths. Injected directly into the chatbot system context
to ensure 100% grounded, zero-hallucination answers.
"""

from typing import Final

HOMYZ_PLATFORM_KNOWLEDGE: Final[str] = """- Platform: Homyz is a premier accommodation marketplace connecting travelers with verified homes, apartments, and luxury villas worldwide.
- Cancellation Tiers (Cleaning fee is always 100% refunded before check-in):
  * FLEXIBLE: 100% accommodation refund >= 24h before check-in. Under 24h: 1st night + fees retained.
  * MODERATE: 100% accommodation refund >= 5 days (120h) before check-in. Under 5 days: 0% accommodation refund.
  * FIRM: 100% accommodation refund >= 30 days before; 50% between 30 and 7 days; 0% under 7 days.
  * NON-REFUNDABLE: 0% accommodation refund regardless of when cancelled.
- Rescheduling / Date Changes: Guests cannot modify reservations directly in chat. Direct them to 'My Trips' at `/profile/tab/upcoming` -> 'Change Reservation' for host review.
- Payments & Pricing: Strictly on-platform digital payments (cards/wallets). No cash transactions permitted. Security deposits (if any) released within 48h after checkout.
- Standard Times: Default check-in 3:00 PM, checkout 11:00 AM unless listing specifies otherwise. Early check-in requires direct host approval.
- House Rules: Parties/disruptive events are strictly prohibited. Respect quiet hours. Smoking/pets forbidden unless listing explicitly allows.
- Support & Escalation:
  * Property issues/cleanliness: Message host first via Homyz inbox (hosts have 1h to respond to urgent issues).
  * Unresolved disputes: Escalate to 24/7 Homyz Support at `/profile/tab/support`.
  * Emergencies (medical/fire): Contact local emergency authorities immediately (911/999)."""
