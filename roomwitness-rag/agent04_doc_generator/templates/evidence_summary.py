EVIDENCE_STRUCTURE = {
    "sections": [
        {
            "key": "cover",
            "instruction": (
                "หมายเลขคดี {case_id} ชื่อผู้เช่า {tenant_name_th} "
                "ที่อยู่ทรัพย์สิน {property_address} วันที่สร้าง"
            ),
        },
        {
            "key": "verdict_table",
            "instruction": (
                "ตารางแสดงรายการเรียกร้องทั้งหมด: รายการ คำตัดสิน จำนวนเงิน "
                "กฎหมายที่อ้างอิง สรุปเหตุผล"
            ),
        },
        {
            "key": "photo_evidence",
            "instruction": (
                "รายการภาพถ่ายแต่ละคู่ (วันเข้า-วันออก) "
                "พร้อมคำอธิบายและผลการตรวจสอบ CV"
            ),
        },
        {
            "key": "legal_references",
            "instruction": (
                "ข้อความเต็มของกฎหมายทุกข้อที่ถูกอ้างอิงในคดีนี้"
            ),
        },
    ],
}
