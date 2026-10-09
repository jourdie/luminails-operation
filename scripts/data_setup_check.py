from playwright.sync_api import sync_playwright


def main() -> None:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1100})
        page.goto("http://127.0.0.1:5180/settings/data-setup", wait_until="networkidle")
        page.get_by_role("heading", name="Data Setup", exact=True).wait_for()

        page.once("dialog", lambda dialog: dialog.accept())
        page.get_by_role("button", name="Workspace kosong").click()
        page.get_by_text("Workspace sekarang kosong").wait_for()

        page.get_by_label("Nama supplier").fill("Supplier Testing")
        page.get_by_label("Kode supplier").fill("TEST")
        page.get_by_label("Opening deposit (IDR)").fill("2500000")
        page.get_by_role("button", name="Simpan supplier").click()
        page.get_by_text("Supplier Testing (TEST)", exact=True).wait_for()

        page.get_by_label("Nama produk").fill("SKU Testing")
        page.get_by_label("Variasi").fill("Default")
        page.get_by_label("Seller SKU").fill("TEST-001")
        page.get_by_label("HPP (IDR)").fill("50000")
        page.get_by_label("Opening actual stock").fill("20")
        page.get_by_label("Minimum stock").fill("5")
        page.get_by_role("button", name="Simpan SKU dan opening stock").click()
        page.get_by_text("SKU Testing Default", exact=True).wait_for()

        page.get_by_label("Nama akun").fill("Kas Testing")
        page.get_by_label("Saldo opening (IDR)").fill("10000000")
        page.get_by_role("button", name="Simpan akun").click()
        page.get_by_text("Kas Testing", exact=True).wait_for()
        page.goto("http://127.0.0.1:5180/", wait_until="networkidle")
        page.get_by_text("Tidak ada alert. Data operasional terlihat tenang.").wait_for()
        page.get_by_text("Rp 0").first.wait_for()
        print("data_setup_manual_input=true")
        print("workspace_clear=true")
        print("supplier_opening_deposit=true")
        print("sku_opening_stock=true")
        print("account_opening_balance=true")
        browser.close()


if __name__ == "__main__":
    main()
