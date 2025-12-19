// Popup script for Silpo Data Extractor

document.addEventListener('DOMContentLoaded', async () => {
    const extractBtn = document.getElementById('extract-btn');
    const copyBtn = document.getElementById('copy-btn');
    const pageStatus = document.getElementById('page-status');
    const dateStatus = document.getElementById('date-status');
    const savedCount = document.getElementById('saved-count');
    const loading = document.getElementById('loading');
    const message = document.getElementById('message');
    const dataPreview = document.getElementById('data-preview');
    const assemblersList = document.getElementById('assemblers-list');
    
    // Check current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab.url && tab.url.includes('back-office.silpo.ua/dams/assemblers-key-indicators')) {
        pageStatus.textContent = 'Готово ✓';
        pageStatus.classList.add('success');
        extractBtn.disabled = false;
        
        // Try to get date from page
        try {
            const result = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    // Try to find date picker value
                    const datePicker = document.querySelector('ecomui-date-picker input, [class*="date"] input');
                    if (datePicker) {
                        return datePicker.value;
                    }
                    return null;
                }
            });
            
            if (result && result[0] && result[0].result) {
                dateStatus.textContent = result[0].result;
            }
        } catch (e) {
            console.log('Could not get date:', e);
        }
    } else if (tab.url && tab.url.includes('back-office.silpo.ua')) {
        pageStatus.textContent = 'Інша сторінка';
        pageStatus.classList.add('warning');
        showMessage('Перейдіть на сторінку "Ключові показники збиральників"', 'info');
    } else {
        pageStatus.textContent = 'Не back-office';
        pageStatus.classList.add('error');
        showMessage('Відкрийте back-office.silpo.ua', 'error');
    }
    
    // Load saved data
    loadSavedData();
    
    // Extract button click
    extractBtn.addEventListener('click', async () => {
        extractBtn.disabled = true;
        loading.style.display = 'block';
        
        try {
            const result = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: extractAssemblersData
            });
            
            if (result && result[0] && result[0].result) {
                const data = result[0].result;
                
                if (data.error) {
                    showMessage(data.error, 'error');
                } else if (data.assemblers && data.assemblers.length > 0) {
                    // Save to storage
                    await chrome.storage.local.set({ 
                        silpoData: data,
                        lastUpdate: new Date().toISOString()
                    });
                    
                    showMessage(`Успішно витягнуто ${data.assemblers.length} записів!`, 'success');
                    loadSavedData();
                    dateStatus.textContent = data.date || '-';
                } else {
                    showMessage('Не знайдено даних на сторінці', 'error');
                }
            }
        } catch (e) {
            console.error('Error:', e);
            showMessage('Помилка витягування даних: ' + e.message, 'error');
        }
        
        loading.style.display = 'none';
        extractBtn.disabled = false;
    });
    
    // Copy button click
    copyBtn.addEventListener('click', async () => {
        const data = await chrome.storage.local.get(['silpoData']);
        if (data.silpoData) {
            const jsonStr = JSON.stringify(data.silpoData, null, 2);
            await navigator.clipboard.writeText(jsonStr);
            showMessage('Дані скопійовано в буфер обміну!', 'success');
        } else {
            showMessage('Немає збережених даних', 'error');
        }
    });
    
    function showMessage(text, type) {
        message.textContent = text;
        message.className = 'message ' + type;
        message.style.display = 'block';
        
        setTimeout(() => {
            message.style.display = 'none';
        }, 5000);
    }
    
    async function loadSavedData() {
        const data = await chrome.storage.local.get(['silpoData', 'lastUpdate']);
        
        if (data.silpoData && data.silpoData.assemblers) {
            savedCount.textContent = data.silpoData.assemblers.length;
            
            // Show preview
            dataPreview.style.display = 'block';
            assemblersList.innerHTML = '';
            
            data.silpoData.assemblers.forEach(a => {
                const div = document.createElement('div');
                div.className = 'assembler-item';
                div.textContent = `${a.name}: ${a.dcCollected + a.storeCollected} зібрано`;
                assemblersList.appendChild(div);
            });
        }
    }
});

// Function to extract data from the page (runs in content script context)
function extractAssemblersData() {
    try {
        const assemblers = [];
        
        // Get date from page
        let dateStr = '';
        const dateInput = document.querySelector('ecomui-date-picker input, [class*="date"] input, input[type="date"]');
        if (dateInput) {
            dateStr = dateInput.value;
        }
        
        // Find table rows
        const rows = document.querySelectorAll('table tr, [class*="table"] tr, tbody tr');
        
        console.log('Found rows:', rows.length);
        
        rows.forEach((row, index) => {
            const cells = row.querySelectorAll('td');
            
            if (cells.length >= 5) {
                // Get name from first or second cell
                let nameCell = cells[0];
                let name = nameCell ? nameCell.textContent.trim() : '';
                
                // If first cell is checkbox, use second
                if (name === '' || name.length < 3) {
                    nameCell = cells[1];
                    name = nameCell ? nameCell.textContent.trim() : '';
                }
                
                // Skip if not a valid name
                if (!name || name.length < 5 || name === 'ПІБ' || name.includes('Всього')) {
                    return;
                }
                
                // Parse numeric values
                const parseNum = (cell) => {
                    if (!cell) return 0;
                    const text = cell.textContent.trim().replace(/\s/g, '').replace(',', '.');
                    const num = parseFloat(text);
                    return isNaN(num) ? 0 : num;
                };
                
                // Determine which cells contain the data
                let dataStartIndex = 1;
                if (cells[0].querySelector('input[type="checkbox"]') || cells[0].textContent.trim().length < 3) {
                    dataStartIndex = 2;
                }
                
                const assembler = {
                    name: name,
                    dcCollected: parseNum(cells[dataStartIndex]),
                    storeCollected: parseNum(cells[dataStartIndex + 1]),
                    packed: parseNum(cells[dataStartIndex + 2]),
                    dcMoved: parseNum(cells[dataStartIndex + 3]),
                    storeMoved: parseNum(cells[dataStartIndex + 4]),
                    placedQty: parseNum(cells[dataStartIndex + 5]),
                    placedKg: parseNum(cells[dataStartIndex + 6])
                };
                
                // Only add if we have a valid name and some data
                if (assembler.name && (assembler.dcCollected > 0 || assembler.storeCollected > 0 || assembler.packed > 0)) {
                    assemblers.push(assembler);
                    console.log('Found assembler:', assembler);
                }
            }
        });
        
        // If no data found in table, try alternative selectors
        if (assemblers.length === 0) {
            // Try finding data in different structure
            const dataRows = document.querySelectorAll('[class*="row"], [class*="item"]');
            console.log('Trying alternative selectors, found:', dataRows.length);
        }
        
        return {
            date: dateStr,
            assemblers: assemblers,
            extractedAt: new Date().toISOString()
        };
        
    } catch (e) {
        console.error('Extraction error:', e);
        return { error: e.message };
    }
}
