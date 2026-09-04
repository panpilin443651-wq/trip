import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    /*
     * รูปประกอบสถานที่มาจากวิกิพีเดีย ต้องอนุญาตโดเมนไว้ก่อน
     * ไม่งั้น next/image จะปฏิเสธ URL ภายนอกทั้งหมด
     *
     * มีสองโดเมนเพราะวิกิพีเดียคืนทั้งไฟล์เต็ม (upload) และรูปย่อ (thumb)
     */
    remotePatterns: [
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "thumb.wikimedia.org" },
    ],
  },
};

export default nextConfig;
