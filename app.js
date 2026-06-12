const menuData = [
    { id: "gen_info", latn: "Umumiy ma'lumot", cyrl: "Овши информатисия" },
    { id: "cash_bal", latn: "Naqd pul qoldig'i", cyrl: "Остатка нах" },
    { id: "bank_bal", latn: "Bank qoldig'i", cyrl: "Остатка банк" },
    { id: "click_bal", latn: "Click qoldig'i", cyrl: "Остатка кклик" },
    { id: "cement_bal", latn: "Sement qoldig'i", cyrl: "Остатка цемент" },
    { id: "daily_work", latn: "Kunlik ish", cyrl: "Кунлик иш" },
    { id: "income", latn: "Kirim", cyrl: "Кирим" },
    { id: "expense", latn: "Chiqim", cyrl: "Чиким" },
    { id: "sold_tons", latn: "Sotilgan tonna", cyrl: "Сотилган тонна" },
    { id: "recv_tons", latn: "Olingan tonna", cyrl: "Олинган тонна" },
    { id: "debts", latn: "Qarzlar", cyrl: "Каризлар" },
    { id: "advances", latn: "Avanslar", cyrl: "Аванслар" },
    { id: "sales", latn: "Sotish", cyrl: "Сотиш" },
    { id: "income_bank", latn: "Kirim bank", cyrl: "Кирим бакн" },
    { id: "income_click", latn: "Kirim click", cyrl: "Кирим слик" },
    { id: "worker_salary", latn: "Ishchilar oyligi", cyrl: "Ишчила ойлик" },
    { id: "tg_order", latn: "Telegram zakaz tonna", cyrl: "Телгарм закас тонна" },
    { id: "overall_report", latn: "Hammasidan otchyot", cyrl: "Хаммасидан ачот" }
];

let currentLang = 'latn';
let activePageId = null;

const staticTexts = {
    app_title: { latn: "SEMENT BIZNES BOSHQRUVI", cyrl: "СЕМЕНТ БИЗНЕС БОШҚАРУВИ" },
    menu_header: { latn: "Bo'limlar", cyrl: "Бўлимлар" },
    welcome_title: { latn: "Xush Kelibsiz", cyrl: "Хуш Келибсиз" },
    welcome_text: { latn: "Kerakli bo'limni chap tomondagi menyudan tanlang.", cyrl: "Керакли бўлимни чап томондаги менюдан танланг." }
};

function init() {
    renderMenu();
    updateStaticTexts();
}

function changeLang(lang) {
    currentLang = lang;
    
    // Update active button classes
    document.getElementById('btn-latn').classList.toggle('active', lang === 'latn');
    document.getElementById('btn-cyrl').classList.toggle('active', lang === 'cyrl');
    
    updateStaticTexts();
    renderMenu();
    
    if (activePageId) {
        openPage(activePageId);
    } else {
        document.getElementById('page-title').innerText = staticTexts.welcome_title[currentLang];
        document.getElementById('page-content').innerHTML = `<p>${staticTexts.welcome_text[currentLang]}</p>`;
    }
}

function updateStaticTexts() {
    document.getElementById('app-title').innerText = staticTexts.app_title[currentLang];
    document.getElementById('menu-header').innerText = staticTexts.menu_header[currentLang];
}

function renderMenu() {
    const menuList = document.getElementById('menu-list');
    menuList.innerHTML = '';
    
    menuData.forEach((item, index) => {
        const li = document.createElement('li');
        if (item.id === activePageId) {
            li.classList.add('active');
        }
        
        const btn = document.createElement('button');
        btn.innerText = `${index + 1}. ${item[currentLang]}`;
        btn.onclick = () => openPage(item.id);
        
        li.appendChild(btn);
        menuList.appendChild(li);
    });
}

function openPage(pageId) {
    activePageId = pageId;
    renderMenu(); // To update active state
    
    const item = menuData.find(i => i.id === pageId);
    if (!item) return;
    
    const pageTitle = document.getElementById('page-title');
    const pageContent = document.getElementById('page-content');
    
    pageTitle.innerText = item[currentLang];
    
    // Placeholder content for the selected section
    pageContent.innerHTML = `
        <p><b>${item[currentLang]}</b> bo'limi muvaffaqiyatli ochildi.</p>
        <p>Bu yerda siz ushbu bo'limga tegishli jadvallar va ma'lumotlarni kiritishingiz va boshqarishingiz mumkin bo'ladi.</p>
        
        <table class="data-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Sana</th>
                    <th>Ma'lumot / Izoh</th>
                    <th>Summa / Miqdor</th>
                    <th>Amallar</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>1</td>
                    <td>01.06.2026</td>
                    <td>Test ma'lumot 1</td>
                    <td>0.00</td>
                    <td><button>Tahrirlash</button></td>
                </tr>
                <tr>
                    <td>2</td>
                    <td>02.06.2026</td>
                    <td>Test ma'lumot 2</td>
                    <td>0.00</td>
                    <td><button>Tahrirlash</button></td>
                </tr>
            </tbody>
        </table>
    `;
}

// Initialize application
window.onload = init;
