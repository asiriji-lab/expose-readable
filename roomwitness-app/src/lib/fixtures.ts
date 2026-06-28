import type { FullAnalysis, GenerateDocsResult } from './types';

export const mockResult: FullAnalysis = {
  claims: [
    {
      claim: { item: 'สีผนัง / Wall paint', description: 'ผนังห้องนอนมีรอยสีหลุดและรอยขีดข่วน', amount_thb: 5000 },
      cv: {
        move_in_condition: 'ผนังสีขาวสะอาด ไม่มีรอยขีดข่วนหรือสีหลุด',
        move_out_condition: 'ผนังมีรอยสีหลุดเล็กน้อยที่มุมล่างซ้าย',
        wear_and_tear: true,
        likely_tenant_caused: false,
        low_visibility: false,
        supports_landlord_claim: 'NO',
        confidence: 0.82,
      },
      legal: {
        classification: 'UNLAWFUL',
        confidence: 0.88,
        dimensions: {
          pre_existence: 'ภาพถ่ายก่อนเข้าอยู่แสดงผนังสะอาด ไม่มีหลักฐานว่ารอยมีอยู่ก่อน',
          wear_and_tear: 'สีผนังเสื่อมสภาพตามอายุการใช้งานปกติ ถือเป็นการสึกหรอตามธรรมชาติ',
          proportionality: 'ค่าเรียกร้อง ฿5,000 ไม่สัดส่วนกับรอยเสียหายเล็กน้อยที่พบ',
          contractual_clarity: 'สัญญาไม่ได้ระบุชัดเจนว่าผู้เช่าต้องรับผิดชอบการซ่อมสีผนัง',
        },
        legal_basis: [
          {
            section: 'CCC §563',
            source: 'CCC',
            excerpt: 'ผู้เช่าต้องรับผิดชอบความเสียหายที่เกินกว่าการสึกหรอตามปกติเท่านั้น',
            favors: 'TENANT',
          },
          {
            section: 'OCPB 2568 ข้อ 5',
            source: 'OCPB',
            excerpt: 'การหักเงินประกันต้องมีหลักฐานชัดเจนว่าความเสียหายเกิดจากผู้เช่า',
            favors: 'TENANT',
          },
        ],
        summary_th: 'การหักค่าสีผนังนี้ผิดกฎหมาย เนื่องจากเป็นการสึกหรอตามปกติและค่าเรียกร้องไม่สัดส่วน',
      },
    },
    {
      claim: { item: 'รอยบนพื้น / Floor scratch', description: 'พื้นไม้ลามิเนตมีรอยขีดข่วนบริเวณห้องนั่งเล่น', amount_thb: 3000 },
      cv: {
        move_in_condition: 'พื้นลามิเนตสภาพดี มีรอยสึกเล็กน้อยจากการใช้งานปกติ',
        move_out_condition: 'พบรอยขีดข่วนลึกบริเวณกลางห้อง อาจเกิดจากการเลื่อนเฟอร์นิเจอร์',
        wear_and_tear: false,
        likely_tenant_caused: true,
        low_visibility: false,
        supports_landlord_claim: 'PARTIAL',
        confidence: 0.65,
      },
      legal: {
        classification: 'DISPUTED',
        confidence: 0.71,
        dimensions: {
          pre_existence: 'ภาพก่อนเข้าอยู่แสดงรอยสึกเล็กน้อยอยู่แล้ว ไม่ชัดเจนว่ารอยลึกมีก่อนหรือไม่',
          wear_and_tear: 'รอยขีดข่วนลึกอาจเกินกว่าการสึกหรอตามปกติ แต่ต้องพิจารณาอายุพื้น',
          proportionality: 'ค่าเรียกร้อง ฿3,000 อาจสมเหตุสมผลหากพื้นต้องเปลี่ยนบางส่วน',
          contractual_clarity: 'สัญญาระบุว่าผู้เช่าต้องดูแลรักษาพื้น แต่ไม่ได้กำหนดมาตรฐานชัดเจน',
        },
        legal_basis: [
          {
            section: 'CCC §540',
            source: 'CCC',
            excerpt: 'ผู้เช่าต้องส่งคืนทรัพย์สินในสภาพเดิม เว้นแต่ความเสียหายจากการใช้งานตามปกติ',
            favors: 'LANDLORD',
          },
        ],
        summary_th: 'กรณีนี้โต้แย้งได้ เนื่องจากไม่ชัดเจนว่ารอยพื้นเกิดก่อนหรือหลังการเช่า ควรเจรจาต่อรอง',
      },
    },
    {
      claim: { item: 'ทำความสะอาด / Deep cleaning', description: 'ค่าทำความสะอาดห้องพักหลังออก', amount_thb: 2000 },
      cv: {
        move_in_condition: 'ห้องสะอาด ผ่านการทำความสะอาดก่อนเข้าอยู่',
        move_out_condition: 'ห้องสกปรกมาก มีคราบสกปรกทั่วไป ต้องการทำความสะอาดอย่างละเอียด',
        wear_and_tear: false,
        likely_tenant_caused: true,
        low_visibility: false,
        supports_landlord_claim: 'YES',
        confidence: 0.91,
      },
      legal: {
        classification: 'LAWFUL',
        confidence: 0.85,
        dimensions: {
          pre_existence: 'ห้องสะอาดเมื่อเข้าอยู่ ผู้เช่ามีหน้าที่ส่งคืนในสภาพสะอาด',
          wear_and_tear: 'ความสกปรกไม่ใช่การสึกหรอตามปกติ เป็นความรับผิดชอบของผู้เช่า',
          proportionality: 'ค่าทำความสะอาด ฿2,000 สมเหตุสมผลสำหรับห้องขนาดปกติ',
          contractual_clarity: 'สัญญาระบุชัดเจนว่าผู้เช่าต้องส่งคืนห้องในสภาพสะอาด',
        },
        legal_basis: [
          {
            section: 'CCC §563',
            source: 'CCC',
            excerpt: 'ผู้เช่าต้องส่งคืนทรัพย์สินในสภาพเรียบร้อยตามที่ตกลงในสัญญา',
            favors: 'LANDLORD',
          },
        ],
        summary_th: 'ค่าทำความสะอาดนี้ถูกกฎหมาย เนื่องจากสัญญาระบุชัดเจนและมีหลักฐานภาพถ่ายสนับสนุน',
      },
    },
  ],
  cv_summary: {
    total_claims: 3,
    supported_claims: 1,
    disputed_claims: 1,
    partial_claims: 1,
    total_disputed_amount: 8000,
  },
  evidence_summary: {
    landlord_promises: [
      'เจ้าของบ้านสัญญาทาง LINE ว่าจะคืนเงินประกันภายใน 7 วันหลังออก',
      'เจ้าของบ้านยืนยันว่าไม่มีค่าเสียหายก่อนออก',
    ],
    tenant_promises: ['ผู้เช่าแจ้งว่าจะทำความสะอาดก่อนออก'],
    deposit_mentions: ['เงินมัดจำ ฿20,000 โอนเมื่อวันที่ 1 มกราคม 2568'],
    platforms: ['LINE'],
  },
  images_used: { move_in: 'move_in.jpg', move_out: 'move_out.jpg' },
};

export const mockDocsResult: GenerateDocsResult = {
  case_id: 'RW-MOCK-0001',
  documents: {
    ocpb_complaint: {
      s3_url: 's3://roomwitness/mock/ocpb_complaint.pdf',
      download_url: 'https://example.com/mock/ocpb_complaint.pdf',
      generated_at: '2026-06-28T10:00:00Z',
      page_count: 3,
    },
    deposit_demand: {
      s3_url: 's3://roomwitness/mock/deposit_demand.pdf',
      download_url: 'https://example.com/mock/deposit_demand.pdf',
      generated_at: '2026-06-28T10:00:00Z',
      page_count: 2,
    },
    evidence_summary: {
      s3_url: 's3://roomwitness/mock/evidence_summary.pdf',
      download_url: 'https://example.com/mock/evidence_summary.pdf',
      generated_at: '2026-06-28T10:00:00Z',
      page_count: 4,
    },
  },
  generation_time_seconds: 6.2,
  total_unlawful_amount_thb: 8000,
};
