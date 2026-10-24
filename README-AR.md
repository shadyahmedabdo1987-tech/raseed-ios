# رصيد — نسخة الآيفون

## الرفع على TestFlight (من ويندوز، من غير Mac)
افتح PowerShell جوه الفولدر ده واكتب:

    npm install
    npx expo install --fix
    npx eas-cli login              (لو مش عامل دخول على حساب Expo: shady87)
    npx eas-cli build -p ios --profile production --auto-submit

- هيسألك عن حساب أبل (Apple ID + كود التحقق) — نفس اللي رفعت بيه "دوري".
- لو سأل "Generate a new Apple Distribution Certificate / Provisioning Profile?" اختار Yes.
- بعد ما البناء يخلص (حوالي ١٥–٢٥ دقيقة) بيترفع لوحده على App Store Connect،
  وبعد ٥–١٥ دقيقة معالجة يظهر في TestFlight.

## تحديث الواجهة بعد أي تعديل
    python scripts/build_bundle.py ../raseed/www web/bundle.js
