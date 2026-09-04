import type { ChatMessage } from "./types";

export const CHAT_STORAGE_KEY = "travel-planner:chat";
export const EXPLORE_CHAT_STORAGE_KEY = "travel-planner:explore-chat";

/**
 * เก็บย้อนหลังแค่ 40 ข้อความ ตัดของเก่าทิ้ง
 * ประวัติยาวกว่านี้ไม่ได้ช่วยให้ตอบดีขึ้น แต่กิน localStorage
 * ซึ่งใช้ร่วมกับข้อมูลทริปที่สำคัญกว่า
 */
const MAX_MESSAGES = 40;

/**
 * ประวัติแชทเป็น external store ไม่ใช่ state ในคอมโพเนนต์
 *
 * ถ้าอ่าน localStorage ตอน render ครั้งแรก HTML ฝั่งเซิร์ฟเวอร์กับฝั่งเบราว์เซอร์
 * จะไม่ตรงกัน แต่ถ้าย้ายไปอ่านใน useEffect ก็ติดกฎ react-hooks/set-state-in-effect
 * useSyncExternalStore แก้ทั้งสองอย่างพร้อมกัน — ฝั่งเซิร์ฟเวอร์เห็นรายการว่าง
 * ฝั่งเบราว์เซอร์เห็นของจริงตั้งแต่เรนเดอร์แรกหลัง hydrate
 */
const EMPTY: ChatMessage[] = [];

export interface ChatStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => ChatMessage[];
  getServerSnapshot: () => ChatMessage[];
  /**
   * persist = false ตอนกำลังสตรีมคำตอบ จะได้ไม่เขียน localStorage ทุก token
   * แล้วค่อยเขียนครั้งเดียวตอนจบ
   */
  setMessages: (next: ChatMessage[], persist?: boolean) => void;
  clearMessages: () => void;
}

/**
 * สร้างที่เก็บประวัติหนึ่งชุดต่อหนึ่งคีย์
 *
 * เดิมเป็นตัวแปรระดับโมดูลผูกกับคีย์เดียว พอมีช่องแชทสองที่ (ผู้ช่วยทั่วไป
 * กับผู้ช่วยแนะนำที่เที่ยว) ทั้งสองจะเขียนทับประวัติกันเอง — ถามในหน้าแนะนำเที่ยว
 * แล้วประวัติในหน้าผู้ช่วยหายไปทั้งดุ้น
 */
export function createChatStore(storageKey: string): ChatStore {
  let cache: ChatMessage[] | null = null;
  const listeners = new Set<() => void>();

  function read(): ChatMessage[] {
    if (typeof window === "undefined") return EMPTY;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return EMPTY;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return EMPTY;
      const clean = parsed.filter(
        (m): m is ChatMessage =>
          !!m &&
          typeof m === "object" &&
          typeof (m as ChatMessage).id === "string" &&
          typeof (m as ChatMessage).text === "string" &&
          ((m as ChatMessage).role === "user" ||
            (m as ChatMessage).role === "model"),
      );
      return clean.length > 0 ? clean.slice(-MAX_MESSAGES) : EMPTY;
    } catch {
      // JSON พัง หรือ localStorage ถูกปิด — เริ่มแชทใหม่แทนที่จะให้หน้าล่ม
      return EMPTY;
    }
  }

  function write(messages: ChatMessage[]): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {
      // เต็มโควตา หรืออยู่ในโหมดส่วนตัว — แชทยังใช้ได้จนกว่าจะรีเฟรช
    }
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    /** ต้องคืน reference เดิมถ้าข้อมูลไม่เปลี่ยน ไม่งั้น React จะเรนเดอร์วนไม่จบ */
    getSnapshot() {
      if (cache === null) cache = read();
      return cache;
    },

    getServerSnapshot() {
      return EMPTY;
    },

    setMessages(next, persist = true) {
      cache = next.slice(-MAX_MESSAGES);
      if (persist) write(cache);
      for (const listener of listeners) listener();
    },

    clearMessages() {
      cache = EMPTY;
      if (typeof window !== "undefined") {
        try {
          window.localStorage.removeItem(storageKey);
        } catch {
          // ไม่ต้องทำอะไร
        }
      }
      for (const listener of listeners) listener();
    },
  };
}

/** ผู้ช่วยทั่วไป — คีย์เดิม ประวัติที่ผู้ใช้มีอยู่แล้วจึงไม่หาย */
export const defaultChatStore = createChatStore(CHAT_STORAGE_KEY);

/** ผู้ช่วยแนะนำที่เที่ยวในหน้า /explore */
export const exploreChatStore = createChatStore(EXPLORE_CHAT_STORAGE_KEY);
