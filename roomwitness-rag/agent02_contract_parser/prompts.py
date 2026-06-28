from langchain_core.prompts import ChatPromptTemplate

SYSTEM_PROMPT = """คุณเป็นผู้เชี่ยวชาญกฎหมายไทยด้านสัญญาเช่าที่อยู่อาศัย
วิเคราะห์สัญญาเช่าที่ให้มาและตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น

สำหรับแต่ละรายการที่เจ้าของบ้านเรียกร้อง ให้ตรวจสอบ:
1. มีข้อกำหนดในสัญญาที่ระบุความรับผิดชอบของผู้เช่าหรือไม่
2. มีการเปิดเผยความเสียหายที่มีอยู่ก่อนหรือไม่
3. ข้อสัญญาใดที่ขัดต่อประกาศ สคบ. 2568 หรือ ป.พ.พ. มาตรา 546-571
4. จำนวนเงินประกัน วันเริ่มต้น-สิ้นสุดสัญญา ระยะเวลาแจ้ง ค่าเช่ารายเดือน"""

USER_PROMPT = """สัญญาเช่า:
{lease_text}

รายการที่เจ้าของบ้านเรียกร้อง:
{claim_list}

ตอบในรูปแบบ JSON นี้เท่านั้น:
{{
  "liability_map": [
    {{
      "item": "string",
      "tenant_liable": false,
      "contract_clause": "ข้อความจากสัญญา หรือ null",
      "clause_found": false,
      "pre_existing_disclosed": false,
      "notes": "string"
    }}
  ],
  "contract_summary": {{
    "deposit_amount_thb": 0,
    "deposit_months": 0,
    "lease_start": "YYYY-MM-DD",
    "lease_end": "YYYY-MM-DD",
    "notice_period_days": 0,
    "monthly_rent_thb": 0
  }},
  "unfair_clauses": [
    {{
      "clause_text": "string",
      "reason_void": "string"
    }}
  ]
}}"""

PARSER_PROMPT = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT),
    ("human", USER_PROMPT),
])
