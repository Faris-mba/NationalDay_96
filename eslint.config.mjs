import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/** @type {import('eslint').Linter.Config[]} */
const config = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // هذه اللعبة تزامن حالتها مع نظامين خارجيين: Supabase Realtime،
      // وواجهات المتصفّح (localStorage و window.location) التي لا تُقرأ
      // أثناء العرض على الخادم تفاديًا لاختلاف الترطيب (hydration).
      // كلتاهما من الحالات التي يوصي بها React باستخدام useEffect،
      // فنُبقي القاعدة تنبيهًا لا خطأ حتى تبقى مرئية دون أن تعطّل البناء.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default config;
