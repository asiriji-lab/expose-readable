from langchain_core.prompts import ChatPromptTemplate

SYSTEM_PROMPT = """คุณเป็นผู้เชี่ยวชาญกฎหมายไทยด้านการเช่าที่อยู่อาศัย
ใช้บทบัญญัติกฎหมายที่ให้มาเป็นฐานในการพิจารณาเท่านั้น
ห้ามอ้างอิงกฎหมายที่ไม่ได้ให้มา ห้ามคาดเดา
คำตัดสินต้องเป็นหนึ่งใน: LAWFUL, DISPUTED, UNLAWFUL
ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น"""

USER_PROMPT = """ข้อมูลกรณี:
- รายการ: {item}
- คำอธิบายการเรียกร้อง: {description}
- จำนวนเงิน: {amount_thb} บาท
- ผลการตรวจสอบภาพ: {cv_verdict} (ความมั่นใจ {cv_confidence})
- สัญญาระบุความรับผิดชอบผู้เช่า: {contract_liable}
- มีรายงานสภาพ ณ วันเข้าอยู่ที่เซ็นแล้ว: {movein_report_signed}
{forced_verdict_instruction}

บทบัญญัติกฎหมายที่เกี่ยวข้อง:
{retrieved_chunks}

ตอบในรูปแบบนี้:
{{
  "verdict": "LAWFUL หรือ DISPUTED หรือ UNLAWFUL",
  "reasoning_th": "เหตุผล 2-3 ประโยคเป็นภาษาไทย",
  "reasoning_en": "2-3 sentence reasoning in English",
  "citations": ["ประกาศ สคบ. 2568", "ป.พ.พ. มาตรา 546"],
  "recommended_action_th": "สิ่งที่ผู้เช่าควรทำ",
  "claim_validity_pct": 0
}}"""

FORCED_VERDICT_INSTRUCTION = """คำตัดสินที่กำหนดไว้แล้ว: {verdict}
ห้ามเปลี่ยนคำตัดสิน ให้เขียนเฉพาะ reasoning_th, reasoning_en, citations, \
recommended_action_th และ claim_validity_pct เท่านั้น"""

REASONER_PROMPT = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT),
    ("human", USER_PROMPT),
])

SUMMARY_SYSTEM_PROMPT = """คุณเป็นผู้เชี่ยวชาญกฎหมายไทยด้านการเช่าที่อยู่อาศัย
สรุปผลการวินิจฉัยทั้งหมดเป็น JSON ที่มีสองฟิลด์: case_summary_th และ case_summary_en
ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น"""

SUMMARY_USER_PROMPT = """ผลการวินิจฉัยทั้งหมด:
{verdicts_json}

ยอดรวมที่เรียกร้อง: {total_claimed_thb} บาท
ยอดที่ไม่ชอบด้วยกฎหมาย: {total_unlawful_thb} บาท
เส้นทางการดำเนินคดี: {routing}

ตอบในรูปแบบนี้:
{{
  "case_summary_th": "สรุปคดี 3-4 ประโยคเป็นภาษาไทย",
  "case_summary_en": "3-4 sentence case summary in English"
}}"""

SUMMARY_PROMPT = ChatPromptTemplate.from_messages([
    ("system", SUMMARY_SYSTEM_PROMPT),
    ("human", SUMMARY_USER_PROMPT),
])
