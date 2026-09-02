const fs = require('fs');
const path = require('path');

const localesDir = path.resolve(__dirname, '../_locales');

const newTranslations = {
  ar: {
    reloadTab: "إعادة تحميل الصفحة",
    tabAbout: "حول والخصوصية",
    aboutPrivacyTitle: "سياسة الخصوصية",
    aboutPrivacyDesc: "لا يقوم ScrollHide بجمع أي بيانات تصفح أو تخزينها أو نقلها. كل شيء يعمل محليًا بنسبة 100%.",
    aboutPermissionsTitle: "شرح الأذونات",
    aboutOpenSourceTitle: "المصدر المفتوح والترخيص",
    aboutOpenSourceDesc: "ScrollHide هو برنامج مجاني ومفتوح المصدر تم إصداره بموجب ترخيص MIT."
  },
  cs: {
    reloadTab: "Znovu načíst stránku",
    tabAbout: "O aplikaci a soukromí",
    aboutPrivacyTitle: "Zásady ochrany osobních údajů",
    aboutPrivacyDesc: "ScrollHide neshromažďuje, neukládá ani nepřenáší žádná data o prohlížení. Vše funguje 100% lokálně.",
    aboutPermissionsTitle: "Vysvětlení oprávnění",
    aboutOpenSourceTitle: "Open Source a licence",
    aboutOpenSourceDesc: "ScrollHide je bezplatný software s otevřeným zdrojovým kódem vydaný pod licencí MIT."
  },
  da: {
    reloadTab: "Genindlæs side",
    tabAbout: "Om & Privatliv",
    aboutPrivacyTitle: "Privatlivspolitik",
    aboutPrivacyDesc: "ScrollHide indsamler, gemmer eller overfører ikke browserdata. Alt fungerer 100 % lokalt.",
    aboutPermissionsTitle: "Forklaring af tilladelser",
    aboutOpenSourceTitle: "Open Source & Licens",
    aboutOpenSourceDesc: "ScrollHide er gratis og open source-software udgivet under MIT-licensen."
  },
  de: {
    reloadTab: "Seite neu laden",
    tabAbout: "Über & Datenschutz",
    aboutPrivacyTitle: "Datenschutzerklärung",
    aboutPrivacyDesc: "ScrollHide sammelt, speichert oder überträgt keinerlei Browserdaten. Alles funktioniert zu 100 % lokal.",
    aboutPermissionsTitle: "Erklärung der Berechtigungen",
    aboutOpenSourceTitle: "Open Source & Lizenz",
    aboutOpenSourceDesc: "ScrollHide ist kostenlose Open-Source-Software, die unter der MIT-Lizenz veröffentlicht wurde."
  },
  el: {
    reloadTab: "Επαναφόρτωση σελίδας",
    tabAbout: "Σχετικά & Απόρρητο",
    aboutPrivacyTitle: "Πολιτική απορρήτου",
    aboutPrivacyDesc: "Το ScrollHide δεν συλλέγει, δεν αποθηκεύει και δεν μεταδίδει δεδομένα περιήγησης. Όλα λειτουργούν 100% τοπικά.",
    aboutPermissionsTitle: "Επεξήγηση αδειών",
    aboutOpenSourceTitle: "Ανοιχτός κώδικας & Άδεια χρήσης",
    aboutOpenSourceDesc: "Το ScrollHide είναι δωρεάν λογισμικό ανοιχτού κώδικα που κυκλοφορεί υπό την άδεια MIT."
  },
  en: {
    reloadTab: "Reload page",
    tabAbout: "About & Privacy",
    aboutPrivacyTitle: "Privacy Policy",
    aboutPrivacyDesc: "ScrollHide does not collect, store, or transmit any browsing data. Everything is 100% offline.",
    aboutPermissionsTitle: "Permissions Explanation",
    aboutOpenSourceTitle: "Open Source & License",
    aboutOpenSourceDesc: "ScrollHide is free and open-source software under the MIT License."
  },
  es: {
    reloadTab: "Recargar página",
    tabAbout: "Acerca de y Privacidad",
    aboutPrivacyTitle: "Política de privacidad",
    aboutPrivacyDesc: "ScrollHide no recopila, almacena ni transmite ningún dato de navegación. Todo funciona 100% localmente.",
    aboutPermissionsTitle: "Explicación de permisos",
    aboutOpenSourceTitle: "Código abierto y Licencia",
    aboutOpenSourceDesc: "ScrollHide es un software gratuito y de código abierto publicado bajo la licencia MIT."
  },
  fi: {
    reloadTab: "Lataa sivu uudelleen",
    tabAbout: "Tietoja ja tietosuoja",
    aboutPrivacyTitle: "Tietosuojakäytäntö",
    aboutPrivacyDesc: "ScrollHide ei kerää, tallenna tai lähetä selaustietoja. Kaikki toimii 100-prosenttisesti paikallisesti.",
    aboutPermissionsTitle: "Käyttöoikeuksien selitys",
    aboutOpenSourceTitle: "Avoin lähdekoodi ja lisenssi",
    aboutOpenSourceDesc: "ScrollHide on ilmainen ja avoimen lähdekoodin ohjelmisto, joka on julkaistu MIT-lisenssillä."
  },
  fil: {
    reloadTab: "I-reload ang pahina",
    tabAbout: "Tungkol at Privacy",
    aboutPrivacyTitle: "Patakaran sa Privacy",
    aboutPrivacyDesc: "Ang ScrollHide ay hindi nangongolekta, nag-iimbak, o nagpapadala ng data ng pag-browse. Lahat ay 100% lokal.",
    aboutPermissionsTitle: "Paliwanag sa mga Pahintulot",
    aboutOpenSourceTitle: "Open Source at Lisensya",
    aboutOpenSourceDesc: "Ang ScrollHide ay libre at open-source na software sa ilalim ng Lisensya ng MIT."
  },
  fr: {
    reloadTab: "Recharger la page",
    tabAbout: "À propos et Confidentialité",
    aboutPrivacyTitle: "Politique de confidentialité",
    aboutPrivacyDesc: "ScrollHide ne collecte, ne stocke ni ne transmet aucune donnée de navigation. Tout fonctionne à 100% hors ligne.",
    aboutPermissionsTitle: "Explication des autorisations",
    aboutOpenSourceTitle: "Open Source et Licence",
    aboutOpenSourceDesc: "ScrollHide est un logiciel libre et gratuit publié sous licence MIT."
  },
  hi: {
    reloadTab: "पृष्ठ पुनः लोड करें",
    tabAbout: "परिचय और गोपनीयता",
    aboutPrivacyTitle: "गोपनीयता नीति",
    aboutPrivacyDesc: "ScrollHide कोई भी ब्राउज़िंग डेटा एकत्र, संग्रहीत या प्रसारित नहीं करता है। सब कुछ 100% ऑफ़लाइन काम करता है।",
    aboutPermissionsTitle: "अनुमतियों का विवरण",
    aboutOpenSourceTitle: "ओपन सोर्स और लाइसेंस",
    aboutOpenSourceDesc: "ScrollHide MIT लाइसेंस के तहत जारी किया गया मुफ्त और ओपन-सोर्स सॉफ्टवेयर है।"
  },
  hu: {
    reloadTab: "Oldal újratöltése",
    tabAbout: "Névjegy és adatvédelem",
    aboutPrivacyTitle: "Adatvédelmi irányelvek",
    aboutPrivacyDesc: "A ScrollHide nem gyűjt, nem tárol és nem továbbít böngészési adatokat. Minden 100%-ban helyben működik.",
    aboutPermissionsTitle: "Engedélyek magyarázata",
    aboutOpenSourceTitle: "Nyílt forráskód és licenc",
    aboutOpenSourceDesc: "A ScrollHide egy ingyenes és nyílt forráskódú szoftver az MIT licenc alatt."
  },
  id: {
    reloadTab: "Muat ulang halaman",
    tabAbout: "Tentang & Privasi",
    aboutPrivacyTitle: "Kebijakan Privasi",
    aboutPrivacyDesc: "ScrollHide tidak mengumpulkan, menyimpan, atau mengirimkan data penjelajahan. Semuanya berfungsi 100% lokal.",
    aboutPermissionsTitle: "Penjelasan Izin",
    aboutOpenSourceTitle: "Sumber Terbuka & Lisensi",
    aboutOpenSourceDesc: "ScrollHide adalah perangkat lunak gratis dan sumber terbuka yang dirilis di bawah Lisensi MIT."
  },
  it: {
    reloadTab: "Ricarica pagina",
    tabAbout: "Informazioni e Privacy",
    aboutPrivacyTitle: "Informativa sulla privacy",
    aboutPrivacyDesc: "ScrollHide non raccoglie, memorizza o trasmette alcun dato di navigazione. Tutto funziona al 100% localmente.",
    aboutPermissionsTitle: "Spiegazione delle autorizzazioni",
    aboutOpenSourceTitle: "Open Source e Licenza",
    aboutOpenSourceDesc: "ScrollHide è un software gratuito e open source rilasciato sotto licenza MIT."
  },
  ja: {
    reloadTab: "ページを再読み込み",
    tabAbout: "概要とプライバシー",
    aboutPrivacyTitle: "プライバシーポリシー",
    aboutPrivacyDesc: "ScrollHide は閲覧データを収集、保存、送信しません。すべてが100%オフラインでローカルに動作します。",
    aboutPermissionsTitle: "権限の説明",
    aboutOpenSourceTitle: "オープンソースとライセンス",
    aboutOpenSourceDesc: "ScrollHide は MIT ライセンスの下でリリースされた無料のオープンソース ソフトウェアです。"
  },
  km: {
    reloadTab: "ផ្ទុកទំព័រឡើងវិញ",
    tabAbout: "អំពី & ភាពឯកជន",
    aboutPrivacyTitle: "គោលការណ៍​ភាព​ឯកជន",
    aboutPrivacyDesc: "ScrollHide មិនប្រមូល ផ្ទុក ឬបញ្ជូនទិន្នន័យរុករកណាមួយឡើយ។ អ្វីៗទាំងអស់ដំណើរការក្នុងមូលដ្ឋាន 100%។",
    aboutPermissionsTitle: "ការពន្យល់អំពីការអនុញ្ញាត",
    aboutOpenSourceTitle: "ប្រភពបើកចំហ & អាជ្ញាប័ណ្ណ",
    aboutOpenSourceDesc: "ScrollHide គឺជាកម្មវិធីឥតគិតថ្លៃ និងប្រភពបើកចំហដែលចេញផ្សាយក្រោមអាជ្ញាប័ណ្ណ MIT។"
  },
  ko: {
    reloadTab: "페이지 새로고침",
    tabAbout: "정보 및 개인정보 보호",
    aboutPrivacyTitle: "개인정보 처리방침",
    aboutPrivacyDesc: "ScrollHide는 검색 데이터를 수집, 저장 또는 전송하지 않습니다. 모든 작업은 100% 로컬에서 오프라인으로 실행됩니다.",
    aboutPermissionsTitle: "권한 설명",
    aboutOpenSourceTitle: "오픈 소스 및 라이선스",
    aboutOpenSourceDesc: "ScrollHide는 MIT 라이선스에 따라 배포되는 무료 오픈 소스 소프트웨어입니다."
  },
  nl: {
    reloadTab: "Pagina vernieuwen",
    tabAbout: "Over & Privacy",
    aboutPrivacyTitle: "Privacybeleid",
    aboutPrivacyDesc: "ScrollHide verzamelt, bewaart of verzendt geen browsegegevens. Alles werkt 100% lokaal.",
    aboutPermissionsTitle: "Uitleg over machtigingen",
    aboutOpenSourceTitle: "Open source & Licentie",
    aboutOpenSourceDesc: "ScrollHide is gratis en open-sourcesoftware uitgebracht onder de MIT-licentie."
  },
  pl: {
    reloadTab: "Odśwież stronę",
    tabAbout: "O programie i prywatność",
    aboutPrivacyTitle: "Polityka prywatności",
    aboutPrivacyDesc: "ScrollHide nie zbiera, nie przechowuje ani nie przesyła żadnych danych przeglądania. Wszystko działa w 100% lokalnie.",
    aboutPermissionsTitle: "Objaśnienie uprawnień",
    aboutOpenSourceTitle: "Otwarte oprogramowanie i licencja",
    aboutOpenSourceDesc: "ScrollHide to bezpłatne oprogramowanie typu open source wydane na licencji MIT."
  },
  pt_BR: {
    reloadTab: "Recarregar página",
    tabAbout: "Sobre e Privacidade",
    aboutPrivacyTitle: "Política de Privacidade",
    aboutPrivacyDesc: "O ScrollHide não coleta, armazena ou transmite nenhum dado de navegação. Tudo funciona 100% localmente.",
    aboutPermissionsTitle: "Explicação de Permissões",
    aboutOpenSourceTitle: "Código Aberto e Licença",
    aboutOpenSourceDesc: "O ScrollHide é um software gratuito e de código aberto lançado sob a Licença MIT."
  },
  pt_PT: {
    reloadTab: "Recarregar página",
    tabAbout: "Sobre e Privacidade",
    aboutPrivacyTitle: "Política de Privacidade",
    aboutPrivacyDesc: "O ScrollHide não recolhe, armazena ou transmite quaisquer dados de navegação. Tudo funciona 100% localmente.",
    aboutPermissionsTitle: "Explicação de Permissões",
    aboutOpenSourceTitle: "Código Aberto e Licença",
    aboutOpenSourceDesc: "O ScrollHide é um software gratuito e de código aberto lançado sob a Licença MIT."
  },
  ro: {
    reloadTab: "Reîncărcați pagina",
    tabAbout: "Despre și Confidențialitate",
    aboutPrivacyTitle: "Politica de confidențialitate",
    aboutPrivacyDesc: "ScrollHide nu colectează, nu stochează și nu transmite date de navigare. Totul funcționează 100% local.",
    aboutPermissionsTitle: "Explicația permisiunilor",
    aboutOpenSourceTitle: "Sursă deschisă și Licență",
    aboutOpenSourceDesc: "ScrollHide este un software gratuit și cu sursă deschisă lansat sub licența MIT."
  },
  ru: {
    reloadTab: "Перезагрузить страницу",
    tabAbout: "О расширении и конфиденциальность",
    aboutPrivacyTitle: "Политика конфиденциальности",
    aboutPrivacyDesc: "ScrollHide не собирает, не сохраняет и не передает данные о просмотре. Всё работает на 100% локально.",
    aboutPermissionsTitle: "Описание разрешений",
    aboutOpenSourceTitle: "Открытый исходный код и лицензия",
    aboutOpenSourceDesc: "ScrollHide — это бесплатное программное обеспечение с открытым исходным кодом, выпущенное под лицензией MIT."
  },
  sv: {
    reloadTab: "Ladda om sidan",
    tabAbout: "Om & Integritet",
    aboutPrivacyTitle: "Integritetspolicy",
    aboutPrivacyDesc: "ScrollHide samlar inte in, lagrar eller överför någon webbläsardata. Allt fungerar 100 % lokalt.",
    aboutPermissionsTitle: "Förklaring av behörigheter",
    aboutOpenSourceTitle: "Öppen källkod och licens",
    aboutOpenSourceDesc: "ScrollHide är gratis programvara med öppen källkod som släpps under MIT-licensen."
  },
  th: {
    reloadTab: "โหลดหน้านี้ใหม่",
    tabAbout: "เกี่ยวกับ & ความเป็นส่วนตัว",
    aboutPrivacyTitle: "นโยบายความเป็นส่วนตัว",
    aboutPrivacyDesc: "ScrollHide ไม่มีการเก็บรวบรวม บันทึก หรือส่งต่อข้อมูลการท่องเว็บใดๆ ทุกอย่างทำงานแบบออฟไลน์ 100%",
    aboutPermissionsTitle: "คำอธิบายเกี่ยวกับสิทธิ์การใช้งาน",
    aboutOpenSourceTitle: "โอเพนซอร์ส & ใบอนุญาต",
    aboutOpenSourceDesc: "ScrollHide เป็นซอฟต์แวร์ฟรีและโอเพนซอร์สที่เผยแพร่ภายใต้ใบอนุญาต MIT"
  },
  tr: {
    reloadTab: "Sayfayı yenile",
    tabAbout: "Hakkında ve Gizlilik",
    aboutPrivacyTitle: "Gizlilik Politikası",
    aboutPrivacyDesc: "ScrollHide hiçbir tarama verisini toplamaz, saklamaz veya iletmez. Her şey %100 yerel olarak çalışır.",
    aboutPermissionsTitle: "İzinlerin Açıklaması",
    aboutOpenSourceTitle: "Açık Kaynak ve Lisans",
    aboutOpenSourceDesc: "ScrollHide, MIT Lisansı altında yayınlanan ücretsiz ve açık kaynaklı bir yazılımdır."
  },
  uk: {
    reloadTab: "Перезавантажити сторінку",
    tabAbout: "Про розширення та конфіденційність",
    aboutPrivacyTitle: "Політика конфіденційності",
    aboutPrivacyDesc: "ScrollHide не збирає, не зберігає та не передає жодних даних перегляду. Усе працює на 100% локально.",
    aboutPermissionsTitle: "Пояснення дозволів",
    aboutOpenSourceTitle: "Відкритий код та ліцензія",
    aboutOpenSourceDesc: "ScrollHide — це безкоштовне програмне забезпечення з відкритим кодом, випущене під ліцензією MIT."
  },
  vi: {
    reloadTab: "Tải lại trang",
    tabAbout: "Giới thiệu & Quyền riêng tư",
    aboutPrivacyTitle: "Chính sách quyền riêng tư",
    aboutPrivacyDesc: "ScrollHide hoàn toàn không thu thập, lưu trữ hay gửi dữ liệu của bạn đi đâu. Hoạt động 100% offline.",
    aboutPermissionsTitle: "Giải thích quyền hạn",
    aboutOpenSourceTitle: "Mã nguồn mở & Bản quyền",
    aboutOpenSourceDesc: "ScrollHide là phần mềm mã nguồn mở miễn phí phát hành theo giấy phép MIT."
  },
  zh_CN: {
    reloadTab: "重新加载页面",
    tabAbout: "关于与隐私",
    aboutPrivacyTitle: "隐私政策",
    aboutPrivacyDesc: "ScrollHide 不会收集、存储或传输任何浏览数据。所有操作均为 100% 本地离线运行。",
    aboutPermissionsTitle: "权限说明",
    aboutOpenSourceTitle: "开源与许可协议",
    aboutOpenSourceDesc: "ScrollHide 是根据 MIT 许可证发布的免费开源软件。"
  },
  zh_TW: {
    reloadTab: "重新載入頁面",
    tabAbout: "關於與隱私",
    aboutPrivacyTitle: "隱私政策",
    aboutPrivacyDesc: "ScrollHide 不會收集、儲存或傳輸任何瀏覽資料。所有操作均為 100% 本地離線運行。",
    aboutPermissionsTitle: "權限說明",
    aboutOpenSourceTitle: "開源與授權條款",
    aboutOpenSourceDesc: "ScrollHide 是根據 MIT 授權條款發布的免費開源軟體。"
  }
};

const allLocaleDirs = fs.readdirSync(localesDir, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

allLocaleDirs.forEach((lang) => {
  const targetFile = path.join(localesDir, lang, 'messages.json');
  if (!fs.existsSync(targetFile)) return;

  const data = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
  const dict = newTranslations[lang] || {};

  Object.entries(dict).forEach(([key, val]) => {
    data[key] = { message: val };
  });

  fs.writeFileSync(targetFile, JSON.stringify(data, null, 4), 'utf8');
  console.log(`✅ Updated translations for: ${lang}`);
});

console.log('🎉 All locales successfully updated with accurate translations!');
