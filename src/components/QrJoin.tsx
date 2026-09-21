"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function QrJoin({ url, size = 360 }: { url: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    QRCode.toDataURL(url, {
      width: size * 2,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#00280f", light: "#ffffff" },
    })
      .then((d) => {
        if (!cancelled) setDataUrl(d);
      })
      .catch(() => setDataUrl(null));
    return () => {
      cancelled = true;
    };
  }, [url, size]);

  return (
    <div
      className="grid place-items-center rounded-3xl bg-white p-4 shadow-2xl"
      style={{ width: size, height: size }}
    >
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dataUrl} alt="امسح الرمز للانضمام" className="h-full w-full" />
      ) : (
        <span className="text-xl font-bold text-saudi-700">جارٍ توليد الرمز…</span>
      )}
    </div>
  );
}
