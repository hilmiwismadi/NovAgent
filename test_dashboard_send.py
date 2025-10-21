#!/usr/bin/env python3
"""
Selenium test script to send a message from the NovaBot dashboard
"""

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
import time
import sys

def test_dashboard_send():
    print("🚀 Starting Selenium test for NovaBot dashboard...")

    # Setup Chrome options
    chrome_options = Options()
    chrome_options.add_argument('--headless')  # Run in headless mode
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-gpu')
    chrome_options.add_argument('--window-size=1920,1080')

    driver = None

    try:
        print("📱 Initializing Chrome driver...")
        driver = webdriver.Chrome(options=chrome_options)

        print("🌐 Navigating to https://novabot.izcy.tech/...")
        driver.get("https://novabot.izcy.tech/")

        # Wait for page to load
        time.sleep(2)

        print("📸 Current page title:", driver.title)
        print("📸 Current URL:", driver.current_url)

        # Find and click the chat button
        print("🔍 Looking for '💬 Chat' button...")
        wait = WebDriverWait(driver, 10)
        chat_button = wait.until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, "button.action-btn"))
        )
        print(f"✅ Found button: {chat_button.text}")
        chat_button.click()
        print("✅ Clicked chat button")

        time.sleep(1)

        # Find the textarea
        print("🔍 Looking for message textarea...")
        textarea = wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "textarea[placeholder*='Type your message']"))
        )
        print("✅ Found textarea")

        # Type the test message
        test_message = f"SELENIUM TEST MESSAGE - {int(time.time())}"
        print(f"⌨️  Typing message: '{test_message}'")
        textarea.clear()
        textarea.send_keys(test_message)

        time.sleep(1)

        # Find and click the send button
        print("🔍 Looking for send button...")
        send_button = driver.find_element(By.CSS_SELECTOR, "button[type='submit'].send-btn")

        # Check if button is disabled
        is_disabled = send_button.get_attribute('disabled')
        if is_disabled:
            print("⚠️  WARNING: Send button is disabled!")
            print("📸 Taking screenshot for debugging...")
            driver.save_screenshot('/tmp/novabot_disabled_button.png')
            print("📸 Screenshot saved to /tmp/novabot_disabled_button.png")

            # Try to find why it's disabled - maybe need to select client first?
            print("🔍 Looking for client selection...")
            try:
                client_elements = driver.find_elements(By.CSS_SELECTOR, ".client-list-item, .client-card, [data-client-id]")
                if client_elements:
                    print(f"✅ Found {len(client_elements)} client element(s)")
                    client_elements[0].click()
                    print("✅ Selected first client")
                    time.sleep(1)

                    # Try to type message again after selecting client
                    textarea = driver.find_element(By.CSS_SELECTOR, "textarea[placeholder*='Type your message']")
                    textarea.clear()
                    textarea.send_keys(test_message)
                    time.sleep(0.5)

                    # Check send button again
                    send_button = driver.find_element(By.CSS_SELECTOR, "button[type='submit'].send-btn")
                    is_disabled = send_button.get_attribute('disabled')
                    print(f"🔍 Button disabled status after client selection: {is_disabled}")
            except Exception as e:
                print(f"⚠️  Could not find/select client: {e}")

        if not is_disabled:
            print("✅ Send button is enabled")
            send_button.click()
            print("✅ Clicked send button")

            time.sleep(2)

            # Try to find success message
            try:
                success_element = driver.find_element(By.CSS_SELECTOR, ".success, .alert-success, [class*='success']")
                print(f"✅ Success message: {success_element.text}")
            except:
                print("⚠️  No success message found")

            print(f"\n{'='*60}")
            print(f"✅ TEST COMPLETED")
            print(f"📝 Message sent: '{test_message}'")
            print(f"{'='*60}\n")

            return test_message
        else:
            print("\n❌ TEST FAILED: Could not enable send button")
            return None

    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()

        if driver:
            print("\n📸 Taking error screenshot...")
            driver.save_screenshot('/tmp/novabot_error.png')
            print("📸 Screenshot saved to /tmp/novabot_error.png")

            print("\n📄 Page source (first 1000 chars):")
            print(driver.page_source[:1000])

        return None

    finally:
        if driver:
            print("\n🔒 Closing browser...")
            driver.quit()

if __name__ == "__main__":
    message_sent = test_dashboard_send()

    if message_sent:
        print("\n" + "="*60)
        print("🎯 Now check the logs for this message:")
        print(f"   docker compose logs whatsapp-bot | grep '{message_sent}'")
        print("="*60)
        sys.exit(0)
    else:
        sys.exit(1)
