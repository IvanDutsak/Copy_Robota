from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Credentials for back-office
PHONE = "+380988824838"
PASSWORD = "Wanjabro228"

# Session for maintaining cookies
session = requests.Session()

def login_to_backoffice():
    """Login to back-office.silpo.ua"""
    login_url = "https://back-office.silpo.ua/api/auth/login"
    
    payload = {
        "phone": PHONE,
        "password": PASSWORD
    }
    
    try:
        response = session.post(login_url, json=payload)
        if response.status_code == 200:
            print("✅ Successfully logged in to back-office")
            return True
        else:
            print(f"❌ Login failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Login error: {e}")
        return False

@app.route('/api/assemblers', methods=['POST'])
def get_assemblers_data():
    """Get assemblers data for a specific date"""
    data = request.json
    date = data.get('date')
    
    if not date:
        return jsonify({"error": "Date is required"}), 400
    
    # Ensure we're logged in
    login_to_backoffice()
    
    # API endpoint for assemblers key indicators
    api_url = "https://back-office.silpo.ua/api/dams/assemblers-key-indicators"
    
    params = {
        "dateFrom": date,
        "dateTo": date,
        # Add other required parameters
    }
    
    try:
        response = session.get(api_url, params=params)
        
        if response.status_code == 200:
            return jsonify(response.json())
        else:
            return jsonify({"error": f"Failed to fetch data: {response.status_code}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({"status": "ok"})

if __name__ == '__main__':
    print("🚀 Starting backend proxy server...")
    print(f"📅 Server will fetch data from back-office.silpo.ua")
    app.run(host='0.0.0.0', port=5000, debug=True)
