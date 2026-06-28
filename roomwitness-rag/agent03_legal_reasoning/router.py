def determine_routing(landlord_unit_count: int) -> dict:
    """
    Determine the legal routing and which documents Agent 04 should generate.

    OCPB 2568 applies only to landlords with 3 or more residential units.
    Landlords with fewer units must be taken to civil court under CCC §537-571.

    Args:
        landlord_unit_count: Number of units the landlord operates.
                             0 means unknown.

    Returns:
        Dict with keys:
            route: "OCPB" | "CIVIL" | "BOTH"
            documents_to_generate: list of document type strings
            note: Optional guidance string for the tenant (None if not needed)
    """
    if landlord_unit_count >= 3:
        return {
            "route": "OCPB",
            "documents_to_generate": ["ocpb_complaint", "demand_letter", "evidence_summary"],
            "note": None,
        }
    elif landlord_unit_count in (1, 2):
        return {
            "route": "CIVIL",
            "documents_to_generate": ["demand_letter", "evidence_summary"],
            "note": (
                "OCPB scope requires 3+ units. Civil court route applies. "
                "CCC §537-571 is the legal basis."
            ),
        }
    else:  # 0 = unknown
        return {
            "route": "BOTH",
            "documents_to_generate": ["ocpb_complaint", "demand_letter", "evidence_summary"],
            "note": (
                "Unit count unknown. All documents generated. "
                "Tenant must confirm landlord has 3+ units before filing OCPB complaint."
            ),
        }
