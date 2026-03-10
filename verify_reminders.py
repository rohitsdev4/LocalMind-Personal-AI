from playwright.sync_api import sync_playwright
import time

def verify():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto("http://localhost:3000")

        # Wait for app to load
        page.wait_for_selector("text=LocalMind")
        time.sleep(1) # wait for hydration

        # We need to dismiss the Settings modal or API key modal that might be open first
        # Look for the close button on the modal, or just click outside
        try:
           page.click("text=Close", timeout=2000)
        except:
           pass

        try:
           # Sometime there's a backdrop. Click top left corner to try to dismiss modals.
           page.mouse.click(10, 10)
           time.sleep(1)
        except:
           pass

        # Click the sidebar menu button
        # Use a more specific locator if possible, or force the click
        menu_button = page.locator("header button").first
        menu_button.click(force=True)

        # Wait for sidebar to open and click Reminders
        page.wait_for_selector("text=Reminders")
        reminders_button = page.locator("button:has-text('Reminders')")
        reminders_button.click(force=True)

        # Wait for Reminders interface to load
        page.wait_for_selector("text=Manage alerts and notifications")
        time.sleep(1)

        # Take screenshot of empty state
        page.screenshot(path="reminders_empty.png")

        browser.close()

if __name__ == "__main__":
    verify()
