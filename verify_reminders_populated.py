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

        try:
           page.click("text=Close", timeout=2000)
        except:
           pass

        try:
           page.mouse.click(10, 10)
           time.sleep(1)
        except:
           pass

        # Use evaluated script to populate DB directly before interacting with UI using localforage
        page.evaluate("""
            (async () => {
                const req = window.indexedDB.open('localmind');
                req.onsuccess = (e) => {
                    const db = e.target.result;
                    const tx = db.transaction('reminders', 'readwrite');
                    const store = tx.objectStore('reminders');

                    // Add Overdue
                    store.put({
                        id: '1',
                        message: 'Buy milk',
                        triggerTime: new Date(Date.now() - 86400000).toISOString(),
                        fired: true,
                        status: 'fired',
                        createdAt: new Date().toISOString()
                    }, '1');

                    // Add Today
                    store.put({
                        id: '2',
                        message: 'Call mom',
                        triggerTime: new Date(Date.now() + 3600000).toISOString(),
                        fired: false,
                        status: 'active',
                        repeat: 'weekly',
                        priority: 'high',
                        createdAt: new Date().toISOString()
                    }, '2');

                    // Add Tomorrow
                    store.put({
                        id: '3',
                        message: 'Doctor appointment',
                        triggerTime: new Date(Date.now() + 86400000 * 1.5).toISOString(),
                        fired: false,
                        status: 'active',
                        priority: 'urgent',
                        createdAt: new Date().toISOString()
                    }, '3');
                };
            })();
        """)

        time.sleep(1)

        # Click the sidebar menu button
        menu_button = page.locator("header button").first
        menu_button.click(force=True)

        # Wait for sidebar to open and click Reminders
        page.wait_for_selector("text=Reminders")
        reminders_button = page.locator("button:has-text('Reminders')")
        reminders_button.click(force=True)

        # Wait for Reminders interface to load
        page.wait_for_selector("text=Manage alerts and notifications")
        time.sleep(2)

        # Click the first checkbox to show selection state
        try:
            page.locator("input[type='checkbox']").first.click()
            time.sleep(0.5)
        except Exception as e:
            print("Could not click checkbox:", e)

        # Take screenshot of populated state
        page.screenshot(path="reminders_populated.png")

        browser.close()

if __name__ == "__main__":
    verify()
