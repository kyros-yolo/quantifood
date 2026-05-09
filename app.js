const API_CONFIG = {
    PRODUCT_URL: 'https://world.openfoodfacts.org/api/v2/product/',
    SEARCH_URL: 'https://world.openfoodfacts.org/cgi/search.pl',
    QUERY_PARAMS: '.json',
    SWISS_BASE_URL: 'https://api.webapp.prod.blv.foodcase-services.com/BLV_WebApp_WS/webresources/BLV-api'
};

const GEMINI_URL = '/.netlify/functions/gemini';

/* --- Migration: GoJacked → Quantifood --- */
(function migrate() {
    const map = { 'gojacked_goals': 'quantifood_goals', 'gojacked_food_logs': 'quantifood_food_logs', 'gojacked_last_date': 'quantifood_last_date', 'gojacked_weight_log': 'quantifood_weight_log' };
    for (const [oldK, newK] of Object.entries(map)) {
        if (!localStorage.getItem(newK) && localStorage.getItem(oldK)) {
            localStorage.setItem(newK, localStorage.getItem(oldK));
        }
    }
})();

const STORAGE_KEY = 'quantifood_food_logs';

let GOALS = {
    kcal: 2500,
    protein: 150
};

const storedGoals = localStorage.getItem('quantifood_goals');
if (storedGoals) {
    try {
        GOALS = JSON.parse(storedGoals);
    } catch (e) { }
}

const ELEMENTS = {
    navBtns: document.querySelectorAll('.nav-btn'),
    tabContents: document.querySelectorAll('.tab-content'),

    progressBarKcal: document.getElementById('ring-kcal'),
    progressBarProtein: document.getElementById('ring-protein'),
    currentKcal: document.getElementById('current-kcal'),
    currentProtein: document.getElementById('current-protein'),
    logList: document.getElementById('log-list'),
    logEmpty: document.getElementById('log-empty'),

    addTabBtns: document.querySelectorAll('.add-tab-btn'),
    addModeContents: document.querySelectorAll('.add-mode-content'),
    reader: document.getElementById('reader'),
    manualBarcode: document.getElementById('manual-barcode'),
    manualSearchBtn: document.getElementById('manual-search-btn'),

    productSearchInput: document.getElementById('product-search-input'),
    voiceSearchBtn: document.getElementById('voice-search-btn'),
    productSearchBtn: document.getElementById('product-search-btn'),
    searchResults: document.getElementById('search-results'),
    searchStatus: document.getElementById('search-status'),

    productCard: document.getElementById('product-card'),
    productName: document.getElementById('product-name'),
    productBrand: document.getElementById('product-brand'),
    productImg: document.getElementById('product-img'),
    pKcal: document.getElementById('p-kcal'),
    pProtein: document.getElementById('p-protein'),
    portionAmount: document.getElementById('portion-amount'),
    addBtn: document.getElementById('add-to-log-btn'),

    userNameInput: document.getElementById('user-name-input'),
    userGreeting: document.getElementById('user-greeting'),
    goalInputKcal: document.getElementById('goal-input-kcal'),
    goalInputProtein: document.getElementById('goal-input-protein'),
    saveGoalsBtn: document.getElementById('save-goals-btn'),
    goalTextKcal: document.getElementById('goal-kcal'),
    goalTextProtein: document.getElementById('goal-protein'),

    quickAddBtn: document.getElementById('quick-add-btn'),

    prevDayBtn: document.getElementById('prev-day-btn'),
    nextDayBtn: document.getElementById('next-day-btn'),
    displayDate: document.getElementById('display-date'),
    exportCsvBtn: document.getElementById('export-csv-btn'),
    exportJsonBtn: document.getElementById('export-json-btn'),

    manualName: document.getElementById('manual-name'),
    manualKcal: document.getElementById('manual-kcal'),
    manualProtein: document.getElementById('manual-protein'),
    manualCategory: document.getElementById('manual-category'),
    aiCategory: document.getElementById('ai-category'),
    productCategory: document.getElementById('product-category'),
    recentItemsList: document.getElementById('recent-items-list')
};

const RECENT_KEY = 'quantifood_recent_items';

/* Goals in UI initialisieren */
if (ELEMENTS.goalTextKcal) ELEMENTS.goalTextKcal.textContent = GOALS.kcal;
if (ELEMENTS.goalTextProtein) ELEMENTS.goalTextProtein.textContent = GOALS.protein;

let currentProduct = null;
let scanner = null;
let currentViewDate = new Date();
currentViewDate.setHours(0,0,0,0);
let lastCheckedDate = localStorage.getItem('quantifood_last_date') || new Date().toDateString();
let proteinGoalReached = false; 
if (!localStorage.getItem('quantifood_last_date')) {
    localStorage.setItem('quantifood_last_date', lastCheckedDate);
}

// Header Scroll Effect
const scrollContainer = document.getElementById('scroll-container');
if (scrollContainer) {
    scrollContainer.addEventListener('scroll', () => {
        document.body.classList.toggle('scrolled', scrollContainer.scrollTop > 20);
    });
}

class ConfettiEffect {
    constructor() {
        this.canvas = document.getElementById('confetti-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.active = false;
        
        window.addEventListener('resize', () => this.resize());
        this.resize();
    }
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    fire() {
        const colors = ['#e5e5e5', '#a3a3a3', '#60a5fa', '#ffffff'];
        const w = this.canvas.width;
        const h = this.canvas.height;
        const startTime = Date.now();
        
        for (let i = 0; i < 250; i++) {
            this.particles.push({
                x: w / 2,
                y: h / 2,
                vx: (Math.random() - 0.5) * 12,
                vy: (Math.random() - 0.5) * 12,
                size: Math.random() * 6 + 3,
                color: colors[Math.floor(Math.random() * colors.length)],
                opacity: 1,
                createdAt: startTime,
                bounces: 0
            });
        }
        
        if (!this.active) {
            this.active = true;
            this.animate();
        }
    }
    animate() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        const now = Date.now();
        this.ctx.clearRect(0, 0, w, h);
        
        this.particles.forEach((p, i) => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.12;
            p.vx *= 0.98;
            
            const age = now - p.createdAt;
            if (age > 3000) {
                p.opacity = Math.max(0, 1 - (age - 3000) / 2000);
            }
            
            this.ctx.save();
            this.ctx.globalAlpha = p.opacity;
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = p.color;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
            
            if (p.y > h - 10) {
                p.y = h - 10;
                p.vy *= -0.4;
                p.vx *= 0.8;
            }
            
            if (p.opacity <= 0 || p.x < -200 || p.x > w + 200) {
                this.particles.splice(i, 1);
            }
        });
        
        if (this.particles.length > 0) {
            requestAnimationFrame(() => this.animate());
        } else {
            this.active = false;
            this.ctx.clearRect(0, 0, w, h);
        }
    }
}
const confetti = new ConfettiEffect();

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    toast.innerHTML = `<span class="toast-icon">${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => toast.remove());
    }, 5000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

const IDB_NAME = 'QuantifoodFoodCache';
const IDB_STORE = 'foods';
function initDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE, { keyPath: 'id' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}
async function saveToOfflineCache(food) {
    if (!food || !food.name) return;
    try {
        const db = await initDB();
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        food.id = food.name.toLowerCase().replace(/\s+/g, '_');
        food.lastUsed = Date.now();
        store.put(food);
        
        const countReq = store.count();
        countReq.onsuccess = () => {
            if (countReq.result > 100) {
                const getReq = store.getAll();
                getReq.onsuccess = () => {
                    const all = getReq.result.sort((a,b) => a.lastUsed - b.lastUsed);
                    const toDelete = all.slice(0, all.length - 100);
                    const delTx = db.transaction(IDB_STORE, 'readwrite');
                    toDelete.forEach(item => delTx.objectStore(IDB_STORE).delete(item.id));
                };
            }
        };
    } catch (e) { console.warn('Cache error', e); }
}
async function searchOfflineCache(query) {
    try {
        const db = await initDB();
        const tx = db.transaction(IDB_STORE, 'readonly');
        return new Promise(resolve => {
            const req = tx.objectStore(IDB_STORE).getAll();
            req.onsuccess = () => {
                const q = (query || '').toLowerCase();
                const hits = req.result.filter(f => (f.name || '').toLowerCase().includes(q));
                hits.sort((a,b) => b.lastUsed - a.lastUsed);
                resolve(hits);
            };
            req.onerror = () => resolve([]);
        });
    } catch (e) { return []; }
}

function changeViewDate(offset) {
    currentViewDate.setDate(currentViewDate.getDate() + offset);
    updateProgressUI();
}

function checkDayChange() {
    const today = new Date().toDateString();
    if (today !== lastCheckedDate) {
        lastCheckedDate = today;
        localStorage.setItem('quantifood_last_date', today);
        updateProgressUI();
        console.log("Day changed: Progress reset.");
    }
}
setInterval(checkDayChange, 30000);

function navigateToTab(tabId) {
    ELEMENTS.navBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    ELEMENTS.tabContents.forEach(tab => {
        tab.classList.toggle('active', tab.id === tabId);
    });
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    if (tabId !== 'tab-add' && scanner) {
        stopScanner();
    }
    if (tabId === 'tab-add') {
        const cameraTabBtn = document.querySelector('.add-tab-btn[data-add-mode="camera"]');
        if (cameraTabBtn) cameraTabBtn.click();
        renderRecentItems();
    }
}

function switchTab(e) {
    const tabId = e.currentTarget.dataset.tab;
    navigateToTab(tabId);
    if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(10);
    }
    if (tabId === 'tab-weight' && typeof rWC === 'function') {
        setTimeout(() => rWC(), 100);
    }
}

function switchAddMode(e) {
    const targetMode = e.currentTarget.dataset.addMode;
    ELEMENTS.addTabBtns.forEach(btn => btn.classList.remove('active'));
    e.currentTarget.classList.add('active');
    ELEMENTS.addModeContents.forEach(content => {
        content.classList.toggle('active', content.id === `add-mode-${targetMode}`);
    });
    if (targetMode !== 'camera' && scanner) {
        stopScanner();
    }
    if (targetMode === 'camera') {
        const readerWrapper = document.getElementById('reader-wrapper');
        const cameraControls = document.getElementById('camera-controls');
        const sendToAiBtn = document.getElementById('send-to-ai-btn');
        if (readerWrapper) readerWrapper.classList.remove('hidden');
        if (cameraControls) cameraControls.classList.remove('hidden');
        if (sendToAiBtn) sendToAiBtn.classList.add('hidden');
        startScanner();
    }
    if (targetMode !== 'camera') {
        const photoPreview = document.getElementById('photo-preview');
        const photoPreviewContainer = document.getElementById('photo-preview-container');
        const photoResult = document.getElementById('photo-result-form');
        const sendToAiBtn = document.getElementById('send-to-ai-btn');
        if (photoPreview) {
            photoPreview.src = '';
        }
        if (photoPreviewContainer) photoPreviewContainer.classList.add('hidden');
        if (photoResult) photoResult.classList.add('hidden');
        if (sendToAiBtn) sendToAiBtn.classList.add('hidden');
    }
}

async function startScanner() {
    if (!window.isSecureContext) {
        showToast('Kamera erfordert HTTPS oder Localhost.', 'error');
        return;
    }
    if (!scanner) scanner = new Html5Qrcode("reader");
    try {
        await scanner.start(
            { facingMode: currentFacingMode },
            { fps: 10, aspectRatio: 1.0 },
            onScanSuccess
        );
    } catch (err) {
        console.error(err);
        showToast('Kamera-Fehler: Berechtigung verweigert?', 'error');
    }
}

async function stopScanner() {
    if (scanner && scanner.isScanning) {
        await scanner.stop();
    }
}

function onScanSuccess(decodedText) {
    console.log("Scan:", decodedText);
    stopScanner();
    fetchByBarcode(decodedText);
}

async function fetchByBarcode(barcode) {
    setSearchStatus('Produkt wird geladen...');
    try {
        const response = await fetch(`${API_CONFIG.PRODUCT_URL}${barcode}${API_CONFIG.QUERY_PARAMS}`);
        const data = await response.json();
        if (data.status === 1 && data.product) {
            displayProduct(data.product);
        } else {
            showToast(`Produkt (${barcode}) nicht gefunden.`, 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Verbindungs- oder Netzwerkfehler.', 'error');
    } finally {
        setSearchStatus(null);
    }
}

function startVoiceSearch() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        showToast('Dein Browser unterstützt leider keine Spracherkennung.', 'error');
        return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'de-DE';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = function () {
        if (ELEMENTS.voiceSearchBtn) ELEMENTS.voiceSearchBtn.classList.add('recording');
        setSearchStatus('Höre zu... Bitte sprich ein Produkt (z.B. "Apfel").');
    };
    recognition.onspeechend = function () {
        recognition.stop();
    };
    recognition.onresult = function (event) {
        if (ELEMENTS.voiceSearchBtn) ELEMENTS.voiceSearchBtn.classList.remove('recording');
        const transcript = event.results[0][0].transcript;
        ELEMENTS.productSearchInput.value = transcript;
        searchByName();
    };
    recognition.onerror = function (event) {
        if (ELEMENTS.voiceSearchBtn) ELEMENTS.voiceSearchBtn.classList.remove('recording');
        setSearchStatus('Fehler bei der Spracherkennung: ' + event.error);
    };
    recognition.start();
}

async function searchByName() {
    const query = ELEMENTS.productSearchInput.value.trim();
    if (!query) return;
    ELEMENTS.productSearchInput.blur();
    setSearchStatus(null);
    ELEMENTS.searchResults.innerHTML = '<div class="skeleton-item"></div><div class="skeleton-item"></div><div class="skeleton-item"></div>';
    ELEMENTS.productCard.classList.add('hidden');

    // 1. Offline-First: Check cache immediately
    const offlineResults = await searchOfflineCache(query);
    if (offlineResults.length > 0) {
        setSearchStatus('Lokale Ergebnisse gefunden...');
        const mapped = offlineResults.map(f => ({
            id: f.id,
            name: f.name,
            kcal_100: f.kcal_100,
            proteins_100: f.proteins_100,
            isOffline: true
        }));
        renderSearchResults(mapped);
    }

    // 2. Fetch from API in background or if no offline results
    try {
        const url = `${API_CONFIG.SWISS_BASE_URL}/foods?search=${encodeURIComponent(query)}&lang=de&limit=20`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data && data.length > 0) {
            // If we already showed offline results, we might want to "refresh" or just append
            // For simplicity, we replace with fresh data from server
            renderSearchResults(data);
        } else if (offlineResults.length === 0) {
            setSearchStatus('Keine Lebensmittel in der Datenbank gefunden.');
        }
    } catch (e) {
        console.warn('API Suche fehlgeschlagen', e);
        if (offlineResults.length === 0) {
            setSearchStatus('Fehler bei der Suche / Keine Offline Daten.');
        } else {
            setSearchStatus('Offline-Modus: Nur lokale Favoriten angezeigt.');
        }
    }
}

function renderSearchResults(foods) {
    setSearchStatus(null);
    ELEMENTS.searchResults.innerHTML = '';
    foods.forEach(food => {
        let name = food.foodName || food.name;
        if (!name && food.names && food.names.length > 0) {
            name = food.names[0].term || food.names[0].name;
        }
        if (!name && food.synonyms && food.synonyms.length > 0) {
            name = food.synonyms[0].term;
        }
        name = name || 'Unbekanntes Lebensmittel';

        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = `<strong>${name}</strong><br><small>${food.isOffline ? '⭐ Offline Favorit' : 'Schweizer Datenbank (ID: ' + food.id + ')'}</small>`;
        item.onclick = () => {
            if (food.isOffline) {
                displayProduct({ name: food.name, kcal_100: food.kcal_100, proteins_100: food.proteins_100 }, 'Offline Cache');
            } else {
                fetchSwissDetail(food.id, name);
            }
        };
        ELEMENTS.searchResults.appendChild(item);
    });

    // Add AI Estimation Option
    const query = ELEMENTS.productSearchInput.value.trim();
    if (query) {
        const aiItem = document.createElement('div');
        aiItem.className = 'search-result-item ai-search-item';
        aiItem.style.border = '1px dashed var(--primary)';
        aiItem.style.marginTop = '0.5rem';
        aiItem.innerHTML = `<strong>✨ KI-Analyse für "${query}"</strong><br><small>Nährwerte von Gemini schätzen lassen</small>`;
        aiItem.onclick = () => estimateSearchWithAI(query);
        ELEMENTS.searchResults.appendChild(aiItem);
    }
}

async function estimateSearchWithAI(query) {
    setSearchStatus('KI schätzt Nährwerte...');
    try {
        const prompt = `Gib mir die typischen Nährwerte für "${query}" als JSON: {"name":"${query}","kcal_100":Zahl,"protein_100":Zahl,"portion_g":Zahl,"description":"Kurze Beschreibung"}. portion_g soll eine typische Portionsgröße in Gramm sein (z.B. 150 für einen Apfel). Wenn unsicher, nimm 100. NUR JSON, kein Markdown.`;
        const res = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error('API Error');

        let raw = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
        const p = JSON.parse(raw);
        
        currentProduct = {
            name: p.name || query,
            kcal_100: p.kcal_100 || 0,
            proteins_100: p.protein_100 || 0,
            image_url: 'https://img.icons8.com/fluency/96/artificial-intelligence.png'
        };
        
        displayProduct(currentProduct, 'KI-Schätzung');
        
        // Set estimated portion
        if (ELEMENTS.portionAmount) {
            ELEMENTS.portionAmount.value = p.portion_g || 100;
        }
        
        showToast('Nährwerte und Portion von KI geschätzt!', 'info');
    } catch (err) {
        console.error(err);
        showToast('KI-Suche fehlgeschlagen.', 'error');
    } finally {
        setSearchStatus(null);
    }
}

async function fetchSwissDetail(dbid, name) {
    setSearchStatus('Lade Details...');
    try {
        const response = await fetch(`${API_CONFIG.SWISS_BASE_URL}/food/${dbid}?lang=de`);
        const food = await response.json();
        let kcal = 0;
        let protein = 0;
        if (food.values && Array.isArray(food.values)) {
            const kcalVal = food.values.find(v =>
                (v.component && (v.component.code === 'ENERCC' || v.component.name.includes('Energie'))) &&
                (v.unit && (v.unit.code === 'kcal' || v.unit.name.includes('kcal')))
            );
            const protVal = food.values.find(v =>
                (v.component && (v.component.code === 'PROT625' || v.component.name.includes('Protein'))) &&
                (v.unit && (v.unit.code === 'g' || v.unit.name.includes('gramm')))
            );
            if (kcalVal) kcal = kcalVal.value || kcalVal.rawValue || 0;
            if (protVal) protein = protVal.value || protVal.rawValue || 0;
        }
        currentProduct = {
            name: name,
            kcal_100: kcal,
            proteins_100: protein,
            image_url: 'https://img.icons8.com/fluency/96/food.png'
        };
        displayProduct(currentProduct, 'Schweizer Datenbank');
    } catch (e) {
        console.error("Fehler beim Laden der SFCD-Details:", e);
        showToast('Details konnten nicht geladen werden.', 'error');
    } finally {
        setSearchStatus(null);
    }
}

function displayProduct(product, source = null) {
    let name, kcal_100, proteins_100, brands, image_url, image_small_url;
    if (product.nutriments) {
        name = product.product_name || 'Unbekanntes Produkt';
        kcal_100 = product.nutriments['energy-kcal_100g'] || product.nutriments['energy-kcal'] || 0;
        proteins_100 = product.nutriments['proteins_100g'] || product.nutriments['proteins'] || 0;
        brands = product.brands;
        image_url = product.image_url;
        image_small_url = product.image_small_url;
    } else {
        name = product.name || 'Unbekanntes Produkt';
        kcal_100 = product.kcal_100 || 0;
        proteins_100 = product.proteins_100 || 0;
        brands = source || 'Datenbank';
        image_url = product.image_url;
        image_small_url = product.image_small_url;
    }
    currentProduct = {
        name: name,
        kcal_100: kcal_100,
        proteins_100: proteins_100
    };
    ELEMENTS.productName.textContent = currentProduct.name;
    ELEMENTS.productBrand.textContent = brands || 'Keine Angabe';
    ELEMENTS.productImg.src = image_url || image_small_url || 'https://via.placeholder.com/60?text=?';
    ELEMENTS.pKcal.textContent = Math.round(kcal_100);
    ELEMENTS.pProtein.textContent = typeof proteins_100 === 'number' ? proteins_100.toFixed(1) : proteins_100;
    ELEMENTS.productCard.classList.remove('hidden');
    
    // Auto-scroll to product card
    setTimeout(() => {
        ELEMENTS.productCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    
    saveToOfflineCache(currentProduct);
}

function setSearchStatus(msg) {
    if (msg) {
        ELEMENTS.searchStatus.textContent = msg;
        ELEMENTS.searchStatus.classList.remove('hidden');
    } else {
        ELEMENTS.searchStatus.classList.add('hidden');
    }
}

function addToLog() {
    if (!currentProduct) return;
    const rawVal = ELEMENTS.portionAmount.value.replace(',', '.');
    const amount = parseFloat(rawVal);
    if (isNaN(amount) || amount <= 0) {
        showToast("Bitte gültige Menge eingeben.", "error");
        return;
    }
    const entry = {
        id: Date.now(),
        name: currentProduct.name,
        amount: amount,
        kcal: (currentProduct.kcal_100 / 100) * amount,
        protein: (currentProduct.proteins_100 / 100) * amount,
        category: ELEMENTS.productCategory ? ELEMENTS.productCategory.value : 'Snack',
        timestamp: new Date().toISOString()
    };
    const logs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    logs.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    if (entry.kcal > 600) fireHeavyMascot();
    updateRecentItems(entry);
    ELEMENTS.productCard.classList.add('hidden');
    navigateToTab('tab-progress');
    setTimeout(updateProgressUI, 50);
    if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate([10, 30, 20]);
    }
    showToast(`${currentProduct.name} hinzugefügt!`, 'success');
}

function updateProgressUI() {
    if (ELEMENTS.displayDate) {
        const todayStr = new Date().toDateString();
        const viewStr = currentViewDate.toDateString();
        const yest = new Date(); yest.setDate(yest.getDate() - 1);
        const tom = new Date(); tom.setDate(tom.getDate() + 1);
        if (viewStr === todayStr) ELEMENTS.displayDate.textContent = 'Heute';
        else if (viewStr === yest.toDateString()) ELEMENTS.displayDate.textContent = 'Gestern';
        else if (viewStr === tom.toDateString()) ELEMENTS.displayDate.textContent = 'Morgen';
        else ELEMENTS.displayDate.textContent = currentViewDate.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
        if (ELEMENTS.nextDayBtn) ELEMENTS.nextDayBtn.disabled = (currentViewDate >= new Date(new Date().setHours(0,0,0,0)));
    }
    const logs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const targetDateStr = currentViewDate.toDateString();
    const todaysLogs = logs.filter(l => {
        const d = l.timestamp ? new Date(l.timestamp) : (l.date ? new Date(l.date) : null);
        return d && d.toDateString() === targetDateStr;
    });
    let totalKcal = 0;
    let totalProtein = 0;
    ELEMENTS.logList.innerHTML = '';
    if (todaysLogs.length === 0) {
        ELEMENTS.logEmpty.classList.remove('hidden');
    } else {
        ELEMENTS.logEmpty.classList.add('hidden');
        
        // Grouping by Category
        const categories = ['Frühstück', 'Mittagessen', 'Abendessen', 'Snack'];
        categories.forEach(cat => {
            const catLogs = todaysLogs.filter(l => (l.category || 'Snack') === cat);
            if (catLogs.length > 0) {
                const header = document.createElement('div');
                header.className = 'category-header';
                header.textContent = cat;
                ELEMENTS.logList.appendChild(header);

                catLogs.reverse().forEach((log) => {
                    const logKcal = Number(log.kcal) || 0;
                    const logProt = Number(log.protein) || 0;
                    totalKcal += logKcal;
                    totalProtein += logProt;

                    const item = document.createElement('div');
                    item.className = 'log-item log-item-animated';
                    const intensity = Math.min(1, log.kcal / 800);
                    item.style.setProperty('--log-intensity', 0.2 + intensity * 0.8);
                
                    item.innerHTML = `
                        <div class="log-item-info">
                            <span class="title">${escapeHtml(log.name)}</span>
                            <span class="subtitle">${log.amount}${log.unit || 'g'}</span>
                        </div>
                        <div class="log-item-right">
                            <div class="log-item-values">
                                <div class="kcal">${Math.round(log.kcal)} kcal</div>
                                <div class="protein">${log.protein.toFixed(1)}g Protein</div>
                            </div>
                            <button class="btn-delete" onclick="deleteLogEntry(${log.id})">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        </div>
                    `;
                    ELEMENTS.logList.appendChild(item);
                });
            }
        });
    }

    if (ELEMENTS.currentKcal) ELEMENTS.currentKcal.textContent = Math.round(totalKcal);
    if (ELEMENTS.currentProtein) ELEMENTS.currentProtein.textContent = totalProtein.toFixed(1);

    const kcalPercent = Math.min(100, (totalKcal / GOALS.kcal) * 100);
    const proteinPercent = Math.min(100, (totalProtein / GOALS.protein) * 100);

    if (ELEMENTS.progressBarKcal) {
        ELEMENTS.progressBarKcal.style.strokeDashoffset = 267 - (267 * kcalPercent) / 100;
    }
    if (ELEMENTS.progressBarProtein) {
        ELEMENTS.progressBarProtein.style.strokeDashoffset = 192 - (192 * proteinPercent) / 100;
    }

    if (ELEMENTS.progressBarKcal) ELEMENTS.progressBarKcal.classList.toggle('goal-reached', totalKcal >= GOALS.kcal);
    if (ELEMENTS.progressBarProtein) ELEMENTS.progressBarProtein.classList.toggle('goal-reached', totalProtein >= GOALS.protein);

    if (totalProtein >= GOALS.protein && !proteinGoalReached) {
        proteinGoalReached = true;
        confetti.fire();
        fireGoalMascot();
        showToast('Protein-Ziel erreicht! Bleib am Ball!', 'success');
    } else if (totalProtein < GOALS.protein) {
        proteinGoalReached = false;
    }
}

function fireGoalMascot() {
    const mascot = document.getElementById('goal-mascot');
    if (!mascot) return;
    
    mascot.classList.remove('hidden', 'animating');
    void mascot.offsetWidth; // Force reflow
    mascot.classList.add('animating');
    
    setTimeout(() => {
        mascot.classList.add('hidden');
        mascot.classList.remove('animating');
    }, 3500);
}

function fireHeavyMascot() {
    const mascot = document.getElementById('heavy-meal-mascot');
    if (!mascot) return;
    
    mascot.classList.remove('hidden', 'animating');
    void mascot.offsetWidth; // Force reflow
    mascot.classList.add('animating');
    
    setTimeout(() => {
        mascot.classList.add('hidden');
        mascot.classList.remove('animating');
    }, 4500);
}

window.deleteLogEntry = function(id) {
    const logs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const filtered = logs.filter(l => l.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    updateProgressUI();
    showToast('Eintrag gelöscht', 'info');
    if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(10);
};

function handleQuickAdd() {
    const name = ELEMENTS.manualName.value.trim() || 'Snack';
    const kcalRaw = ELEMENTS.manualKcal.value.replace(',', '.');
    const protRaw = ELEMENTS.manualProtein.value.replace(',', '.');
    const kcal = parseFloat(kcalRaw);
    const prot = parseFloat(protRaw);
    if (isNaN(kcal) && isNaN(prot)) {
        showToast("Bitte gib zumindest Kalorien oder Protein an!", 'error');
        return;
    }
    const logEntries = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const entry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        name: name,
        brand: 'Manuell',
        kcal: isNaN(kcal) ? 0 : kcal,
        protein: isNaN(prot) ? 0 : prot,
        amount: 1,
        unit: 'Portion',
        category: ELEMENTS.manualCategory ? ELEMENTS.manualCategory.value : 'Snack'
    };
    logEntries.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logEntries));
    if (entry.kcal > 600) fireHeavyMascot();
    updateRecentItems(entry);
    ELEMENTS.manualName.value = '';
    ELEMENTS.manualKcal.value = '';
    ELEMENTS.manualProtein.value = '';
    if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(25);
    updateProgressUI();
    setTimeout(() => navigateToTab('tab-progress'), 150);
}

function updateUserInfo() {
    const name = localStorage.getItem('quantifood_user_name') || '';
    if (ELEMENTS.userNameInput) ELEMENTS.userNameInput.value = name;
    if (ELEMENTS.userGreeting) {
        ELEMENTS.userGreeting.textContent = name ? `Hallo, ${name}!` : 'Hallo!';
    }
}

if (ELEMENTS.userNameInput) {
    ELEMENTS.userNameInput.addEventListener('input', (e) => {
        localStorage.setItem('quantifood_user_name', e.target.value);
        updateUserInfo();
    });
}
updateUserInfo();

function saveGoals() {
    const rawKcal = ELEMENTS.goalInputKcal.value.replace(',', '.');
    const rawProt = ELEMENTS.goalInputProtein.value.replace(',', '.');
    
    const k = Math.round(parseFloat(rawKcal));
    const p = Math.round(parseFloat(rawProt));
    
    if (!isNaN(k) && k > 0) GOALS.kcal = k;
    if (!isNaN(p) && p > 0) GOALS.protein = p;
    
    localStorage.setItem('quantifood_goals', JSON.stringify(GOALS));
    
    if (ELEMENTS.goalTextKcal) ELEMENTS.goalTextKcal.textContent = GOALS.kcal;
    if (ELEMENTS.goalTextProtein) ELEMENTS.goalTextProtein.textContent = GOALS.protein;
    
    updateProgressUI();
    showToast('Ziele gespeichert!', 'success');
}

function exportData(type) {
    const logs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (logs.length === 0) {
        showToast('Keine Daten zum Exportieren.', 'error');
        return;
    }
    let dataStr, mimeType, extension;
    if (type === 'json') {
        dataStr = JSON.stringify(logs, null, 2);
        mimeType = 'application/json';
        extension = 'json';
    } else {
        const headers = ['Datum', 'Name', 'Marke', 'Log-ID', 'Menge', 'Einheit', 'kcal', 'Protein'];
        const rows = logs.map(l => {
            const d = new Date(l.timestamp || l.date);
            return [d.toLocaleDateString(), l.name, l.brand || '', l.id, l.amount, l.unit || 'g', l.kcal, l.protein].join(',');
        });
        dataStr = [headers.join(','), ...rows].join('\n');
        mimeType = 'text/csv';
        extension = 'csv';
    }
    const blob = new Blob([dataStr], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quantifood_export_${new Date().toISOString().slice(0, 10)}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Export als ${extension.toUpperCase()} erfolgreich!`, 'success');
}

ELEMENTS.navBtns.forEach(btn => btn.addEventListener('click', switchTab));
ELEMENTS.addTabBtns.forEach(btn => btn.addEventListener('click', switchAddMode));
ELEMENTS.manualSearchBtn.addEventListener('click', () => {
    ELEMENTS.manualBarcode.blur();
    fetchByBarcode(ELEMENTS.manualBarcode.value);
});
ELEMENTS.productSearchBtn.addEventListener('click', searchByName);
ELEMENTS.productSearchInput.addEventListener('keydown', e => e.key === 'Enter' && searchByName());

async function showRecentSearches() {
    if (ELEMENTS.productSearchInput.value.trim() === '') {
        const recents = await searchOfflineCache('');
        if (recents.length > 0) {
            setSearchStatus('Zuletzt gesucht / Favoriten:');
            const mapped = recents.slice(0, 5).map(f => ({
                id: f.id,
                name: f.name,
                kcal_100: f.kcal_100,
                proteins_100: f.proteins_100,
                isOffline: true
            }));
            renderSearchResults(mapped);
        } else {
            ELEMENTS.searchResults.innerHTML = '';
            setSearchStatus(null);
        }
    }
}
ELEMENTS.productSearchInput.addEventListener('focus', showRecentSearches);
ELEMENTS.productSearchInput.addEventListener('input', showRecentSearches);

if (ELEMENTS.voiceSearchBtn) ELEMENTS.voiceSearchBtn.addEventListener('click', startVoiceSearch);
ELEMENTS.addBtn.addEventListener('click', addToLog);
ELEMENTS.saveGoalsBtn.addEventListener('click', saveGoals);
if (ELEMENTS.quickAddBtn) ELEMENTS.quickAddBtn.addEventListener('click', handleQuickAdd);
if (ELEMENTS.prevDayBtn) ELEMENTS.prevDayBtn.addEventListener('click', () => changeViewDate(-1));
if (ELEMENTS.nextDayBtn) ELEMENTS.nextDayBtn.addEventListener('click', () => changeViewDate(1));
if (ELEMENTS.exportCsvBtn) ELEMENTS.exportCsvBtn.addEventListener('click', () => exportData('csv'));
if (ELEMENTS.exportJsonBtn) ELEMENTS.exportJsonBtn.addEventListener('click', () => exportData('json'));

updateProgressUI();
setTimeout(updateProgressUI, 200);

/* --- New App Logic (Unified) --- */

const WEIGHT_KEY = 'quantifood_weight_log';
let weightChartInstance = null;

/* --- AI / Camera Elements --- */
const aiName = document.getElementById('ai-name');
const aiKcal = document.getElementById('ai-kcal');
const aiProtein = document.getElementById('ai-protein');
const aiCarbs = document.getElementById('ai-carbs');
const aiFat = document.getElementById('ai-fat');
const aiPortion = document.getElementById('ai-portion');
const aiCategory = document.getElementById('ai-category');
const aiConfBadge = document.getElementById('ai-confidence-badge');
const aiConfLow = document.getElementById('ai-conf-low');
const aiNotes = document.getElementById('ai-notes');
const aiAddBtn = document.getElementById('ai-add-to-log-btn');

/* --- Unified Camera Logic --- */
const captureAiBtn = document.getElementById('capture-ai-btn');
const sendToAiBtn = document.getElementById('send-to-ai-btn');
const cameraControls = document.getElementById('camera-controls');
const photoPreview = document.getElementById('photo-preview');
const photoPreviewContainer = document.getElementById('photo-preview-container');
const photoContext = document.getElementById('photo-context');
const photoStatus = document.getElementById('photo-analysis-status');
const photoResult = document.getElementById('photo-result-form');

let currentFacingMode = "environment";

async function capturePhoto() {
    const video = document.querySelector('#reader video');
    if (!video) {
        showToast('Kamera nicht bereit.', 'error');
        return;
    }

    // Effect
    if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(50);
    
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    photoPreview.src = dataUrl;
    photoPreviewContainer.classList.remove('hidden');
    
    const readerWrapper = document.getElementById('reader-wrapper');
    if (readerWrapper) readerWrapper.classList.add('hidden');
    if (cameraControls) cameraControls.classList.add('hidden');
    if (sendToAiBtn) sendToAiBtn.classList.remove('hidden');
    
    // Stop scanner to save resources during analysis
    await stopScanner();
}

if (captureAiBtn) captureAiBtn.addEventListener('click', capturePhoto);
if (sendToAiBtn) sendToAiBtn.addEventListener('click', analyzePhoto);

async function analyzePhoto() {
    if (!photoPreview.src || photoPreview.src === '') {
        showToast('Bitte erst ein Foto aufnehmen.', 'error');
        return;
    }
    photoStatus.textContent = 'Analysiere Foto mit KI...';
    photoStatus.classList.remove('hidden');
    if (sendToAiBtn) {
        sendToAiBtn.disabled = true;
        sendToAiBtn.textContent = 'Analysiere...';
    }
    const b64 = photoPreview.src.split(',')[1];
    const ctx = photoContext ? photoContext.value.trim() : '';
    const prompt = 'Analysiere dieses Foto von Lebensmitteln. Zusätzliche Infos vom User: "' + ctx + '". Priorisiere die Angaben des Users bei Widersprüchen zum Bild. Antworte NUR mit einem JSON-Objekt (kein Markdown): {"name":"Name","portion_g":Zahl,"kcal_total":Zahl,"protein_total":Zahl,"carbs_total":Zahl,"fat_total":Zahl,"confidence":"low|medium|high","notes":"Kurze Notiz"}';
    try {
        const res = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: b64 } }] }] })
        });
        
        const data = await res.json();

        if (!res.ok) {
            console.error('Server error:', data);
            let msg = 'API-Fehler';
            if (typeof data.error === 'string') msg = data.error;
            else if (data.error && data.error.message) msg = data.error.message;
            else if (data.message) msg = data.message;
            showToast(`KI-Fehler: ${msg}`, 'error');
            throw new Error(msg);
        }

        let raw = '';
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
            raw = data.candidates[0].content.parts[0].text || '';
        }
        raw = raw.replace(/```json|```/g, '').trim();
        const p = JSON.parse(raw);
        if (!p || Object.keys(p).length === 0) throw new Error('Empty AI response');
        aiName.value = p.name || '';
        aiKcal.value = p.kcal_total || '';
        aiProtein.value = p.protein_total || '';
        aiCarbs.value = p.carbs_total || '';
        aiFat.value = p.fat_total || '';
        aiPortion.value = p.portion_g || '';
        const c = (p.confidence || 'medium').toLowerCase();
        aiConfBadge.className = '';
        aiConfBadge.classList.add(c === 'high' ? 'conf-badge-high' : c === 'low' ? 'conf-badge-low' : 'conf-badge-medium');
        aiConfBadge.textContent = 'Konfidenz: ' + c.toUpperCase();
        aiNotes.textContent = p.notes || '';
        if (c === 'low') aiConfLow.classList.remove('hidden'); else aiConfLow.classList.add('hidden');
        photoResult.classList.remove('hidden');
        photoStatus.classList.add('hidden');
    } catch (err) {
        console.error('KI Fehler:', err);
        photoStatus.textContent = 'Fehler bei der KI-Analyse.';
        showToast('KI-Analyse fehlgeschlagen (evtl. ungültiges JSON oder API-Fehler).', 'error');
    } finally {
        if (sendToAiBtn) {
            sendToAiBtn.disabled = false;
            sendToAiBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="margin-right: 0.5rem;">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Analyse starten
            `;
            sendToAiBtn.classList.add('hidden');
        }
    }
}

if (aiAddBtn) {
    aiAddBtn.addEventListener('click', () => {
        const name = aiName.value.trim() || 'Unbekanntes Gericht';
        const entry = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            name: name,
            brand: 'KI-Analyse',
            kcal: parseFloat(aiKcal.value) || 0,
            protein: parseFloat(aiProtein.value) || 0,
            amount: parseFloat(aiPortion.value) || 100,
            unit: 'g',
            carbs: parseFloat(aiCarbs.value) || 0,
            fat: parseFloat(aiFat.value) || 0,
            category: document.getElementById('ai-category') ? document.getElementById('ai-category').value : 'Snack'
        };
        const logs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        logs.push(entry);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
        if (entry.kcal > 600) fireHeavyMascot();
        updateRecentItems(entry);
        updateProgressUI();
        navigateToTab('tab-progress');
        showToast(name + ' hinzugefügt!', 'success');
        photoResult.classList.add('hidden');
        photoPreviewContainer.classList.add('hidden');
        const readerWrapper = document.getElementById('reader-wrapper');
        const cameraControls = document.getElementById('camera-controls');
        if (readerWrapper) readerWrapper.classList.remove('hidden');
        if (cameraControls) cameraControls.classList.remove('hidden');
        photoPreview.src = '';
        if (photoContext) photoContext.value = '';
        // Restart scanner after add
        startScanner();
    });
}

/* --- Weight Logging --- */
const weightInput = document.getElementById('weight-input');
const weightLogBtn = document.getElementById('weight-log-btn');
const weightChartCanvas = document.getElementById('weight-chart');
const weightRecentList = document.getElementById('weight-recent-list');
const weightTrend = document.getElementById('weight-trend');

function getWL() { return JSON.parse(localStorage.getItem(WEIGHT_KEY) || '[]'); }
function saveWL(logs) { localStorage.setItem(WEIGHT_KEY, JSON.stringify(logs)); }

function rWC() {
    const logs = getWL();
    if (!logs.length || !weightChartCanvas) return;
    const sorted = logs.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    const last30 = sorted.slice(-30);
    const labels = last30.map(l => {
        const d = new Date(l.date);
        return d.getDate() + '.' + (d.getMonth() + 1);
    });
    const data = last30.map(l => l.kg);
    if (weightChartInstance) weightChartInstance.destroy();
    const ctx = weightChartCanvas.getContext('2d');
    weightChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Gewicht (kg)',
                data: data,
                borderColor: '#a3a3a3',
                backgroundColor: 'rgba(163,163,163,0.1)',
                borderWidth: 2,
                pointBackgroundColor: '#a3a3a3',
                pointRadius: 3,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#525252', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#525252', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        }
    });
}

function rWL() {
    const logs = getWL();
    const sorted = logs.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    const last7 = sorted.slice(0, 7);
    if (weightTrend && last7.length >= 2) {
        const diff = last7[0].kg - last7[last7.length - 1].kg;
        const s = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';
        const c = diff > 0 ? '#ef4444' : diff < 0 ? '#a3a3a3' : '#525252';
        weightTrend.innerHTML = '<span style="color:' + c + '">' + s + ' ' + Math.abs(diff).toFixed(1) + ' kg (7 Tage)</span>';
    } else if (weightTrend) weightTrend.textContent = '';
    if (!weightRecentList) return;
    weightRecentList.innerHTML = '';
    last7.forEach(l => {
        const item = document.createElement('div');
        item.className = 'log-item log-item-animated';
        const d = new Date(l.date);
        item.innerHTML = '<div class="log-item-info"><span class="title">' + d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }) + '</span><span class="subtitle">' + l.date + '</span></div><div class="log-item-right"><div class="log-item-values"><div class="kcal">' + l.kg.toFixed(1) + ' kg</div></div><button class="btn-delete" onclick="rwEntry(\'' + l.date + '\')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button></div>';
        weightRecentList.appendChild(item);
    });
    if (!last7.length) {
        weightRecentList.innerHTML = '<div class="empty-state"><p style="margin:0">Keine Gewichtseinträge.</p></div>';
    }
}

window.rwEntry = function (dateStr) {
    let logs = getWL();
    logs = logs.filter(l => l.date !== dateStr);
    saveWL(logs);
    rWC();
    rWL();
    showToast('Eintrag gelöscht', 'info');
};

function lw() {
    const raw = weightInput.value.replace(',', '.');
    const kg = parseFloat(raw);
    if (isNaN(kg) || kg <= 0) {
        showToast('Bitte gültiges Gewicht eingeben.', 'error');
        return;
    }
    const today = new Date().toISOString().slice(0, 10);
    let logs = getWL();
    const ex = logs.findIndex(l => l.date === today);
    if (ex >= 0) logs[ex].kg = kg; else logs.push({ date: today, kg: kg });
    logs.sort((a, b) => new Date(a.date) - new Date(b.date));
    saveWL(logs);
    weightInput.value = '';
    rWC();
    rWL();
    showToast('Gewicht eingetragen: ' + kg + ' kg', 'success');
}

if (weightLogBtn) weightLogBtn.addEventListener('click', lw);
if (weightInput) weightInput.addEventListener('keydown', e => { if (e.key === 'Enter') lw(); });
rWC(); rWL();

/* --- Recent Items Helper --- */
function updateRecentItems(item) {
    let recents = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    // Filter out same name to avoid duplicates
    recents = recents.filter(r => r.name !== item.name);
    // Add to front
    recents.unshift({
        name: item.name,
        kcal_100: (item.kcal / item.amount) * 100,
        proteins_100: (item.protein / item.amount) * 100,
        amount: item.amount,
        category: item.category
    });
    // Keep 10
    if (recents.length > 10) recents = recents.slice(0, 10);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recents));
}

function renderRecentItems() {
    if (!ELEMENTS.recentItemsList) return;
    const recents = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    ELEMENTS.recentItemsList.innerHTML = '';
    
    if (recents.length === 0) {
        document.getElementById('recent-items-container').classList.add('hidden');
        return;
    }
    document.getElementById('recent-items-container').classList.remove('hidden');

    recents.forEach((item, index) => {
        const bubble = document.createElement('div');
        bubble.className = 'recent-item-bubble';
        bubble.innerHTML = `
            <span class="name">${escapeHtml(item.name)}</span>
            <span class="stats">${Math.round(item.kcal_100 * item.amount / 100)} kcal</span>
        `;
        bubble.onclick = () => addRecentItem(index);
        ELEMENTS.recentItemsList.appendChild(bubble);
    });
}

function addRecentItem(index) {
    const recents = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    const item = recents[index];
    if (!item) return;

    const entry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        name: item.name,
        brand: 'Favorit',
        kcal: (item.kcal_100 / 100) * item.amount,
        protein: (item.proteins_100 / 100) * item.amount,
        amount: item.amount,
        unit: 'g',
        category: item.category || 'Snack'
    };

    const logs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    logs.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    if (entry.kcal > 600) fireHeavyMascot();
    
    // Update timestamp in recents to move to front
    updateRecentItems(entry);
    
    updateProgressUI();
    navigateToTab('tab-progress');
    showToast(`${item.name} erneut hinzugefügt!`, 'success');
}
