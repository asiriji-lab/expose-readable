import json
import logging
import re

from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import JsonOutputParser

from agent04_doc_generator.prompts import DOC_PROMPT, CORRECTION_PROMPT

logger = logging.getLogger(__name__)


def build_doc_chain(llm: ChatOpenAI):
    """
    Assemble the LangChain chain for section-by-section document filling.

    Temperature MUST be 0.05 — passed via the llm argument from main.py.
    Chain: DOC_PROMPT | llm | JsonOutputParser

    Args:
        llm: A ChatOpenAI instance (Typhoon v2, temperature=0.05).

    Returns:
        A runnable LangChain chain.
    """
    return DOC_PROMPT | llm | JsonOutputParser()


def fill_section(
    section_key: str,
    instruction: str,
    context: dict,
    doc_type: str,
    llm: ChatOpenAI,
) -> str:
    """
    Fill one document section by calling Typhoon v2 with the section instruction.

    Args:
        section_key: Section identifier (e.g. 'section_1', 'demand').
        instruction: Thai instruction describing what to write for this section.
        context: Full case data dict (tenant, landlord, lease, verdicts, amounts).
        doc_type: Document type string for prompt context.
        llm: ChatOpenAI instance (Typhoon v2).

    Returns:
        Filled Thai text for this section.
    """
    chain = build_doc_chain(llm)
    result = chain.invoke({
        "doc_type": doc_type,
        "section_key": section_key,
        "instruction": instruction,
        "context_json": json.dumps(context, ensure_ascii=False, indent=2),
    })
    # The model returns {section_key: "text"} — extract the value
    if isinstance(result, dict):
        return result.get(section_key, result.get(list(result.keys())[0], ""))
    return str(result)


def validate_output(
    filled_doc: dict,
    allowed_citations: list[str],
    amounts: dict,
) -> tuple[bool, str]:
    """
    Validate that the filled document respects citation and amount constraints.

    Checks:
        1. No citation appears in the text that is not in allowed_citations.
        2. All THB amounts in amounts dict appear verbatim in the document.

    Args:
        filled_doc: Dict of {section_key: filled_text}.
        allowed_citations: List of citation strings permitted (from Agent 03 verdicts).
        amounts: Dict of {label: thb_float} that must appear in the document.

    Returns:
        Tuple of (is_valid, error_message). error_message is empty string when valid.
    """
    full_text = " ".join(str(v) for v in filled_doc.values())

    # Check for unauthorised citations (simple substring check)
    # Known Thai law citation patterns: ป.พ.พ. มาตรา NNN, สคบ., พ.ร.บ., มาตรา NNN
    citation_pattern = re.compile(
        r"(ป\.พ\.พ\.\s*มาตรา\s*\d+|ประกาศ\s*สคบ\.|พ\.ร\.บ\.[^\s]+|มาตรา\s*\d+)"
    )
    found_citations = citation_pattern.findall(full_text)
    for found in found_citations:
        normalised = found.strip()
        if not any(normalised in allowed or allowed in normalised for allowed in allowed_citations):
            return False, f"Unauthorised citation found: '{normalised}'"

    # Check that expected amounts appear in the text
    for label, amount in amounts.items():
        amount_str = f"{amount:,.0f}"
        amount_str_no_comma = f"{int(amount)}"
        if amount_str not in full_text and amount_str_no_comma not in full_text:
            return False, f"Expected amount {amount_str} บาท ({label}) not found in document"

    return True, ""


def generate_document(
    doc_type: str,
    case_data: dict,
    structure: dict,
    llm: ChatOpenAI,
) -> dict:
    """
    Fill every section of a document structure and validate the result.

    Validates once after all sections are filled. If validation fails,
    retries the entire document once with a correction prompt. Raises
    ValueError if still invalid after retry.

    Args:
        doc_type: One of 'ocpb_complaint', 'demand_letter', 'evidence_summary'.
        case_data: Full context dict passed to fill_section().
        structure: Document structure dict from templates/ (has 'sections' list).
        llm: ChatOpenAI instance (Typhoon v2, temperature=0.05).

    Returns:
        Dict of {section_key: filled_Thai_text}.
    """
    sections = structure.get("sections", [])

    # Collect allowed citations from Agent 03 verdicts
    allowed_citations: list[str] = []
    for verdict in case_data.get("verdicts", []):
        allowed_citations.extend(verdict.get("citations", []))
    allowed_citations = list(set(allowed_citations))

    # Collect amounts that must appear verbatim
    amounts = {"total_unlawful_thb": case_data.get("total_unlawful_thb", 0.0)}

    def _fill_all(correction_error: str | None = None) -> dict:
        filled: dict[str, str] = {}
        for section in sections:
            key = section["key"]
            instruction = section["instruction"]
            if correction_error:
                # Retry path: prepend error context to instruction
                chain = CORRECTION_PROMPT | llm | JsonOutputParser()
                result = chain.invoke({
                    "error_message": correction_error,
                    "doc_type": doc_type,
                    "section_key": key,
                    "instruction": instruction,
                    "context_json": json.dumps(case_data, ensure_ascii=False, indent=2),
                })
                if isinstance(result, dict):
                    filled[key] = result.get(key, result.get(list(result.keys())[0], ""))
                else:
                    filled[key] = str(result)
            else:
                filled[key] = fill_section(key, instruction, case_data, doc_type, llm)
        return filled

    filled_doc = _fill_all()
    is_valid, error_msg = validate_output(filled_doc, allowed_citations, amounts)

    if not is_valid:
        logger.warning("Document validation failed for %s: %s — retrying once", doc_type, error_msg)
        filled_doc = _fill_all(correction_error=error_msg)
        is_valid, error_msg = validate_output(filled_doc, allowed_citations, amounts)
        if not is_valid:
            raise ValueError(
                f"Document '{doc_type}' failed validation after retry: {error_msg}"
            )

    return filled_doc
