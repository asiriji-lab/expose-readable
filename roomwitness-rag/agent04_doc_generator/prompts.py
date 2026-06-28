from langchain_core.prompts import ChatPromptTemplate

SYSTEM_PROMPT = """คุณเป็นผู้เชี่ยวชาญด้านการร่างเอกสารกฎหมายไทย
ร่างเอกสารตามโครงสร้างที่กำหนดอย่างเคร่งครัด
ใช้เฉพาะข้อมูลและกฎหมายที่ให้มา ห้ามเพิ่มเนื้อหาที่ไม่ได้ระบุ
ใช้ภาษาไทยทางการตลอด
วันที่ทุกรูปแบบต้องเป็น พ.ศ. เสมอ (ค.ศ. + 543)
ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น"""

USER_PROMPT = """ประเภทเอกสาร: {doc_type}
ส่วน: {section_key}
คำสั่ง: {instruction}

ข้อมูลคดี:
{context_json}

ตอบในรูปแบบ JSON:
{{
  "{section_key}": "ข้อความภาษาไทยทางการที่ร่างแล้ว"
}}"""

DOC_PROMPT = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT),
    ("human", USER_PROMPT),
])

CORRECTION_PROMPT = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT),
    ("human",
     "เอกสารที่ร่างก่อนหน้านี้ไม่ผ่านการตรวจสอบ: {error_message}\n\n"
     "กรุณาร่างใหม่ ปฏิบัติตามกฎเหล่านี้อย่างเคร่งครัด:\n"
     "1. ใช้เฉพาะกฎหมายที่อยู่ใน citations ของผลการวินิจฉัยเท่านั้น\n"
     "2. จำนวนเงินทุกรายการต้องตรงกับข้อมูลที่ให้มาเท่านั้น\n"
     "3. วันที่ต้องเป็น พ.ศ. เสมอ\n\n"
     "ประเภทเอกสาร: {doc_type}\n"
     "ส่วน: {section_key}\n"
     "คำสั่ง: {instruction}\n\n"
     "ข้อมูลคดี:\n{context_json}\n\n"
     "ตอบเป็น JSON: {{\"{ section_key}\": \"ข้อความที่แก้ไขแล้ว\"}}"),
])
