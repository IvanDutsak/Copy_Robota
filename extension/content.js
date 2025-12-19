// Content script for Silpo Data Extractor
// This script runs on back-office.silpo.ua/dams/assemblers-key-indicators

console.log('🔌 Silpo Data Extractor: Content script loaded');

// Add floating button to the page
function addFloatingButton() {
    // Check if button already exists
    if (document.getElementById('silpo-extractor-btn')) {
        return;
    }
    
    const btn = document.createElement('button');
    btn.id = 'silpo-extractor-btn';
    btn.innerHTML = '📊 Витягнути дані';
    btn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 999999;
        padding: 12px 20px;
        background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
        color: white;
        border: none;
        border-radius: 25px;
        font-size: 14px;
        font-weight: bold;
        cursor: pointer;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
        transition: all 0.3s ease;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;
    
    btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'scale(1.05)';
        btn.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.4)';
    });
    
    btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'scale(1)';
        btn.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3)';
    });
    
    btn.addEventListener('click', extractAndSave);
    
    document.body.appendChild(btn);
    console.log('🔘 Floating button added');
}

// Extract data from the table
function extractData() {
    const assemblers = [];
    
    // Get date from page
    let dateStr = '';
    const dateInputs = document.querySelectorAll('input[type="date"], ecomui-date-picker input, [class*="date"] input');
    dateInputs.forEach(input => {
        if (input.value) {
            dateStr = input.value;
        }
    });
    
    // Also try to get date from text
    if (!dateStr) {
        const dateText = document.querySelector('[class*="date-picker"] span, [class*="period"] span');
        if (dateText) {
            dateStr = dateText.textContent.trim();
        }
    }
    
    // Find all table rows
    const tables = document.querySelectorAll('table');
    console.log('Found tables:', tables.length);
    
    tables.forEach(table => {
        const rows = table.querySelectorAll('tbody tr, tr');
        console.log('Found rows in table:', rows.length);
        
        rows.forEach((row, index) => {
            const cells = row.querySelectorAll('td');
            
            if (cells.length >= 5) {
                // Try to find name cell
                let name = '';
                let dataStartIndex = 0;
                
                for (let i = 0; i < Math.min(3, cells.length); i++) {
                    const cellText = cells[i].textContent.trim();
                    // Check if this looks like a name (contains Cyrillic letters and is long enough)
                    if (cellText.length > 10 && /[а-яА-ЯіІїЇєЄ]/.test(cellText) && !cellText.includes('Всього')) {
                        name = cellText;
                        dataStartIndex = i + 1;
                        break;
                    }
                }
                
                if (!name) return;
                
                // Parse numeric values
                const parseNum = (idx) => {
                    if (idx >= cells.length) return 0;
                    const text = cells[idx].textContent.trim().replace(/\s/g, '').replace(',', '.');
                    const num = parseFloat(text);
                    return isNaN(num) ? 0 : num;
                };
                
                const assembler = {
                    name: name,
                    dcCollected: parseNum(dataStartIndex),
                    storeCollected: parseNum(dataStartIndex + 1),
                    packed: parseNum(dataStartIndex + 2),
                    dcMoved: parseNum(dataStartIndex + 3),
                    storeMoved: parseNum(dataStartIndex + 4),
                    placedQty: parseNum(dataStartIndex + 5),
                    placedKg: parseNum(dataStartIndex + 6)
                };
                
                // Only add if we have valid data
                if (assembler.dcCollected > 0 || assembler.storeCollected > 0 || assembler.packed > 0) {
                    assemblers.push(assembler);
                    console.log('✅ Found:', assembler.name);
                }
            }
        });
    });
    
    return {
        date: dateStr,
        assemblers: assemblers,
        extractedAt: new Date().toISOString()
    };
}

// Extract and save data
async function extractAndSave() {
    const btn = document.getElementById('silpo-extractor-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Витягування...';
    btn.disabled = true;
    
    try {
        const data = extractData();
        
        if (data.assemblers.length === 0) {
            showNotification('❌ Не знайдено даних. Переконайтеся, що таблиця завантажена.', 'error');
            return;
        }
        
        // Save to chrome storage
        await chrome.storage.local.set({ 
            silpoData: data,
            lastUpdate: new Date().toISOString()
        });
        
        showNotification(`✅ Успішно збережено ${data.assemblers.length} записів!`, 'success');
        
        console.log('📊 Extracted data:', data);
        
    } catch (e) {
        console.error('Error:', e);
        showNotification('❌ Помилка: ' + e.message, 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// Show notification
function showNotification(message, type) {
    // Remove existing notification
    const existing = document.getElementById('silpo-notification');
    if (existing) {
        existing.remove();
    }
    
    const notification = document.createElement('div');
    notification.id = 'silpo-notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999999;
        padding: 15px 25px;
        background: ${type === 'success' ? '#4CAF50' : '#f44336'};
        color: white;
        border-radius: 10px;
        font-size: 14px;
        font-weight: bold;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
        animation: slideIn 0.3s ease;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Initialize
setTimeout(addFloatingButton, 1000);

// Re-add button if page updates
const observer = new MutationObserver(() => {
    if (!document.getElementById('silpo-extractor-btn')) {
        addFloatingButton();
    }
});

observer.observe(document.body, { childList: true, subtree: true });
