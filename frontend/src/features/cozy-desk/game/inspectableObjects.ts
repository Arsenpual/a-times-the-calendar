import type { InspectableObject } from '../types/game';
import {
  AISTUDIO_DESK_RECT,
  BATH_DOOR_ROW_END,
  BATH_DOOR_ROW_START,
  KITCHEN_DINING_RECT,
  LOWER_FLOOR_ROW_START,
  MAILBOX_RECT,
  MID_WALL_ROW,
  PORCH_PLANTER_RECT,
  SLEEP_STATION_RECT,
  TILE,
  WEST_DIVIDER_COL,
} from './houseMap';

const WALL_FACE_Y = MID_WALL_ROW * TILE + 18;

// Mirror & wall sconce coordinates (north-east of west Bathroom: cols 5.7..8.2)
const MIR_X = Math.round(5.72 * TILE);
const MIR_Y = WALL_FACE_Y + 4;
const MIR_W = 80;
const MIR_H = 30;

// Rain shower pipe anchor (north-west inside glass shower: col 2.3)
const SH_PIPE_X = Math.round(2.3 * TILE);

// Vanity cabinet coordinates (north-east of west Bathroom: cols 5.3..8.65)
const VANITY_X = Math.round(5.3 * TILE);
const VANITY_Y = Math.round(13.85 * TILE);
const VANITY_W = Math.round(3.35 * TILE);
const VANITY_H = Math.round(1.25 * TILE);

// Shower wet-zone & glass enclosure coordinates (NW corner: cols 1.02..4.48, rows 14..18.02)
const SHOWER_FLOOR_X = Math.round(1.02 * TILE);
const SHOWER_FLOOR_Y = LOWER_FLOOR_ROW_START * TILE;
const SHOWER_FLOOR_W = Math.round(4.48 * TILE) - SHOWER_FLOOR_X;
const SHOWER_FLOOR_H = Math.round(18.02 * TILE) - SHOWER_FLOOR_Y;

const GLASS_LEFT_X = Math.round(1.02 * TILE);
const GLASS_X = Math.round(4.35 * TILE); // East glass partition
const GLASS_TOP_Y = Math.round(13.9 * TILE);
const GLASS_DOOR_TOP_Y = Math.round(16.12 * TILE);
const GLASS_BOT_Y = Math.round(17.98 * TILE);

const DRAIN_X = Math.round(2.55 * TILE);
const DRAIN_Y = Math.round(15.9 * TILE);

// Linen cabinet (SE), toilet (south-center), washing machine (SW) coordinates
const LINEN_X = Math.round(7.55 * TILE);
const LINEN_Y = Math.round(19.95 * TILE);
const LINEN_W = Math.round(1.35 * TILE);
const LINEN_H = Math.round(1.85 * TILE);

const TOILET_X = Math.round(5.35 * TILE);
const TOILET_Y = Math.round(20.35 * TILE);

const WASHER_X = Math.round(1.1 * TILE);
const WASHER_Y = Math.round(19.95 * TILE);
const WASHER_W = Math.round(1.6 * TILE);
const WASHER_H = Math.round(1.85 * TILE);

/**
 * Bathroom inspectable objects (hover 2 seconds to reveal name & details).
 * Higher `priority` wins when smaller countertop/nested props overlap a larger fixture.
 */
export const BATHROOM_INSPECTABLES: InspectableObject[] = [
  // --- North wall fixtures ---
  {
    id: 'bath_sconce_left',
    zone: 'bathroom',
    areaLabel: 'ห้องน้ำ · ผนัง',
    name: 'โคมไฟผนังข้างกระจก',
    detail: 'โคมไฟกิ่งสีทองเหลืองให้แสงสว่างอุ่นๆ บริเวณอ่างล้างหน้า',
    x: MIR_X - 9,
    y: MIR_Y + 5,
    w: 7,
    h: 14,
    priority: 22,
  },
  {
    id: 'bath_sconce_right',
    zone: 'bathroom',
    areaLabel: 'ห้องน้ำ · ผนัง',
    name: 'โคมไฟผนังข้างกระจก',
    detail: 'โคมไฟกิ่งสีทองเหลืองให้แสงสว่างอุ่นๆ บริเวณอ่างล้างหน้า',
    x: MIR_X + MIR_W + 2,
    y: MIR_Y + 5,
    w: 7,
    h: 14,
    priority: 22,
  },
  {
    id: 'bath_mirror',
    zone: 'bathroom',
    areaLabel: 'ห้องน้ำ · ผนัง',
    name: 'กระจกเงาและชั้นวางกระจก',
    detail: 'กระจกกรอบไม้โอ๊คบานใหญ่พร้อมหิ้งกระจกบางหน้าอ่างล้างหน้า',
    x: MIR_X,
    y: MIR_Y,
    w: MIR_W,
    h: MIR_H + 4,
    priority: 16,
  },
  {
    id: 'bath_vent_window',
    zone: 'bathroom',
    areaLabel: 'ห้องน้ำ · โซนอาบน้ำ',
    name: 'หน้าต่างบานฝ้าระบายอากาศ',
    detail: 'หน้าต่างกระจกฝ้าช่วยระบายความชื้นและรับแสงธรรมชาติ',
    x: Math.round(3.05 * TILE),
    y: WALL_FACE_Y + 5,
    w: 36,
    h: 22,
    priority: 16,
  },
  {
    id: 'bath_rain_shower',
    zone: 'bathroom',
    areaLabel: 'ห้องน้ำ · โซนอาบน้ำ',
    name: 'ชุดฝักบัวเรนชาวเวอร์อัตโนมัติ',
    detail: 'ฝักบัวก้านแข็งโครเมียมพร้อมเซนเซอร์ปล่อยสายน้ำอุ่นอัตโนมัติเมื่อเดินเข้าโซนเปียก',
    x: SH_PIPE_X - 8,
    y: WALL_FACE_Y + 4,
    w: 24,
    h: 35,
    priority: 22,
  },

  // --- Vanity counter & tabletop props ---
  {
    id: 'bath_vanity_fern',
    zone: 'bathroom',
    areaLabel: 'ห้องน้ำ · เคาน์เตอร์',
    name: 'กระถางต้นเฟิร์นจิ๋ว',
    detail: 'ต้นเฟิร์นขนาดเล็กในกระถางดินเผาประดับมุมอ่างล้างหน้า',
    x: VANITY_X + 5,
    y: VANITY_Y + 2,
    w: 14,
    h: 19,
    priority: 25,
  },
  {
    id: 'bath_hand_towels',
    zone: 'bathroom',
    areaLabel: 'ห้องน้ำ · เคาน์เตอร์',
    name: 'ผ้าขนหนูเช็ดมือม้วน',
    detail: 'ผ้าขนหนูสีขาวม้วนวางไว้สำหรับเช็ดมือข้างอ่าง',
    x: VANITY_X + 20,
    y: VANITY_Y + 10,
    w: 12,
    h: 13,
    priority: 25,
  },
  {
    id: 'bath_sink_basin',
    zone: 'bathroom',
    areaLabel: 'ห้องน้ำ · เคาน์เตอร์',
    name: 'อ่างล้างหน้าและก๊อกน้ำ',
    detail: 'อ่างล้างหน้าเซรามิกสีขาวแบบฝังเคาน์เตอร์พร้อมก๊อกโครเมียม',
    x: VANITY_X + 37,
    y: VANITY_Y + 3,
    w: 34,
    h: 22,
    priority: 24,
  },
  {
    id: 'bath_hand_soap',
    zone: 'bathroom',
    areaLabel: 'ห้องน้ำ · เคาน์เตอร์',
    name: 'ขวดปั๊มสบู่เหลวล้างมือ',
    detail: 'ขวดสบู่เหลวล้างมือหัวปั๊มวางสะดวกข้างอ่างล้างหน้า',
    x: VANITY_X + 76,
    y: VANITY_Y + 6,
    w: 9,
    h: 13,
    priority: 25,
  },
  {
    id: 'bath_toothbrush_cup',
    zone: 'bathroom',
    areaLabel: 'ห้องน้ำ · เคาน์เตอร์',
    name: 'แก้วใส่แปรงสีฟัน',
    detail: 'แก้วเซรามิกใส่แปรงสีฟันสีฟ้าและสีชมพู',
    x: VANITY_X + 89,
    y: VANITY_Y + 5,
    w: 10,
    h: 15,
    priority: 25,
  },
  {
    id: 'bath_vanity_cabinet',
    zone: 'bathroom',
    areaLabel: 'ห้องน้ำ · โซนแห้ง',
    name: 'เคาน์เตอร์อ่างล้างหน้าไม้โอ๊ค',
    detail: 'ตู้เก็บของ 3 บานท็อปหินอ่อนสีขาวสำหรับวางของใช้ประจำวัน',
    x: VANITY_X,
    y: VANITY_Y,
    w: VANITY_W,
    h: VANITY_H,
    priority: 10,
  },

  // --- Shower room interior & glass enclosure ---
  {
    id: 'bath_shower_caddy',
    zone: 'bathroom',
    areaLabel: 'ห้องน้ำ · โซนอาบน้ำ',
    name: 'ชั้นวางแชมพูและครีมอาบน้ำ',
    detail: 'ชั้นกระจกเข้ามุมวางขวดแชมพู ครีมอาบน้ำ และฟองน้ำอาบน้ำ',
    x: Math.round(1.05 * TILE),
    y: Math.round(14.0 * TILE),
    w: 22,
    h: 22,
    priority: 22,
  },
  {
    id: 'bath_soap_holder',
    zone: 'bathroom',
    areaLabel: 'ห้องน้ำ · โซนอาบน้ำ',
    name: 'ที่เก็บสบู่และสบู่ก้อน',
    detail: 'ถาดวางสบู่โครเมียมติดผนังสำหรับหยิบสบู่มาถูตัวและวางเก็บกลับที่เดิม',
    x: Math.round(1.1 * TILE),
    y: Math.round(14.9 * TILE),
    w: 22,
    h: 16,
    priority: 24,
  },
  {
    id: 'bath_shower_drain',
    zone: 'bathroom',
    areaLabel: 'ห้องน้ำ · โซนอาบน้ำ',
    name: 'ตะแกรงท่อระบายน้ำ',
    detail: 'ฝาท่อระบายน้ำสแตนเลสทรงสี่เหลี่ยมกลางพื้นห้องอาบน้ำ',
    x: DRAIN_X - 8,
    y: DRAIN_Y - 8,
    w: 16,
    h: 16,
    priority: 20,
  },
  {
    id: 'bath_shower_glass_east',
    zone: 'bathroom',
    areaLabel: 'ห้องน้ำ · โซนอาบน้ำ',
    name: 'ฉากกั้นกระจกนิรภัยทึบแสงอัตโนมัติ',
    detail: 'แผงกระจกนิรภัยแบ่งโซนเปียก-แห้งที่จะปรับเป็นกระจกทึบบังสายตาเฉพาะตอนอาบน้ำ',
    x: GLASS_X - 2,
    y: GLASS_TOP_Y,
    w: 11,
    h: GLASS_DOOR_TOP_Y - GLASS_TOP_Y,
    priority: 18,
  },
  {
    id: 'bath_shower_door',
    zone: 'bathroom',
    areaLabel: 'ห้องน้ำ · โซนอาบน้ำ',
    name: 'ประตูบานเลื่อนกระจกทึบอัตโนมัติ',
    detail: 'ประตูกระจกบานเลื่อนที่จะเลื่อนปิดและปรับทึบป้องกันภาพเปลือยอัตโนมัติขณะอาบน้ำ',
    x: GLASS_X - 2,
    y: GLASS_DOOR_TOP_Y,
    w: 10,
    h: GLASS_BOT_Y - GLASS_DOOR_TOP_Y,
    priority: 18,
  },
  {
    id: 'bath_shower_glass_south',
    zone: 'bathroom',
    areaLabel: 'ห้องน้ำ · โซนอาบน้ำ',
    name: 'ผนังกระจกและธรณีกั้นน้ำ',
    detail: 'กระจกนิรภัยและขอบหินอ่อนกันน้ำไหลออกนอกโซนเปียก ปรับทึบอัตโนมัติเมื่ออาบน้ำ',
    x: GLASS_LEFT_X,
    y: GLASS_BOT_Y - 16,
    w: GLASS_X + 7 - GLASS_LEFT_X,
    h: 24,
    priority: 18,
  },
  {
    id: 'bath_shower_zone',
    zone: 'bathroom',
    areaLabel: 'ห้องน้ำ · โซนอาบน้ำ',
    name: 'โซนห้องอาบน้ำอัตโนมัติ (พื้นที่เปียก)',
    detail: 'เมื่อเดินเข้าไปน้ำฝักบัวจะไหลอัตโนมัติ พร้อมปิดกระจกทึบป้องกันภาพเปลือยให้เห็นลางๆ ขณะหยิบสบู่ ถูสบู่ และเก็บสบู่',
    x: SHOWER_FLOOR_X,
    y: SHOWER_FLOOR_Y,
    w: SHOWER_FLOOR_W,
    h: SHOWER_FLOOR_H,
    priority: 5,
  },

  // --- Floor mats, scale & doorway ---
  {
    id: 'bath_vanity_mat',
    zone: 'bathroom',
    areaLabel: 'ห้องน้ำ · โซนแห้ง',
    name: 'พรมเช็ดเท้าหน้าอ่างล้างหน้า',
    detail: 'พรมผ้าทอสีครีมนุ่มวางหน้าเคาน์เตอร์อ่างล้างหน้า',
    x: Math.round(5.95 * TILE),
    y: Math.round(15.22 * TILE),
    w: 64,
    h: 18,
    priority: 12,
  },
  {
    id: 'bath_shower_mat',
    zone: 'bathroom',
    areaLabel: 'ห้องน้ำ · โซนแห้ง',
    name: 'พรมเช็ดเท้าหน้าห้องอาบน้ำ',
    detail: 'พรมซับน้ำสีเขียวเซจวางรับเท้าหน้าประตูห้องอาบน้ำ',
    x: Math.round(4.82 * TILE),
    y: Math.round(16.35 * TILE),
    w: 38,
    h: 45,
    priority: 12,
  },
  {
    id: 'bath_scale',
    zone: 'bathroom',
    areaLabel: 'ห้องน้ำ · โซนแห้ง',
    name: 'เครื่องชั่งน้ำหนักดิจิทัล',
    detail: 'เครื่องชั่งน้ำหนักสีขาวทรงมินิมอลพร้อมหน้าจอแสดงผลดิจิทัล',
    x: Math.round(6.75 * TILE),
    y: Math.round(18.8 * TILE),
    w: 22,
    h: 20,
    priority: 16,
  },
  {
    id: 'bath_doorway',
    zone: 'bathroom',
    areaLabel: 'ห้องน้ำ · ทางเข้า',
    name: 'ประตูทางเข้าห้องน้ำ',
    detail: 'ธรณีประตูหินอ่อนเชื่อมต่อจากห้องครัวเข้าสู่ห้องน้ำ',
    x: WEST_DIVIDER_COL * TILE + 8,
    y: BATH_DOOR_ROW_START * TILE,
    w: 16,
    h: (BATH_DOOR_ROW_END - BATH_DOOR_ROW_START + 1) * TILE,
    priority: 10,
  },

  // --- East & South wall fixtures ---
  {
    id: 'bath_towel_rack',
    zone: 'bathroom',
    areaLabel: 'ห้องน้ำ · โซนแห้ง',
    name: 'ราวแขวนผ้าเช็ดตัวติดผนัง',
    detail: 'ราวแขวนไม้พร้อมผ้าเช็ดตัวสีครีมและสีเขียวเซจ',
    x: Math.round(8.2 * TILE),
    y: Math.round(18.35 * TILE),
    w: 20,
    h: 38,
    priority: 16,
  },
  {
    id: 'bath_cabinet_fern',
    zone: 'bathroom',
    areaLabel: 'ห้องน้ำ · ของตกแต่ง',
    name: 'กระถางต้นเฟิร์นประดับตู้',
    detail: 'ต้นเฟิร์นชอบความชื้นวางตกแต่งบนมุมตู้เก็บผ้า',
    x: LINEN_X + 27,
    y: LINEN_Y - 6,
    w: 11,
    h: 14,
    priority: 22,
  },
  {
    id: 'bath_linen_cabinet',
    zone: 'bathroom',
    areaLabel: 'ห้องน้ำ · โซนแห้ง',
    name: 'ตู้ไม้เก็บผ้าเช็ดตัวและของใช้',
    detail: 'ตู้บานเกล็ดพร้อมชั้นวางผ้าขนหนูพับและกระดาษทิชชู่สำรอง',
    x: LINEN_X,
    y: LINEN_Y,
    w: LINEN_W,
    h: LINEN_H,
    priority: 12,
  },
  {
    id: 'bath_toilet_paper',
    zone: 'bathroom',
    areaLabel: 'ห้องน้ำ · สุขภัณฑ์',
    name: 'ที่แขวนกระดาษชำระ',
    detail: 'ม้วนกระดาษทิชชู่ติดตั้งด้านข้างโถสุขภัณฑ์',
    x: TOILET_X - 5,
    y: TOILET_Y + 30,
    w: 9,
    h: 12,
    priority: 22,
  },
  {
    id: 'bath_bidet_sprayer',
    zone: 'bathroom',
    areaLabel: 'ห้องน้ำ · สุขภัณฑ์',
    name: 'สายฉีดชำระโครเมียม',
    detail: 'หัวฉีดชำระแบบมือกดติดตั้งข้างโถสุขภัณฑ์',
    x: TOILET_X + 39,
    y: TOILET_Y + 31,
    w: 7,
    h: 11,
    priority: 22,
  },
  {
    id: 'bath_toilet',
    zone: 'bathroom',
    areaLabel: 'ห้องน้ำ · สุขภัณฑ์',
    name: 'โถสุขภัณฑ์ (ชักโครก)',
    detail: 'ชักโครกเซรามิกสีขาวระบบกดชำระสองปุ่ม',
    x: TOILET_X + 3,
    y: TOILET_Y,
    w: 37,
    h: 45,
    priority: 14,
  },
  {
    id: 'bath_pedal_bin',
    zone: 'bathroom',
    areaLabel: 'ห้องน้ำ · โซนแห้ง',
    name: 'ถังขยะห้องน้ำฝาไม้ไผ่',
    detail: 'ถังขยะมีฝาปิดลายไม้ไผ่แบบเหยียบวางข้างโถสุขภัณฑ์',
    x: Math.round(4.55 * TILE),
    y: Math.round(21.0 * TILE),
    w: 20,
    h: 22,
    priority: 16,
  },
  {
    id: 'bath_laundry_hamper',
    zone: 'bathroom',
    areaLabel: 'ห้องน้ำ · โซนซักผ้า',
    name: 'ตะกร้าผ้าหวายสาน',
    detail: 'ตะกร้าหวายสำหรับใส่เสื้อผ้าที่รอซัก',
    x: Math.round(2.9 * TILE),
    y: Math.round(20.25 * TILE),
    w: Math.round(1.05 * TILE),
    h: Math.round(1.4 * TILE),
    priority: 16,
  },
  {
    id: 'bath_detergent',
    zone: 'bathroom',
    areaLabel: 'ห้องน้ำ · โซนซักผ้า',
    name: 'ขวดน้ำยาซักผ้า',
    detail: 'แกลลอนน้ำยาซักผ้าสีฟ้าวางบนเครื่องซักผ้า',
    x: WASHER_X + 5,
    y: WASHER_Y + 3,
    w: 12,
    h: 15,
    priority: 22,
  },
  {
    id: 'bath_folded_laundry',
    zone: 'bathroom',
    areaLabel: 'ห้องน้ำ · โซนซักผ้า',
    name: 'กองผ้าพับ',
    detail: 'ผ้าขนหนูและผ้าที่พับวางพักไว้บนเครื่องซักผ้า',
    x: WASHER_X + 22,
    y: WASHER_Y + 6,
    w: 20,
    h: 11,
    priority: 22,
  },
  {
    id: 'bath_washing_machine',
    zone: 'bathroom',
    areaLabel: 'ห้องน้ำ · โซนซักผ้า',
    name: 'เครื่องซักผ้าฝาหน้า',
    detail: 'เครื่องซักผ้าอัตโนมัติพร้อมแผงควบคุมและไฟแสดงสถานะ',
    x: WASHER_X,
    y: WASHER_Y,
    w: WASHER_W,
    h: WASHER_H,
    priority: 14,
  },
];

const DINING_TX = Math.round(KITCHEN_DINING_RECT.x);
const DINING_TY = Math.round(KITCHEN_DINING_RECT.y);
const DINING_TW = Math.round(KITCHEN_DINING_RECT.w);
const DINING_TH = Math.round(KITCHEN_DINING_RECT.h);
const DINING_CX = DINING_TX + Math.floor(DINING_TW / 2);
const DINING_CY = DINING_TY + Math.floor(DINING_TH / 2) - 2;

export const KITCHEN_INSPECTABLES: InspectableObject[] = [
  {
    id: 'kitchen_christmas_turkey',
    zone: 'kitchen',
    areaLabel: 'ห้องครัว · โต๊ะอาหารคริสต์มาส',
    name: 'ไก่งวงอบคริสต์มาสตัวใหญ่',
    detail:
      'ไก่งวงอบสีทองหอมกรุ่นวางบนถาดเงินประดับโรสแมรี่และแครนเบอร์รี่ กลางโต๊ะอาหาร เป็นสัญลักษณ์แห่งวันครอบครัวแสนอบอุ่นในวันคริสต์มาส',
    x: DINING_CX - 17,
    y: DINING_CY - 10,
    w: 34,
    h: 20,
    priority: 26,
  },
  {
    id: 'kitchen_dining_chair_nw',
    zone: 'kitchen',
    areaLabel: 'ห้องครัว · โต๊ะอาหาร',
    name: 'เก้าอี้ไม้โอ๊ค (ฝั่งบนซ้าย)',
    detail: 'เก้าอี้ไม้โอ๊คเบาะครีมนุ่ม สามารถคลิกหรือกด E เพื่อนั่งร่วมโต๊ะอาหารได้',
    x: DINING_TX + 12,
    y: DINING_TY - 12,
    w: 24,
    h: 20,
    priority: 20,
  },
  {
    id: 'kitchen_dining_chair_ne',
    zone: 'kitchen',
    areaLabel: 'ห้องครัว · โต๊ะอาหาร',
    name: 'เก้าอี้ไม้โอ๊ค (ฝั่งบนขวา)',
    detail: 'เก้าอี้ไม้โอ๊คเบาะครีมนุ่ม สามารถคลิกหรือกด E เพื่อนั่งร่วมโต๊ะอาหารได้',
    x: DINING_TX + DINING_TW - 38,
    y: DINING_TY - 12,
    w: 24,
    h: 20,
    priority: 20,
  },
  {
    id: 'kitchen_dining_chair_sw',
    zone: 'kitchen',
    areaLabel: 'ห้องครัว · โต๊ะอาหาร',
    name: 'เก้าอี้ไม้โอ๊ค (ฝั่งล่างซ้าย)',
    detail: 'เก้าอี้ไม้โอ๊คเบาะครีมนุ่ม สามารถคลิกหรือกด E เพื่อนั่งร่วมโต๊ะอาหารได้',
    x: DINING_TX + 12,
    y: DINING_TY + DINING_TH - 9,
    w: 24,
    h: 22,
    priority: 20,
  },
  {
    id: 'kitchen_dining_chair_se',
    zone: 'kitchen',
    areaLabel: 'ห้องครัว · โต๊ะอาหาร',
    name: 'เก้าอี้ไม้โอ๊ค (ฝั่งล่างขวา)',
    detail: 'เก้าอี้ไม้โอ๊คเบาะครีมนุ่ม สามารถคลิกหรือกด E เพื่อนั่งร่วมโต๊ะอาหารได้',
    x: DINING_TX + DINING_TW - 38,
    y: DINING_TY + DINING_TH - 9,
    w: 24,
    h: 22,
    priority: 20,
  },
  {
    id: 'kitchen_dining_table',
    zone: 'kitchen',
    areaLabel: 'ห้องครัว · โซนรับประทานอาหาร',
    name: 'โต๊ะอาหารไม้โอ๊คครอบครัว (4 ที่นั่ง)',
    detail:
      'โต๊ะอาหารครอบครัวปูผ้าคาดโต๊ะสีแดงคริสต์มาส พร้อมจานเซรามิก 4 ที่นั่งและไก่งวงอบตัวใหญ่กลางโต๊ะ สามารถนั่งได้ครบทั้ง 4 เก้าอี้',
    x: DINING_TX,
    y: DINING_TY,
    w: DINING_TW,
    h: DINING_TH,
    priority: 12,
  },
];

export const OFFICE_INSPECTABLES: InspectableObject[] = [
  {
    id: 'office_ai_studio_station',
    zone: 'office',
    areaLabel: 'ห้องทำงาน · สถานี AI Lab',
    name: 'สถานี Google AI Studio',
    detail:
      'โต๊ะทดลอง Prompt Lab, App Builder และ JSON Schema พร้อมตัวละครผู้ช่วย Google AI Studio เดินเข้าใกล้แล้วกด E หรือคลิกเพื่อเปิดเวิร์กเบนช์',
    x: Math.round(AISTUDIO_DESK_RECT.x),
    y: Math.round(AISTUDIO_DESK_RECT.y - 0.6 * TILE),
    w: Math.round(AISTUDIO_DESK_RECT.w),
    h: Math.round(AISTUDIO_DESK_RECT.h + 0.6 * TILE),
    priority: 18,
  },
];

export const ROADSIDE_INSPECTABLES: InspectableObject[] = [
  {
    id: 'roadside_gmail_mailbox',
    zone: 'entryway',
    areaLabel: 'ริมถนนหน้าบ้าน · Gmail',
    name: 'ตู้ไปรษณีย์ริมถนน (Gmail)',
    detail:
      'เชื่อมต่อกับ Google Gmail API เมื่อมีอีเมลใหม่ธงแดงจะยกขึ้นพร้อมแจ้งเตือน เดินมาแล้วกด E หรือคลิกที่ตู้ไปรษณีย์เพื่อเปิดอ่านได้เลย',
    x: MAILBOX_RECT.x - 2,
    y: MAILBOX_RECT.y - 12,
    w: MAILBOX_RECT.w + 4,
    h: MAILBOX_RECT.h + 12,
    priority: 22,
  },
];

export const BEDROOM_INSPECTABLES: InspectableObject[] = [
  {
    id: 'bedroom_sleep_quest_station',
    zone: 'bedroom',
    areaLabel: 'ห้องนอนใหญ่ · ภารกิจประจำวัน',
    name: 'โต๊ะข้างเตียง · บันทึกการนอน (.json & AI)',
    detail:
      'อัปโหลดภาพสถิติการนอนจากแอพสุขภาพ (เช่น Huawei Health) เพื่อแปลงเป็นไฟล์ .json ประจำวัน และให้ AI วิเคราะห์คุณภาพการนอนแบบเจาะลึก',
    x: SLEEP_STATION_RECT.x - 2,
    y: SLEEP_STATION_RECT.y - 4,
    w: SLEEP_STATION_RECT.w + 4,
    h: SLEEP_STATION_RECT.h + 6,
    priority: 22,
  },
];

export const GARAGE_INSPECTABLES: InspectableObject[] = [
  {
    id: 'garage_empty_red_car_bay',
    zone: 'garage',
    areaLabel: 'โรงจอดรถ · ช่องจอดฝั่งขวา',
    name: 'ช่องจอดรถคันสีแดง (ว่าง)',
    detail:
      'เหลือเพียงเส้นสีเหลืองและแท่นหยุดล้อ — มีคนขับรถคันสีแดงออกไปใช้งานอยู่ จึงยังไม่ได้กลับมาจอด',
    x: Math.round(26.85 * TILE),
    y: Math.round(23.65 * TILE),
    w: Math.round(3.3 * TILE),
    h: Math.round(5.4 * TILE),
    priority: 10,
  },
];

export const ENTRYWAY_INSPECTABLES: InspectableObject[] = [
  {
    id: 'entryway_porch_plants',
    zone: 'entryway',
    areaLabel: 'โถงทางเข้า · ภารกิจประจำวัน',
    name: 'กระถางต้นไม้ดอก 5 ต้น',
    detail:
      'กระถางดินเผาปลูกต้นไม้ดอกสีสด 5 ต้นริมระเบียงโถงทางเข้า — กด E หรือคลิกเพื่อรดน้ำอย่างน้อยวันละ 1 ครั้ง (รีเซ็ตอัตโนมัติตอนเที่ยงคืน 00:00 น.)',
    x: PORCH_PLANTER_RECT.x - 2,
    y: PORCH_PLANTER_RECT.y - 4,
    w: PORCH_PLANTER_RECT.w + 4,
    h: PORCH_PLANTER_RECT.h + 6,
    priority: 22,
  },
];

export const INSPECTABLE_OBJECTS: InspectableObject[] = [
  ...BATHROOM_INSPECTABLES,
  ...KITCHEN_INSPECTABLES,
  ...OFFICE_INSPECTABLES,
  ...ROADSIDE_INSPECTABLES,
  ...BEDROOM_INSPECTABLES,
  ...GARAGE_INSPECTABLES,
  ...ENTRYWAY_INSPECTABLES,
];

/**
 * Returns the most specific inspectable object under world coordinates (wx, wy).
 * Higher priority wins; ties are broken by smallest bounding area so detailed
 * items sitting on furniture take precedence over the furniture underneath.
 */
export function getInspectableAtPoint(wx: number, wy: number): InspectableObject | null {
  let best: InspectableObject | null = null;
  let bestPriority = -Infinity;
  let bestArea = Infinity;

  for (const obj of INSPECTABLE_OBJECTS) {
    if (wx >= obj.x && wx <= obj.x + obj.w && wy >= obj.y && wy <= obj.y + obj.h) {
      const priority = obj.priority ?? 0;
      const area = obj.w * obj.h;
      if (priority > bestPriority || (priority === bestPriority && area < bestArea)) {
        best = obj;
        bestPriority = priority;
        bestArea = area;
      }
    }
  }

  return best;
}
