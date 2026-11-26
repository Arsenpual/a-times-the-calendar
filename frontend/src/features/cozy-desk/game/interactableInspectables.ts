import type {
  GreenCarState,
  InspectableObject,
  InteractableId,
  InteractableObject,
  MinaNpcState,
  RoomZone,
} from '../types/game';
import {
  INTERACTABLES,
  getGreenCarInteractable,
  getRoomZone,
  isPointInsideCar,
} from './houseMap';

export interface InspectDynamicContext {
  greenCar?: Pick<GreenCarState, 'x' | 'y' | 'angle' | 'isDriving' | 'speed'> | null;
  mina?: Pick<MinaNpcState, 'x' | 'y'> | null;
}

interface InteractableInspectMeta {
  areaLabel: string;
  name: string;
  detail: string;
  priority: number;
}

const ZONE_LABELS: Record<RoomZone, string> = {
  living: 'ห้องนั่งเล่น',
  office: 'ห้องทำงาน',
  kitchen: 'ห้องครัว',
  bathroom: 'ห้องน้ำ',
  entryway: 'โถงทางเข้า',
  bedroom: 'ห้องนอนใหญ่',
  garage: 'โรงจอดรถ',
  gym: 'ห้องออกกำลังกาย',
};

/**
 * Exhaustive hover-inspection metadata for every InteractableId in Cozy Desk.
 * Hovering any interactable for 2 seconds reveals this card, matching the bathroom inspect UX.
 */
export const INTERACTABLE_INSPECT_METADATA: Record<InteractableId, InteractableInspectMeta> = {
  coffee: {
    areaLabel: 'ห้องนั่งเล่น · พักผ่อน',
    name: 'โต๊ะกาแฟ',
    detail: 'โต๊ะกาแฟไม้กลางห้องนั่งเล่นพร้อมแก้วกาแฟอุ่นๆ — กด E หรือคลิกเพื่อจิบกาแฟเติมความสดชื่นก่อนทำงาน',
    priority: 18,
  },
  sofa: {
    areaLabel: 'ห้องนั่งเล่น · พักผ่อน',
    name: 'โซฟาห้องนั่งเล่น',
    detail: 'โซฟาผ้านุ่มสำหรับเอนหลังพักผ่อน พร้อมกิจกรรมจิบชา อ่านหนังสือพิมพ์ และกดรีโมตทีวี — กด E หรือคลิกเพื่อนั่งพัก',
    priority: 18,
  },
  window: {
    areaLabel: 'ห้องนั่งเล่น · บรรยากาศ',
    name: 'หน้าต่างรับแสง',
    detail: 'หน้าต่างบานใหญ่รับแสงธรรมชาติ — กด E หรือคลิกเพื่อเปลี่ยนช่วงเวลาแสงระหว่าง เช้า · บ่าย · ค่ำ',
    priority: 18,
  },
  bookshelf: {
    areaLabel: 'ห้องนั่งเล่น · มุมอ่านหนังสือ',
    name: 'ชั้นหนังสือ',
    detail: 'ชั้นหนังสือไม้รวบรวมหนังสือและโน้ตแรงบันดาลใจ — กด E หรือคลิกเพื่อหยิบอ่านข้อคิดดีๆ ประจำวัน',
    priority: 18,
  },
  clock: {
    areaLabel: 'ห้องนั่งเล่น · Activity Mode',
    name: 'นาฬิกาลูกตุ้มโบราณ',
    detail: 'นาฬิกาลูกตุ้มโบราณเชื่อมต่อกับ Activity Mode — ตีระฆังเตือนพร้อมโชว์ชื่อกิจกรรมเมื่อถึงเวลาเริ่ม และกด E หรือคลิกเพื่อเช็กกิจกรรมถัดไป',
    priority: 18,
  },
  tv: {
    areaLabel: 'ห้องนั่งเล่น · YouTube',
    name: 'ทีวีห้องพักผ่อน',
    detail: 'สมาร์ตทีวีหน้าโซฟาที่เชื่อมต่อฟีด YouTube — กด E หรือคลิกเพื่อเปิดชมวิดีโอและช่องโปรด',
    priority: 18,
  },
  pinboard: {
    areaLabel: 'ห้องทำงาน · Google Tasks',
    name: 'กระดานโน้ตห้องทำงาน',
    detail: 'กระดานปักหมุดเชื่อมต่อ Google Tasks และแสดงรายการงานที่มีน่าช่วยปักไว้ — กด E หรือคลิกเพื่อเปิดจัดการงาน',
    priority: 18,
  },
  workdesk: {
    areaLabel: 'ห้องทำงาน · โต๊ะหลัก',
    name: 'โต๊ะทำงานส่วนตัว',
    detail: 'โต๊ะคอมพิวเตอร์หลักสำหรับโฟกัสงาน — กด E หรือคลิกเพื่อนั่งหน้าจอและเปิดพื้นที่ทำงานร่วมกับผู้ช่วย AI',
    priority: 18,
  },
  drive_table: {
    areaLabel: 'ห้องทำงาน · Google Drive',
    name: 'โต๊ะเอกสารกลางห้อง',
    detail: 'โต๊ะประชุมกลางห้องที่เชื่อมต่อไฟล์จาก Google Drive — กด E หรือคลิกเพื่อเปิดดู ค้นหา และจัดการเอกสาร',
    priority: 18,
  },
  mina_desk: {
    areaLabel: 'ห้องทำงาน · ผู้ช่วย AI',
    name: 'มีน่า (ผู้ช่วย AI)',
    detail: 'โต๊ะและผู้ช่วย AI ส่วนตัวที่ช่วยตอบคำถาม ระดมไอเดีย ร่างเอกสาร และเดินไปปักหมุดงานบนกระดาน — กด E หรือคลิกเพื่อคุยงาน',
    priority: 18,
  },
  antigravity_desk: {
    areaLabel: 'ห้องทำงาน · Localhost Agent',
    name: 'สถานี Antigravity (Localhost Agent)',
    detail: 'คอนโซลผู้ช่วยสายโค้ด เวิร์กสเปซ และสถาปัตยกรรมระบบ — เดินเข้าใกล้แล้วกด E หรือคลิกเพื่อเปิดคอนโซล Antigravity',
    priority: 18,
  },
  ai_studio_desk: {
    areaLabel: 'ห้องทำงาน · สถานี AI Lab',
    name: 'สถานี Google AI Studio',
    detail: 'โต๊ะทดลอง Prompt Lab, App Builder และ JSON Schema พร้อมตัวละครผู้ช่วย Google AI Studio — เดินเข้าใกล้แล้วกด E หรือคลิกเพื่อเปิดเวิร์กเบนช์',
    priority: 18,
  },
  dining_chair_nw: {
    areaLabel: 'ห้องครัว · โต๊ะอาหาร',
    name: 'เก้าอี้ไม้โอ๊ค (ฝั่งบนซ้าย)',
    detail: 'เก้าอี้ไม้โอ๊คเบาะครีมนุ่ม สามารถคลิกหรือกด E เพื่อนั่งร่วมโต๊ะอาหารได้',
    priority: 20,
  },
  dining_chair_ne: {
    areaLabel: 'ห้องครัว · โต๊ะอาหาร',
    name: 'เก้าอี้ไม้โอ๊ค (ฝั่งบนขวา)',
    detail: 'เก้าอี้ไม้โอ๊คเบาะครีมนุ่ม สามารถคลิกหรือกด E เพื่อนั่งร่วมโต๊ะอาหารได้',
    priority: 20,
  },
  dining_chair_sw: {
    areaLabel: 'ห้องครัว · โต๊ะอาหาร',
    name: 'เก้าอี้ไม้โอ๊ค (ฝั่งล่างซ้าย)',
    detail: 'เก้าอี้ไม้โอ๊คเบาะครีมนุ่ม สามารถคลิกหรือกด E เพื่อนั่งร่วมโต๊ะอาหารได้',
    priority: 20,
  },
  dining_chair_se: {
    areaLabel: 'ห้องครัว · โต๊ะอาหาร',
    name: 'เก้าอี้ไม้โอ๊ค (ฝั่งล่างขวา)',
    detail: 'เก้าอี้ไม้โอ๊คเบาะครีมนุ่ม สามารถคลิกหรือกด E เพื่อนั่งร่วมโต๊ะอาหารได้',
    priority: 20,
  },
  dining_table: {
    areaLabel: 'ห้องครัว · โซนรับประทานอาหาร',
    name: 'โต๊ะอาหารไม้โอ๊คครอบครัว (4 ที่นั่ง)',
    detail: 'โต๊ะอาหารครอบครัวปูผ้าคาดโต๊ะสีแดงคริสต์มาส พร้อมจานเซรามิก 4 ที่นั่งและไก่งวงอบตัวใหญ่กลางโต๊ะ สามารถนั่งได้ครบทั้ง 4 เก้าอี้',
    priority: 12,
  },
  mailbox: {
    areaLabel: 'ริมถนนหน้าบ้าน · Gmail',
    name: 'ตู้ไปรษณีย์ริมถนน (Gmail)',
    detail: 'เชื่อมต่อกับ Google Gmail API เมื่อมีอีเมลใหม่ธงแดงจะยกขึ้นพร้อมแจ้งเตือน เดินมาแล้วกด E หรือคลิกที่ตู้ไปรษณีย์เพื่อเปิดอ่านได้เลย',
    priority: 22,
  },
  sleep_log: {
    areaLabel: 'ห้องนอนใหญ่ · ภารกิจประจำวัน',
    name: 'โต๊ะข้างเตียง · สมุดบันทึกการนอน (.json)',
    detail: 'อัปโหลดภาพสถิติการนอนจากเครื่องหรือเลือกจาก Google Drive (เช่น Huawei Health) เพื่อเก็บสะสมเป็นไฟล์ .json รายวัน แล้วส่งให้มีน่าสรุปภาพรวมทั้งหมดทางแชทผู้ช่วย AI',
    priority: 22,
  },
  bedroom_bed: {
    areaLabel: 'ห้องนอนใหญ่ · พักผ่อน',
    name: 'เตียงคิงไซส์ (ห้องนอนใหญ่)',
    detail: 'เตียงคิงไซส์นุ่มสบาย — กด E หรือคลิกเพื่อเอนตัวลงนอน ปิดไฟห้องนอน และเปลี่ยนวิวนอกหน้าต่างเป็นตอนกลางคืนอัตโนมัติ',
    priority: 16,
  },
  porch_plants: {
    areaLabel: 'โถงทางเข้า · ภารกิจประจำวัน',
    name: 'กระถางต้นไม้ดอก 5 ต้น',
    detail: 'กระถางดินเผาปลูกต้นไม้ดอกสีสด 5 ต้นริมระเบียงโถงทางเข้า — กด E หรือคลิกเพื่อรดน้ำอย่างน้อยวันละ 1 ครั้ง (รีเซ็ตอัตโนมัติตอนเที่ยงคืน 00:00 น.)',
    priority: 22,
  },
  green_car: {
    areaLabel: 'โรงจอดรถ · พาหนะ',
    name: 'รถคันสีเขียว (ขับได้)',
    detail: 'รถแฮตช์แบ็กสีเขียวที่ขับออกจากโรงจอดรถไปตามถนนหน้าบ้านได้ — กด E หรือคลิกเพื่อขึ้นขับ (W/S เดินหน้า–ถอยหลัง · A/D เลี้ยว · Space เบรก · H บีบแตร)',
    priority: 24,
  },
  gym_barbell: {
    areaLabel: 'ห้องออกกำลังกาย · เวทเทรนนิง',
    name: 'แร็คสควอทและบาร์เบลโอลิมปิก',
    detail: 'ชุดแร็คยกน้ำหนักพร้อมบาร์เบลและแผ่นน้ำหนักโอลิมปิกฝั่งซ้ายบน — กด E หรือคลิกเพื่อยกน้ำหนักออกกำลังกาย',
    priority: 20,
  },
};

/**
 * Interactables already represented by bespoke entries in inspectableObjects.ts
 * (kept there so specialized child props like the Christmas turkey keep priority).
 */
const EXPLICITLY_DEFINED_INTERACTABLE_IDS = new Set<InteractableId>([
  'ai_studio_desk',
  'dining_chair_nw',
  'dining_chair_ne',
  'dining_chair_sw',
  'dining_chair_se',
  'dining_table',
  'mailbox',
  'sleep_log',
  'porch_plants',
]);

export function buildInspectableFromInteractable(item: InteractableObject): InspectableObject {
  const meta = INTERACTABLE_INSPECT_METADATA[item.id];
  return {
    id: `interactable_${item.id}`,
    zone: item.zone,
    areaLabel: meta?.areaLabel ?? `${ZONE_LABELS[item.zone] ?? 'บ้าน'} · โต้ตอบได้`,
    name: meta?.name ?? item.label,
    detail: meta?.detail ?? `กด E หรือคลิกเพื่อ${item.actionLabel}`,
    x: Math.round(item.x),
    y: Math.round(item.y),
    w: Math.round(item.w),
    h: Math.round(item.h),
    priority: meta?.priority ?? 18,
  };
}

export const INTERACTABLE_INSPECTABLES: InspectableObject[] = INTERACTABLES.filter(
  (item) => !EXPLICITLY_DEFINED_INTERACTABLE_IDS.has(item.id)
).map(buildInspectableFromInteractable);

export function getDynamicInspectablesAtPoint(
  wx: number,
  wy: number,
  dynamicContext?: InspectDynamicContext
): InspectableObject[] {
  const hits: InspectableObject[] = [];

  const car = dynamicContext?.greenCar;
  if (car && (!car.isDriving || Math.abs(car.speed) <= 8) && isPointInsideCar(wx, wy, car, 4)) {
    const carBox = getGreenCarInteractable(car);
    const carZone = getRoomZone(car.x, car.y);
    const carMeta = INTERACTABLE_INSPECT_METADATA.green_car;
    hits.push({
      id: 'interactable_green_car',
      zone: carZone,
      areaLabel: carZone === 'garage' ? carMeta.areaLabel : 'หน้าบ้าน · พาหนะ',
      name: carMeta.name,
      detail: carMeta.detail,
      x: carBox.x,
      y: carBox.y,
      w: carBox.w,
      h: carBox.h,
      priority: carMeta.priority,
    });
  }

  const mina = dynamicContext?.mina;
  if (mina && Math.hypot(wx - mina.x, wy - (mina.y - 10)) <= 20) {
    const minaMeta = INTERACTABLE_INSPECT_METADATA.mina_desk;
    hits.push({
      id: 'interactable_mina_desk',
      zone: getRoomZone(mina.x, mina.y),
      areaLabel: minaMeta.areaLabel,
      name: minaMeta.name,
      detail: minaMeta.detail,
      x: Math.round(mina.x - 16),
      y: Math.round(mina.y - 28),
      w: 32,
      h: 36,
      priority: 22,
    });
  }

  return hits;
}
