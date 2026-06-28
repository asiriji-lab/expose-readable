import json
import logging

from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import JsonOutputParser

from agent02_contract_parser.prompts import PARSER_PROMPT

logger = logging.getLogger(__name__)


def build_parser_chain(llm: ChatOpenAI):
    """
    Assemble the LangChain chain for contract parsing.

    Chain: PARSER_PROMPT | llm | JsonOutputParser

    Args:
        llm: A ChatOpenAI instance (Typhoon v2).

    Returns:
        A runnable LangChain chain that accepts {lease_text, claim_list}
        and returns a parsed dict.
    """
    return PARSER_PROMPT | llm | JsonOutputParser()


def parse_contract(lease_text: str, claims: list[dict], llm: ChatOpenAI) -> dict:
    """
    Parse a lease contract against landlord claims using Typhoon v2 via LangChain.

    Formats the claims list as a numbered Thai list for prompt injection, invokes
    the chain, and retries once with a JSON correction instruction on decode failure.

    Args:
        lease_text: Raw text extracted from the lease PDF.
        claims: List of claim dicts (keys: claim_id, item, amount_thb, description).
        llm: A ChatOpenAI instance (Typhoon v2).

    Returns:
        Parsed dict matching the Agent02Output schema fields
        (liability_map, contract_summary, unfair_clauses).
    """
    claim_lines = [
        f"{i + 1}. {c['item']} — {c['description']} ({c['amount_thb']:,.0f} บาท)"
        for i, c in enumerate(claims)
    ]
    claim_list = "\n".join(claim_lines)

    chain = build_parser_chain(llm)

    try:
        return chain.invoke({"lease_text": lease_text, "claim_list": claim_list})
    except (json.JSONDecodeError, ValueError) as first_err:
        logger.warning("First parse attempt failed (%s) — retrying with correction prompt", first_err)

    # Retry: append a correction instruction so the model fixes its own output
    from langchain_core.prompts import ChatPromptTemplate
    correction_prompt = ChatPromptTemplate.from_messages([
        ("system", "คุณเป็นผู้เชี่ยวชาญกฎหมายไทยด้านสัญญาเช่าที่อยู่อาศัย"),
        ("human",
         "ครั้งก่อนคุณตอบผิดรูปแบบ JSON กรุณาตอบใหม่ในรูปแบบ JSON ที่ถูกต้องเท่านั้น "
         "ห้ามมีข้อความนอก JSON\n\n"
         f"สัญญาเช่า:\n{lease_text}\n\nรายการเรียกร้อง:\n{claim_list}"),
    ])
    correction_chain = correction_prompt | llm | JsonOutputParser()
    return correction_chain.invoke({})
