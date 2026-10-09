from playwright.sync_api import sync_playwright


def main() -> None:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page.goto("http://127.0.0.1:5180/preview/neumorphism", wait_until="networkidle")
        page.get_by_role("heading", name="Clarity with a softer touch.").wait_for()
        page.get_by_text("Warm tactile operations").wait_for()
        page.get_by_text("Inventory overview").wait_for()
        page.screenshot(path="neo-preview.png", full_page=True)
        print("neumorphism_preview_loaded=true")
        print(f"title={page.title()}")
        browser.close()


if __name__ == "__main__":
    main()
