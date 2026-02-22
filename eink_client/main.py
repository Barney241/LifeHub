import network
import urequests
import time

# Configuration
WIFI_SSID = "Your_WiFi_SSID"
WIFI_PASS = "Your_WiFi_Password"
API_URL = "http://YOUR_LOCAL_IP:8080/api/eink/relevant"
DEVICE_TOKEN = "your_secure_device_token"

def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    if not wlan.isconnected():
        print("Connecting to WiFi...")
        wlan.connect(WIFI_SSID, WIFI_PASS)
        while not wlan.isconnected():
            time.sleep(1)
    print("WiFi connected:", wlan.ifconfig()[0])

def fetch_data(battery_level):
    try:
        # Pass dynamic params: battery, resolution, and security token
        params = f"?token={DEVICE_TOKEN}&bat={battery_level}&res=800x600"
        response = urequests.get(API_URL + params)
        if response.status_code == 200:
            return response.json()
        else:
            print("Error: Status code", response.status_code)
    except Exception as e:
        print("Request failed:", e)
    return None

def display_data(data):
    if not data or 'data' not in data:
        return
    
    print("--- E-Ink Update ---")
    print("Workspace:", data['data']['workspace'])
    print("Tasks:")
    for task in data['data']['tasks']:
        print(f"- [{task['priority']}] {task['title']}")
    print("--------------------")

def get_battery():
    # Placeholder for Inkplate 6 battery reading logic
    # In real usage: return inkplate.read_battery()
    return 85 

def main():
    connect_wifi()
    while True:
        bat = get_battery()
        data = fetch_data(bat)
        
        display_data(data)
        
        # Use dynamic refresh interval from server or default to 1800
        wait_time = data.get('config', {}).get('refresh_interval', 1800)
        print(f"Sleeping for {wait_time}s...")
        time.sleep(wait_time)

if __name__ == "__main__":
    main()
