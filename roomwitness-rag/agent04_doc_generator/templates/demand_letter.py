DEMAND_STRUCTURE = {
    "sections": [
        {
            "key": "date_recipient",
            "instruction": (
                "วันที่ในรูปแบบ วัน เดือน พ.ศ. และชื่อ-ที่อยู่ผู้รับ (เจ้าของบ้าน)"
            ),
        },
        {
            "key": "subject",
            "instruction": (
                "เรื่อง: เรียกร้องคืนเงินประกันการเช่า จำนวน {total_unlawful_thb} บาท"
            ),
        },
        {
            "key": "reference",
            "instruction": (
                "อ้างอิงสัญญาเช่า: ทรัพย์สิน {property_address} "
                "วันที่ {start_date} ถึง {end_date} เงินประกัน {deposit_thb} บาท"
            ),
        },
        {
            "key": "illegal_claims",
            "instruction": (
                "รายการการเรียกร้องที่ตัดสินว่า UNLAWFUL พร้อมเหตุผลทางกฎหมาย"
                "และกฎหมายที่อ้างอิงจากผลการวินิจฉัย"
            ),
        },
        {
            "key": "demand",
            "instruction": (
                "เรียกร้องให้คืนเงิน {total_unlawful_thb} บาท ภายใน 7 วัน "
                "มิเช่นนั้นจะยื่นเรื่องต่อ สคบ. และดำเนินคดีตามกฎหมายต่อไป"
            ),
        },
        {
            "key": "signature",
            "instruction": (
                "ลงชื่อ {tenant_name_th} ผู้เช่า พร้อมวันที่ในรูปแบบ พ.ศ."
            ),
        },
    ],
}
