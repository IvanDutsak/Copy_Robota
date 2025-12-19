from flask import Flask, request, jsonify
from flask_cors import CORS
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys
import time
import json
import re
import os

app = Flask(__name__)
CORS(app)

# Credentials for back-office
PHONE = "+380988824838"
PASSWORD = "Wanjabro228"

# Global driver instance
driver = None
logged_in = False

def get_driver():
    """Initialize and return undetected Chrome driver"""
    global driver
    
    if driver is not None:
        try:
            driver.current_url  # Check if driver is still alive
            return driver
        except:
            driver = None
    
    options = uc.ChromeOptions()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    
    driver = uc.Chrome(options=options, version_main=131)
    
    return driver

def login_to_backoffice():
    """Login to back-office.silpo.ua"""
    global logged_in, driver
    
    if logged_in:
        return True
    
    try:
        driver = get_driver()
        print("🔄 Navigating to back-office.silpo.ua...")
        driver.get("https://back-office.silpo.ua/")
        
        # Wait for page to load
        time.sleep(5)
        
        # Check if already logged in
        if "ecom" in driver.current_url or "dams" in driver.current_url:
            print("✅ Already logged in!")
            logged_in = True
            return True
        
        print("🔐 Attempting to login...")
        
        # Find phone input - try different selectors
        phone_selectors = [
            "input[type='tel']",
            "input[name='phone']",
            "input[placeholder*='телефон']",
            "input[placeholder*='phone']",
            "input[autocomplete='tel']"
        ]
        
        phone_input = None
        for selector in phone_selectors:
            try:
                phone_input = WebDriverWait(driver, 3).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, selector))
                )
                if phone_input:
                    break
            except:
                continue
        
        if not phone_input:
            # Try by XPath
            try:
                phone_input = driver.find_element(By.XPATH, "//input[@type='tel' or contains(@placeholder, 'телефон')]")
            except:
                print("❌ Could not find phone input")
                return False
        
        phone_input.clear()
        phone_input.send_keys(PHONE)
        print(f"📱 Entered phone: {PHONE}")
        
        # Find password input
        password_input = driver.find_element(By.CSS_SELECTOR, "input[type='password']")
        password_input.clear()
        password_input.send_keys(PASSWORD)
        print("🔑 Entered password")
        
        # Find and click login button
        login_selectors = [
            "button[type='submit']",
            "button.login",
            "button[class*='login']",
            "button[class*='submit']"
        ]
        
        login_btn = None
        for selector in login_selectors:
            try:
                login_btn = driver.find_element(By.CSS_SELECTOR, selector)
                if login_btn:
                    break
            except:
                continue
        
        if login_btn:
            login_btn.click()
            print("🖱️ Clicked login button")
        else:
            # Try pressing Enter
            password_input.send_keys(Keys.RETURN)
            print("⏎ Pressed Enter to submit")
        
        # Wait for login to complete
        time.sleep(8)
        
        # Check if logged in
        current_url = driver.current_url
        print(f"📍 Current URL: {current_url}")
        
        if "ecom" in current_url or "dams" in current_url or "замовлення" in driver.page_source.lower():
            print("✅ Successfully logged in to back-office")
            logged_in = True
            return True
        else:
            print("❌ Login may have failed")
            print(f"Page title: {driver.title}")
            return False
            
    except Exception as e:
        print(f"❌ Login error: {e}")
        import traceback
        traceback.print_exc()
        return False

def fetch_assemblers_data(date_str):
    """Fetch assemblers data for a specific date"""
    global logged_in, driver
    
    try:
        driver = get_driver()
        
        # Ensure we're logged in
        if not logged_in:
            if not login_to_backoffice():
                return {"error": "Failed to login"}
        
        print(f"📅 Fetching data for date: {date_str}")
        
        # Navigate to assemblers key indicators page
        driver.get("https://back-office.silpo.ua/dams/assemblers-key-indicators")
        time.sleep(5)
        
        # Wait for page to load
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "body"))
        )
        
        print("📊 Page loaded, looking for date picker...")
        
        # Click on date picker to open it
        date_picker_selectors = [
            "ecomui-date-picker",
            "[class*='date-picker']",
            "[class*='datepicker']",
            "input[type='date']",
            "[class*='period']"
        ]
        
        date_picker = None
        for selector in date_picker_selectors:
            try:
                date_picker = driver.find_element(By.CSS_SELECTOR, selector)
                if date_picker:
                    date_picker.click()
                    print(f"📅 Clicked date picker: {selector}")
                    break
            except:
                continue
        
        time.sleep(2)
        
        # Parse the date
        date_parts = date_str.split('-')
        year = date_parts[0]
        month = int(date_parts[1])
        day = int(date_parts[2])
        
        print(f"📅 Looking for day {day}...")
        
        # Try to select the date
        day_selectors = [
            f"button:contains('{day}')",
            f"[class*='day']:contains('{day}')",
            f"td:contains('{day}')"
        ]
        
        # Use JavaScript to find and click the day
        try:
            driver.execute_script(f"""
                var days = document.querySelectorAll('button, [class*="day"], td');
                for (var i = 0; i < days.length; i++) {{
                    if (days[i].textContent.trim() === '{day}') {{
                        days[i].click();
                        break;
                    }}
                }}
            """)
            time.sleep(1)
            # Click again for "to" date
            driver.execute_script(f"""
                var days = document.querySelectorAll('button, [class*="day"], td');
                for (var i = 0; i < days.length; i++) {{
                    if (days[i].textContent.trim() === '{day}') {{
                        days[i].click();
                        break;
                    }}
                }}
            """)
        except Exception as e:
            print(f"⚠️ Could not select date via JS: {e}")
        
        time.sleep(3)
        
        # Click somewhere else to close date picker
        try:
            driver.find_element(By.TAG_NAME, "body").click()
        except:
            pass
        
        time.sleep(3)
        
        print("📊 Extracting data from table...")
        
        # Wait for table to load
        time.sleep(5)
        
        # Extract data from the page
        assemblers = []
        
        # Get page source and parse
        page_source = driver.page_source
        
        # Try to find table rows
        rows = driver.find_elements(By.CSS_SELECTOR, "tr")
        
        print(f"Found {len(rows)} rows")
        
        for row in rows:
            try:
                cells = row.find_elements(By.CSS_SELECTOR, "td")
                if len(cells) >= 5:
                    # Get text from cells
                    name_cell = cells[1] if len(cells) > 1 else None
                    name = name_cell.text.strip() if name_cell else ""
                    
                    # Skip header and total rows
                    if name and name != "ПІБ" and "Всього" not in name and len(name) > 5:
                        def safe_int(text):
                            try:
                                return int(text.strip().replace(' ', '').replace(',', ''))
                            except:
                                return 0
                        
                        def safe_float(text):
                            try:
                                return float(text.strip().replace(' ', '').replace(',', '.'))
                            except:
                                return 0.0
                        
                        assembler = {
                            "name": name,
                            "dcCollected": safe_int(cells[2].text) if len(cells) > 2 else 0,
                            "storeCollected": safe_int(cells[3].text) if len(cells) > 3 else 0,
                            "packed": safe_int(cells[4].text) if len(cells) > 4 else 0,
                            "dcMoved": safe_int(cells[5].text) if len(cells) > 5 else 0,
                            "storeMoved": safe_int(cells[6].text) if len(cells) > 6 else 0,
                            "placedQty": safe_int(cells[7].text) if len(cells) > 7 else 0,
                            "placedKg": safe_float(cells[8].text) if len(cells) > 8 else 0
                        }
                        assemblers.append(assembler)
                        print(f"✅ Found: {name}")
            except Exception as e:
                continue
        
        print(f"📊 Total assemblers found: {len(assemblers)}")
        
        return {"date": date_str, "assemblers": assemblers}
        
    except Exception as e:
        print(f"❌ Error fetching data: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e)}

@app.route('/api/assemblers', methods=['POST'])
def get_assemblers_data():
    """API endpoint to get assemblers data"""
    data = request.json
    date = data.get('date')
    
    if not date:
        return jsonify({"error": "Date is required"}), 400
    
    print(f"\n{'='*50}")
    print(f"📥 Received request for date: {date}")
    print(f"{'='*50}\n")
    
    result = fetch_assemblers_data(date)
    
    if "error" in result:
        return jsonify(result), 500
    
    return jsonify(result)

@app.route('/api/login', methods=['POST'])
def do_login():
    """API endpoint to trigger login"""
    success = login_to_backoffice()
    return jsonify({"success": success})

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({"status": "ok", "logged_in": logged_in})

if __name__ == '__main__':
    print("🚀 Starting Selenium backend proxy server...")
    print("📅 Server will fetch data from back-office.silpo.ua using undetected-chromedriver")
    print("🌐 API available at http://localhost:5000")
    print("="*50)
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
