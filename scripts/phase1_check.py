from playwright.sync_api import sync_playwright


def main() -> None:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 1000})
        page = context.new_page()
        page.goto("http://127.0.0.1:5180/", wait_until="networkidle")
        page.evaluate("localStorage.clear()")
        page.reload(wait_until="networkidle")
        page.get_by_role("heading", name="Selamat datang kembali.").wait_for()
        body_text = page.locator("body").inner_text()
        assert "0" in body_text
        assert "54.000.000" not in page.locator("body").inner_text()

        page.goto("http://127.0.0.1:5180/settings/accounts", wait_until="networkidle")
        page.get_by_role("button", name="Tambah akun").click()
        page.get_by_label("Nama akun").fill("BCA Testing")
        page.get_by_label("Saldo pembukaan").fill("1000000")
        page.get_by_role("button", name="Simpan akun").click()
        page.get_by_role("button", name="Update saldo").click()
        page.get_by_label("Saldo aktual (IDR)").fill("1250000")
        page.get_by_role("button", name="Simpan snapshot").click()
        assert "1.250.000" in page.locator("body").inner_text()

        page.goto("http://127.0.0.1:5180/finance/business-position", wait_until="networkidle")
        assert "1.250.000" in page.locator("body").inner_text()
        assert "54.000.000" not in page.locator("body").inner_text()

        page.goto("http://127.0.0.1:5180/operations/inventory", wait_until="networkidle")
        with page.expect_download() as download_info:
            page.get_by_role("button", name="Template stok manual").click()
        assert download_info.value.suggested_filename == "luminails-manual-stock-count-template.xlsx"

        page.goto("http://127.0.0.1:5180/finance/profit-loss", wait_until="networkidle")
        page.get_by_role("heading", name="Reconciliation gate").wait_for()
        print("phase1_local_ui=true")
        print("empty_workspace=true")
        print("manual_balance_snapshot=true")
        print("manual_stock_template=true")
        print("reconciliation_gate=true")
        browser.close()


if __name__ == "__main__":
    main()
