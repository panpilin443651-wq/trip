export type TransportId =
  | "car"
  | "plane"
  | "train"
  | "bus"
  | "van"
  | "boat"
  | "motorcycle"
  | "walk";

export interface TransportMeta {
  id: TransportId;
  label: string;
  emoji: string;
  /** คำอธิบายสั้น ๆ ช่วยให้เลือกถูก */
  hint: string;
}

export const TRANSPORTS: TransportMeta[] = [
  { id: "car", label: "รถยนต์", emoji: "🚗", hint: "ขับเอง หรือเช่ารถ" },
  { id: "plane", label: "เครื่องบิน", emoji: "✈️", hint: "บินระหว่างจังหวัด" },
  { id: "train", label: "รถไฟ", emoji: "🚆", hint: "รถไฟทางไกลหรือในเมือง" },
  { id: "bus", label: "รถทัวร์", emoji: "🚌", hint: "รถโดยสารประจำทาง" },
  { id: "van", label: "รถตู้", emoji: "🚐", hint: "รถตู้โดยสารหรือเหมา" },
  { id: "boat", label: "เรือ", emoji: "⛴️", hint: "เรือข้ามเกาะหรือเรือโดยสาร" },
  {
    id: "motorcycle",
    label: "มอเตอร์ไซค์",
    emoji: "🏍️",
    hint: "ขับเองหรือเช่าในพื้นที่",
  },
  { id: "walk", label: "เดิน/ในเมือง", emoji: "🚶", hint: "เดินหรือขนส่งในเมือง" },
];

export const TRANSPORT_MAP: Record<TransportId, TransportMeta> =
  Object.fromEntries(TRANSPORTS.map((t) => [t.id, t])) as Record<
    TransportId,
    TransportMeta
  >;

export function transportOf(id: string | undefined): TransportMeta | null {
  return id && id in TRANSPORT_MAP
    ? TRANSPORT_MAP[id as TransportId]
    : null;
}
