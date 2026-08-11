let fullData = {};
let wordsList = [];
let historyUrls = [];

// Helper for level badges
function getLevelBadgeHtml(level) {
    if (level === 650) return `<span class="level-badge">🟢 650+</span>`;
    if (level === 750) return `<span class="level-badge">🔷 750+</span>`;
    return `<span class="level-badge">🔶 900+</span>`;
}

function getExamFocusHtml(examFocus) {
    if (!examFocus || Object.keys(examFocus).length === 0) return '';
    
    let html = `<div class="exam-focus-box">`;
    if (examFocus.grammar) html += `<div class="exam-focus-item"><span class="focus-tag tag-grammar">文法</span><div>${examFocus.grammar}</div></div>`;
    if (examFocus.synonyms) html += `<div class="exam-focus-item"><span class="focus-tag tag-synonyms">同義詞</span><div>${examFocus.synonyms}</div></div>`;
    if (examFocus.phrases) html += `<div class="exam-focus-item"><span class="focus-tag tag-phrases">常考語句</span><div>${examFocus.phrases}</div></div>`;
    if (examFocus.confusingWords) html += `<div class="exam-focus-item"><span class="focus-tag tag-confusingWords">易混淆</span><div>${examFocus.confusingWords}</div></div>`;
    html += `</div>`;
    return html;
}

// Render cards
function renderCards(words, containerId, filterLevels = ['all'], filterStatuses = ['all'], searchQuery = '') {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    // Filter
    let filteredWords = words;
    if (!filterLevels.includes('all')) {
        filteredWords = filteredWords.filter(w => filterLevels.includes(w.level.toString()));
    }
    if (!filterStatuses.includes('all')) {
        filteredWords = filteredWords.filter(w => filterStatuses.includes((w.status || 0).toString()));
    }
    
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredWords = filteredWords.filter(w => 
            w.word.toLowerCase().includes(query) || 
            w.meaning.toLowerCase().includes(query)
        );
    }

    // Sort words by level initially
    filteredWords.sort((a, b) => a.level - b.level);

    filteredWords.forEach((item, index) => {
        const card = document.createElement('div');
        const status = item.status || 0;
        card.className = `flashcard level-${item.level}`;
        card.style.animationDelay = `${(index % 20) * 0.05}s`;
        
        const plainExEn = item.exEn ? item.exEn.replace(/<[^>]+>/g, '').replace(/'/g, "\\'") : '';
        
        card.innerHTML = `
            <div class="card-header">
                <div>
                    <div class="title-row">
                        <h2 class="word-title">${item.word}</h2>
                        <button class="pronounce-btn" onclick="pronounceWord('${item.word}')" title="聆聽發音">🔊</button>
                    </div>
                    <span class="word-pos">${item.pos}</span>
                    <span class="word-meaning">${item.meaning}</span>
                </div>
                ${getLevelBadgeHtml(item.level)}
            </div>
            
            <div class="card-body">
                <div class="info-group">
                    <h4>多益常見考法</h4>
                    <div class="info-content">${item.context}</div>
                </div>
                
                <div class="info-group">
                    <h4>核心意思</h4>
                    <div class="info-content">${item.core}</div>
                </div>
                
                <div class="info-group">
                    <h4>高頻搭配</h4>
                    <div class="collocations">
                        ${(item.collocations || []).map(c => `<span class="collocation-tag">${c}</span>`).join('')}
                    </div>
                </div>
                
                ${getExamFocusHtml(item.examFocus)}
                
                <div class="example-box">
                    <div class="title-row" style="margin-bottom: 0.5rem; justify-content: space-between; align-items: flex-start;">
                        <div class="example-en" style="margin-bottom: 0;">${item.exEn}</div>
                        <button class="pronounce-btn" style="padding: 0; font-size: 1.1rem;" onclick="pronounceWord('${plainExEn}')" title="聆聽例句">🔊</button>
                    </div>
                    <div class="example-zh">${item.exZh}</div>
                </div>
                
                <div class="status-toggles">
                    <button class="status-btn s0 ${status === 0 ? 'active' : ''}" onclick="updateStatus('${item.word}', 0)">🔴 不熟</button>
                    <button class="status-btn s1 ${status === 1 ? 'active' : ''}" onclick="updateStatus('${item.word}', 1)">🟡 普通</button>
                    <button class="status-btn s2 ${status === 2 ? 'active' : ''}" onclick="updateStatus('${item.word}', 2)">🟢 熟悉</button>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
}

function renderHistory() {
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = '';
    
    if (historyUrls.length === 0) {
        historyList.innerHTML = '<li style="color: rgba(255,255,255,0.5); font-size: 0.85rem;">尚未有紀錄</li>';
        return;
    }
    
    historyUrls.forEach(url => {
        const li = document.createElement('li');
        li.innerHTML = `<a href="${url}" target="_blank">🔗 ${url}</a>`;
        historyList.appendChild(li);
    });
}

function updateUI() {
    const activeLevels = Array.from(document.querySelectorAll('.filter-btn.active')).map(b => b.dataset.level);
    const activeStatuses = Array.from(document.querySelectorAll('.filter-status-btn.active')).map(b => b.dataset.status);
    const searchQuery = document.getElementById('searchInput') ? document.getElementById('searchInput').value : '';
    renderCards(wordsList, 'words-container', activeLevels, activeStatuses, searchQuery);
    renderHistory();
}

// Fetch data from backend
async function fetchWords() {
    try {
        const res = await fetch('/api/words');
        if (res.ok) {
            fullData = await res.json();
            const scenarioSelect = document.getElementById('scenarioSelect');
            switchScenario(scenarioSelect ? scenarioSelect.value : 'TOEIC');
        }
    } catch (e) {
        console.error("Failed to fetch words", e);
    }
}

function switchScenario(scenario) {
    const scenarioData = fullData[scenario] || { words: [], historyUrls: [] };
    wordsList = scenarioData.words || [];
    historyUrls = scenarioData.historyUrls || [];
    updateUI();
}

// Status update API
async function updateStatus(word, newStatus) {
    try {
        const scenario = document.getElementById('scenarioSelect').value;
        const res = await fetch('/api/update_status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word: word, status: newStatus, scenario: scenario })
        });
        if (res.ok) {
            // Update local state and UI
            const w = wordsList.find(x => x.word === word);
            if (w) {
                w.status = newStatus;
                updateUI();
            }
        }
    } catch (e) {
        console.error("Failed to update status", e);
    }
}

// Pronunciation
window.pronounceWord = function(word) {
    if ('speechSynthesis' in window) {
        const msg = new SpeechSynthesisUtterance(word);
        msg.lang = 'en-US';
        window.speechSynthesis.speak(msg);
    } else {
        alert("您的瀏覽器不支援語音合成功能");
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Load API Key from local storage
    const savedApiKey = localStorage.getItem('geminiApiKey');
    if (savedApiKey) {
        document.getElementById('apiKey').value = savedApiKey;
    }

    // Fetch initial data
    fetchWords();
    
    // Tab switching (yt vs manual)
    const miniTabBtns = document.querySelectorAll('.mini-tab-btn');
    const inputSections = document.querySelectorAll('.input-section');
    miniTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            miniTabBtns.forEach(b => b.classList.remove('active'));
            inputSections.forEach(s => s.classList.remove('active-section'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active-section');
        });
    });
    
    // Filtering (Level)
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.level === 'all') {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            } else {
                const allBtn = document.querySelector('.filter-btn[data-level="all"]');
                if (allBtn) allBtn.classList.remove('active');
                btn.classList.toggle('active');
                if (document.querySelectorAll('.filter-btn.active').length === 0) {
                    if (allBtn) allBtn.classList.add('active');
                }
            }
            updateUI();
        });
    });
    
    // Filtering (Status)
    const filterStatusBtns = document.querySelectorAll('.filter-status-btn');
    filterStatusBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.status === 'all') {
                filterStatusBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            } else {
                const allBtn = document.querySelector('.filter-status-btn[data-status="all"]');
                if (allBtn) allBtn.classList.remove('active');
                btn.classList.toggle('active');
                if (document.querySelectorAll('.filter-status-btn.active').length === 0) {
                    if (allBtn) allBtn.classList.add('active');
                }
            }
            updateUI();
        });
    });

    const apiKeyInput = document.getElementById('apiKey');
    const scenarioSelect = document.getElementById('scenarioSelect');
    const statusMessage = document.getElementById('statusMessage');
    const searchInput = document.getElementById('searchInput');

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            updateUI();
        });
    }

    scenarioSelect.addEventListener('change', () => {
        switchScenario(scenarioSelect.value);
    });

    function checkApiKey() {
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            statusMessage.textContent = '請輸入 Gemini API Key';
            statusMessage.className = 'status-message error';
            return null;
        }
        localStorage.setItem('geminiApiKey', apiKey);
        return apiKey;
    }

    // Generate YouTube Button logic
    const generateBtn = document.getElementById('generateBtn');
    const ytUrlInput = document.getElementById('ytUrl');
    const loader = document.getElementById('loader');

    generateBtn.addEventListener('click', async () => {
        const apiKey = checkApiKey();
        if (!apiKey) return;
        
        const ytUrl = ytUrlInput.value.trim();
        if (!ytUrl) {
            statusMessage.textContent = '請輸入 YouTube 影片網址';
            statusMessage.className = 'status-message error';
            return;
        }

        generateBtn.disabled = true;
        loader.style.display = 'block';
        statusMessage.textContent = '正在分析字幕並生成單字卡中，請稍候...(大約需要30-60秒)';
        statusMessage.className = 'status-message';

        try {
            const res = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: ytUrl, api_key: apiKey, scenario: scenarioSelect.value })
            });

            if (res.ok) {
                statusMessage.textContent = '成功生成並記憶單字！';
                statusMessage.className = 'status-message success';
                ytUrlInput.value = '';
                await fetchWords();
            } else {
                const err = await res.json();
                statusMessage.textContent = '錯誤: ' + (err.detail || '未知錯誤');
                statusMessage.className = 'status-message error';
            }
        } catch (e) {
            statusMessage.textContent = '網路錯誤或伺服器無回應';
            statusMessage.className = 'status-message error';
        } finally {
            generateBtn.disabled = false;
            loader.style.display = 'none';
        }
    });

    // Generate Manual Button logic
    const generateManualBtn = document.getElementById('generateManualBtn');
    const manualWordsInput = document.getElementById('manualWords');
    const manualLoader = document.getElementById('manualLoader');

    generateManualBtn.addEventListener('click', async () => {
        const apiKey = checkApiKey();
        if (!apiKey) return;
        
        const words = manualWordsInput.value.trim();
        if (!words) {
            statusMessage.textContent = '請輸入至少一個單字';
            statusMessage.className = 'status-message error';
            return;
        }

        generateManualBtn.disabled = true;
        manualLoader.style.display = 'block';
        statusMessage.textContent = '正在由 AI 擴充單字資訊，請稍候...';
        statusMessage.className = 'status-message';

        try {
            const res = await fetch('/api/generate_manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ words: words, api_key: apiKey, scenario: scenarioSelect.value })
            });

            if (res.ok) {
                statusMessage.textContent = '成功生成並記憶手動單字！';
                statusMessage.className = 'status-message success';
                manualWordsInput.value = '';
                await fetchWords();
            } else {
                const err = await res.json();
                statusMessage.textContent = '錯誤: ' + (err.detail || '未知錯誤');
                statusMessage.className = 'status-message error';
            }
        } catch (e) {
            statusMessage.textContent = '網路錯誤或伺服器無回應';
            statusMessage.className = 'status-message error';
        } finally {
            generateManualBtn.disabled = false;
            manualLoader.style.display = 'none';
        }
    });

    // Clear Data logic
    const clearDataBtn = document.getElementById('clearDataBtn');
    if (clearDataBtn) {
        clearDataBtn.addEventListener('click', async () => {
            if (!confirm("確定要清空當前情境的所有單字庫嗎？這將會刪除所有已儲存的單字與紀錄！")) return;
            
            try {
                const res = await fetch('/api/clear_data', { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ scenario: scenarioSelect.value })
                });
                if (res.ok) {
                    statusMessage.textContent = '單字庫已成功清空！';
                    statusMessage.className = 'status-message success';
                    await fetchWords();
                }
            } catch (e) {
                statusMessage.textContent = '清空失敗';
                statusMessage.className = 'status-message error';
            }
        });
    }
});
