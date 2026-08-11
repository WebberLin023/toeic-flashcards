let fullData = {};
let wordsList = [];
let historyUrls = [];
let previewWordsList = [];
let selectedWordsForPlayback = new Set();

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
        filteredWords = filteredWords.filter(w => {
            const meaningsText = (w.meanings || [{meaning: w.meaning}]).map(m => m.meaning).join(' ');
            return w.word.toLowerCase().includes(query) || meaningsText.toLowerCase().includes(query);
        });
    }

    // Sort words by level initially
    filteredWords.sort((a, b) => a.level - b.level);

    filteredWords.forEach((item, index) => {
        const card = document.createElement('div');
        const status = item.status || 0;
        card.className = `flashcard level-${item.level}`;
        card.style.animationDelay = `${(index % 20) * 0.05}s`;
        
        let meaningsHtml = '';
        const meaningsList = item.meanings || [{
            meaning: item.meaning,
            pos: item.pos,
            exEn: item.exEn,
            exZh: item.exZh
        }];
        
        meaningsList.forEach((m, idx) => {
            const plainExEn = m.exEn ? m.exEn.replace(/<[^>]+>/g, '').replace(/'/g, "\\'") : '';
            meaningsHtml += `
                <div class="meaning-group" style="margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: ${idx < meaningsList.length - 1 ? '1px dashed rgba(255,255,255,0.1)' : 'none'};">
                    <div style="margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                        <span class="word-pos">${m.pos}</span>
                        <span class="word-meaning">${m.meaning}</span>
                    </div>
                    <div class="example-box">
                        <div class="title-row" style="margin-bottom: 0.5rem; justify-content: space-between; align-items: flex-start;">
                            <div class="example-en" style="margin-bottom: 0;">${m.exEn}</div>
                            <button class="pronounce-btn" style="padding: 0; font-size: 1.1rem;" onclick="pronounceWord('${plainExEn}')" title="聆聽例句">🔊</button>
                        </div>
                        <div class="example-zh">${m.exZh}</div>
                    </div>
                </div>
            `;
        });
        
        card.innerHTML = `
            <div class="card-header">
                <div>
                    <div class="title-row" style="align-items: center; display: flex; gap: 0.5rem;">
                        <input type="checkbox" class="word-checkbox" data-word="${item.word}" ${selectedWordsForPlayback.has(item.word) ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;">
                        <h2 class="word-title">${item.word}</h2>
                        <button class="pronounce-btn" onclick="pronounceWord('${item.word}')" title="聆聽發音">🔊</button>
                    </div>
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
                
                ${meaningsHtml}
                
                <div class="status-toggles">
                    <button class="status-btn s0 ${status === 0 ? 'active' : ''}" onclick="updateStatus('${item.word}', 0)">🔴 不熟</button>
                    <button class="status-btn s1 ${status === 1 ? 'active' : ''}" onclick="updateStatus('${item.word}', 1)">🟡 普通</button>
                    <button class="status-btn s2 ${status === 2 ? 'active' : ''}" onclick="updateStatus('${item.word}', 2)">🟢 熟悉</button>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });

    // Add event listeners for checkboxes
    document.querySelectorAll('.word-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const word = e.target.dataset.word;
            if (e.target.checked) {
                selectedWordsForPlayback.add(word);
            } else {
                selectedWordsForPlayback.delete(word);
            }
            updateSelectAllCheckboxState();
        });
    });
}

function updateSelectAllCheckboxState() {
    const checkboxes = Array.from(document.querySelectorAll('.word-checkbox'));
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (checkboxes.length === 0) {
        if(selectAllCheckbox) selectAllCheckbox.checked = false;
        return;
    }
    const allChecked = checkboxes.every(cb => cb.checked);
    if(selectAllCheckbox) selectAllCheckbox.checked = allChecked;
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

function updateStats() {
    let levelCounts = { '650': 0, '750': 0, '900': 0, 'all': wordsList.length };
    let statusCounts = { '0': 0, '1': 0, '2': 0, 'all': wordsList.length };

    wordsList.forEach(w => {
        if (levelCounts[w.level] !== undefined) levelCounts[w.level]++;
        const st = (w.status || 0).toString();
        if (statusCounts[st] !== undefined) statusCounts[st]++;
    });

    document.querySelector('.filter-btn[data-level="all"]').textContent = `全部程度 (${levelCounts['all']})`;
    document.querySelector('.filter-btn[data-level="650"]').textContent = `🟢 650+ (${levelCounts['650']})`;
    document.querySelector('.filter-btn[data-level="750"]').textContent = `🔷 750+ (${levelCounts['750']})`;
    document.querySelector('.filter-btn[data-level="900"]').textContent = `🔶 900+ (${levelCounts['900']})`;

    document.querySelector('.filter-status-btn[data-status="all"]').textContent = `全部狀態 (${statusCounts['all']})`;
    document.querySelector('.filter-status-btn[data-status="0"]').textContent = `🔴 不熟 (${statusCounts['0']})`;
    document.querySelector('.filter-status-btn[data-status="1"]').textContent = `🟡 普通 (${statusCounts['1']})`;
    document.querySelector('.filter-status-btn[data-status="2"]').textContent = `🟢 熟悉 (${statusCounts['2']})`;
}

function updateUI() {
    updateStats();
    const activeLevels = Array.from(document.querySelectorAll('.filter-btn.active')).map(b => b.dataset.level);
    const activeStatuses = Array.from(document.querySelectorAll('.filter-status-btn.active')).map(b => b.dataset.status);
    const searchQuery = document.getElementById('searchInput') ? document.getElementById('searchInput').value : '';
    renderCards(wordsList, 'words-container', activeLevels, activeStatuses, searchQuery);
    renderHistory();
    updateSelectAllCheckboxState();
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

// Pronunciation and Voice Management
let availableVoices = [];
function loadVoices() {
    availableVoices = window.speechSynthesis.getVoices();
}
if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
}

function getBestVoice(lang) {
    if (availableVoices.length === 0) loadVoices();
    
    // Filter voices by language
    let matchedVoices = availableVoices.filter(v => v.lang.includes(lang) || v.lang.replace('_', '-').includes(lang));
    
    if (lang === 'zh-TW') {
        // Try to find specific Taiwanese voices (Microsoft Hanhan, Yating, Google 國語（臺灣）, etc.)
        const twKeywords = ['taiwan', 'hanhan', 'yating', 'zhiwei', '國語（臺灣）'];
        for (let keyword of twKeywords) {
            const found = matchedVoices.find(v => v.name.toLowerCase().includes(keyword));
            if (found) return found;
        }
    }
    
    if (lang === 'en-US') {
        // Prefer native US voices
        const enKeywords = ['google us english', 'zira', 'samantha', 'david'];
        for (let keyword of enKeywords) {
            const found = matchedVoices.find(v => v.name.toLowerCase().includes(keyword));
            if (found) return found;
        }
    }
    
    return matchedVoices[0] || null;
}

window.pronounceWord = function(word) {
    if ('speechSynthesis' in window) {
        const msg = new SpeechSynthesisUtterance(word);
        msg.lang = 'en-US';
        const voiceEn = getBestVoice('en-US');
        if (voiceEn) msg.voice = voiceEn;
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

    // Generate Manual Preview Button logic
    const generateManualBtn = document.getElementById('generateManualBtn');
    const manualWordsInput = document.getElementById('manualWords');
    const manualLoader = document.getElementById('manualLoader');
    const manualInputContainer = document.getElementById('manualInputContainer');
    const manualPreviewContainer = document.getElementById('manualPreviewContainer');
    const confirmSaveBtn = document.getElementById('confirmSaveBtn');
    const cancelPreviewBtn = document.getElementById('cancelPreviewBtn');

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
        statusMessage.textContent = '正在由 AI 預覽擴充單字資訊，請稍候...';
        statusMessage.className = 'status-message';

        try {
            const res = await fetch('/api/preview_manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ words: words, api_key: apiKey, scenario: scenarioSelect.value })
            });

            if (res.ok) {
                const data = await res.json();
                previewWordsList = data.words || [];
                statusMessage.textContent = '預覽產生成功，請確認是否加入。';
                statusMessage.className = 'status-message success';
                
                manualInputContainer.style.display = 'none';
                manualPreviewContainer.style.display = 'block';
                renderCards(previewWordsList, 'previewCards');
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

    cancelPreviewBtn.addEventListener('click', () => {
        previewWordsList = [];
        manualPreviewContainer.style.display = 'none';
        manualInputContainer.style.display = 'block';
        statusMessage.textContent = '';
    });

    confirmSaveBtn.addEventListener('click', async () => {
        confirmSaveBtn.disabled = true;
        statusMessage.textContent = '正在儲存單字...';
        statusMessage.className = 'status-message';
        try {
            const res = await fetch('/api/save_manual_preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ words: previewWordsList, scenario: scenarioSelect.value })
            });

            if (res.ok) {
                statusMessage.textContent = '成功新增手動單字！';
                statusMessage.className = 'status-message success';
                manualWordsInput.value = '';
                previewWordsList = [];
                manualPreviewContainer.style.display = 'none';
                manualInputContainer.style.display = 'block';
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
            confirmSaveBtn.disabled = false;
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
                    selectedWordsForPlayback.clear();
                    await fetchWords();
                }
            } catch (e) {
                statusMessage.textContent = '清空失敗';
                statusMessage.className = 'status-message error';
            }
        });
    }

    // Playback Logic
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            const checkboxes = document.querySelectorAll('.word-checkbox');
            checkboxes.forEach(cb => {
                cb.checked = isChecked;
                if (isChecked) {
                    selectedWordsForPlayback.add(cb.dataset.word);
                } else {
                    selectedWordsForPlayback.delete(cb.dataset.word);
                }
            });
        });
    }

    const playSelectedBtn = document.getElementById('playSelectedBtn');
    const stopPlaybackBtn = document.getElementById('stopPlaybackBtn');

    if (playSelectedBtn) {
        playSelectedBtn.addEventListener('click', () => {
            if (selectedWordsForPlayback.size === 0) {
                alert("請先勾選想要播放的單字卡！");
                return;
            }

            if (!('speechSynthesis' in window)) {
                alert("您的瀏覽器不支援語音合成功能");
                return;
            }

            window.speechSynthesis.cancel(); // Stop any current speech
            document.querySelectorAll('.playing-highlight').forEach(el => el.classList.remove('playing-highlight'));

            // Get selected words in the order they appear on screen
            const checkboxes = Array.from(document.querySelectorAll('.word-checkbox')).filter(cb => cb.checked);
            const wordsToPlay = checkboxes.map(cb => {
                const wordStr = cb.dataset.word;
                return wordsList.find(w => w.word === wordStr) || previewWordsList.find(w => w.word === wordStr);
            }).filter(Boolean);

            if (wordsToPlay.length === 0) return;

            wordsToPlay.forEach((item, index) => {
                const meaningsList = item.meanings || [{
                    meaning: item.meaning,
                    pos: item.pos,
                    exEn: item.exEn,
                    exZh: item.exZh
                }];

                // Prepare voices
                const voiceEn = getBestVoice('en-US');
                const voiceZh = getBestVoice('zh-TW');

                // 1. English Word (First time)
                const msgWord1 = new SpeechSynthesisUtterance(item.word);
                msgWord1.lang = 'en-US';
                if (voiceEn) msgWord1.voice = voiceEn;
                msgWord1.rate = 0.9;
                
                msgWord1.onstart = () => {
                    document.querySelectorAll('.playing-highlight').forEach(el => el.classList.remove('playing-highlight'));
                    // Find the card element and highlight it
                    const cb = document.querySelector(`.word-checkbox[data-word="${item.word}"]`);
                    if (cb) {
                        const card = cb.closest('.flashcard');
                        if (card) {
                            card.classList.add('playing-highlight');
                            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    }
                };

                // 2. English Word (Second time)
                const msgWord2 = new SpeechSynthesisUtterance(item.word);
                msgWord2.lang = 'en-US';
                if (voiceEn) msgWord2.voice = voiceEn;
                msgWord2.rate = 0.9;

                // 3. Chinese Meanings
                const combinedMeanings = meaningsList.map(m => m.meaning).join('，');
                const msgMeaning = new SpeechSynthesisUtterance(combinedMeanings);
                msgMeaning.lang = 'zh-TW';
                if (voiceZh) msgMeaning.voice = voiceZh;
                msgMeaning.rate = 1.5;

                // 4. English Examples (First time)
                const combinedExamples = meaningsList.map(m => m.exEn ? m.exEn.replace(/<[^>]+>/g, '').replace(/'/g, "\\'") : '').filter(Boolean).join('. ');
                const msgEx1 = new SpeechSynthesisUtterance(combinedExamples);
                msgEx1.lang = 'en-US';
                if (voiceEn) msgEx1.voice = voiceEn;
                msgEx1.rate = 0.9;

                // 5. Chinese Examples
                const combinedZhExamples = meaningsList.map(m => m.exZh ? m.exZh.replace(/<[^>]+>/g, '') : '').filter(Boolean).join('。 ');
                const msgExZh = new SpeechSynthesisUtterance(combinedZhExamples);
                msgExZh.lang = 'zh-TW';
                if (voiceZh) msgExZh.voice = voiceZh;
                msgExZh.rate = 1.5;

                // 6. English Examples (Second time)
                const msgEx2 = new SpeechSynthesisUtterance(combinedExamples);
                msgEx2.lang = 'en-US';
                if (voiceEn) msgEx2.voice = voiceEn;
                msgEx2.rate = 0.9;

                let lastUtterance = msgMeaning;

                window.speechSynthesis.speak(msgWord1);
                window.speechSynthesis.speak(msgWord2);
                window.speechSynthesis.speak(msgMeaning);
                
                if (combinedExamples) {
                    window.speechSynthesis.speak(msgEx1);
                    if (combinedZhExamples) {
                        window.speechSynthesis.speak(msgExZh);
                    }
                    window.speechSynthesis.speak(msgEx2);
                    lastUtterance = msgEx2;
                }

                // Remove highlight when the last utterance for this word finishes
                lastUtterance.onend = () => {
                    if (index === wordsToPlay.length - 1) {
                        document.querySelectorAll('.playing-highlight').forEach(el => el.classList.remove('playing-highlight'));
                    }
                };
            });
        });
    }

    if (stopPlaybackBtn) {
        stopPlaybackBtn.addEventListener('click', () => {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
            document.querySelectorAll('.playing-highlight').forEach(el => el.classList.remove('playing-highlight'));
        });
    }
});
