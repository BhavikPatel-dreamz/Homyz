from fastapi import APIRouter, Depends, status

from core.security import verify_api_key
from models.risk import RiskAuditRequest, RiskAuditResponse
from services.risk_service import RiskService, get_risk_service

router = APIRouter(tags=["Risk & Fraud Detection"], dependencies=[Depends(verify_api_key)])


@router.post(
    "/audit-listing",
    response_model=RiskAuditResponse,
    status_code=status.HTTP_200_OK,
    summary="Audit listing for fraud, price honeypots, and scams",
)
async def audit_listing(
    payload: RiskAuditRequest,
    risk_service: RiskService = Depends(get_risk_service),
) -> RiskAuditResponse:
    """Performs spatial price benchmarking, regex screening, and AI fraud classification on a listing."""
    return await risk_service.audit_listing(payload)
